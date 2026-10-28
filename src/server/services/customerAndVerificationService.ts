import crypto from 'crypto';
import { readDatabase, withDatabaseTransaction } from '@/server/db/database';
import { hashSessionToken, hashVerificationCode } from '@/server/db/migrations';
import type {
  BookingAccessCredentialRecord,
  CustomerRecord,
  NotificationRecord,
  PlatformDatabaseSchema,
} from '@/server/db/schema';
import type { Booking, CustomerBookingVerifiedView } from '@/types';
import { calculateNights } from '@/lib/utils';
import { requireRealtorAdmin } from './authService';

export function generateCryptographicVerificationCode(): string {
  const num = crypto.randomInt(100000, 1000000);
  return String(num);
}

export function generateBookingSessionToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function maskEmailAddress(email: string): string {
  const trimmed = email.trim();
  const [local, domain] = trimmed.split('@');
  if (!local || !domain) return '***@***';
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export function maskPhoneNumber(phone: string): string {
  const digits = phone.replace(/\s+/g, '');
  if (digits.length <= 4) return '****';
  const last4 = digits.slice(-4);
  const prefix = digits.slice(0, 4);
  return `${prefix} *** ${last4}`;
}

export function findOrCreateCustomerInTransaction(
  db: PlatformDatabaseSchema,
  input: {
    fullName: string;
    email: string;
    phone: string;
  }
): CustomerRecord {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim();
  const normalizedPhoneDigits = normalizedPhone.replace(/\D/g, '');
  const nowIso = new Date().toISOString();

  const existing = db.customers.find(
    (c) =>
      c.email.toLowerCase() === normalizedEmail ||
      (normalizedPhoneDigits.length >= 8 &&
        c.phone.replace(/\D/g, '') === normalizedPhoneDigits)
  );

  if (existing) {
    existing.fullName = input.fullName.trim() || existing.fullName;
    existing.email = normalizedEmail || existing.email;
    existing.phone = normalizedPhone || existing.phone;
    existing.updatedAt = nowIso;
    return existing;
  }

  const newCustomer: CustomerRecord = {
    id: `cust-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    clientId: db.realtorConfig.clientId,
    fullName: input.fullName.trim(),
    email: normalizedEmail,
    phone: normalizedPhone,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  db.customers.unshift(newCustomer);
  return newCustomer;
}

export function issueBookingVerificationCredentialInTransaction(
  db: PlatformDatabaseSchema,
  params: {
    booking: Booking;
    customer: CustomerRecord;
    template: 'BOOKING_CREATED_CODE' | 'FRESH_VERIFICATION_CODE';
    customExpiryMinutes?: number;
  }
): {
  rawVerificationCode: string;
  credential: BookingAccessCredentialRecord;
  notification: NotificationRecord;
} {
  const now = new Date();
  const nowIso = now.toISOString();
  const expiryMinutes =
    params.customExpiryMinutes !== undefined
      ? params.customExpiryMinutes
      : db.realtorConfig.verificationCodeExpiryMinutes || 60;

  const expiresAtIso = new Date(now.getTime() + expiryMinutes * 60 * 1000).toISOString();

  // Revoke any previous unused credentials for this booking
  for (const existingCred of db.bookingAccessCredentials) {
    if (
      existingCred.bookingId === params.booking.id &&
      !existingCred.usedAt &&
      !existingCred.revokedAt
    ) {
      existingCred.revokedAt = nowIso;
    }
  }

  // Ensure uniqueness among currently active verification codes
  let rawCode = generateCryptographicVerificationCode();
  let codeHash = hashVerificationCode(rawCode);
  let safetyCounter = 0;
  while (
    db.bookingAccessCredentials.some(
      (c) => c.codeHash === codeHash && !c.usedAt && !c.revokedAt
    ) &&
    safetyCounter < 10
  ) {
    rawCode = generateCryptographicVerificationCode();
    codeHash = hashVerificationCode(rawCode);
    safetyCounter++;
  }

  const credential: BookingAccessCredentialRecord = {
    id: `cred-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    bookingId: params.booking.id,
    bookingReference: params.booking.bookingReference,
    customerId: params.customer.id,
    codeHash,
    deliveryChannel: 'Both',
    expiresAt: expiresAtIso,
    usedAt: null,
    revokedAt: null,
    failedAttempts: 0,
    lastAttemptAt: null,
    lockedUntil: null,
    createdAt: nowIso,
  };

  db.bookingAccessCredentials.unshift(credential);

  const hasLiveNotificationProvider = Boolean(process.env.SMTP_HOST || process.env.SMS_API_KEY);

  const notification: NotificationRecord = {
    id: `notif-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    clientId: db.realtorConfig.clientId,
    bookingId: params.booking.id,
    bookingReference: params.booking.bookingReference,
    customerId: params.customer.id,
    recipientEmail: params.customer.email,
    recipientPhone: params.customer.phone,
    channel: 'Both',
    template: params.template,
    subject:
      params.template === 'BOOKING_CREATED_CODE'
        ? `Your Booking ${params.booking.bookingReference} & Verification Code — ${db.realtorConfig.businessName}`
        : `New Verification Code for Booking ${params.booking.bookingReference} — ${db.realtorConfig.businessName}`,
    messagePreview: `Hello ${params.customer.fullName}, your one-time verification code to access booking ${params.booking.bookingReference} on /my-booking is ready. Valid until ${new Date(expiresAtIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
    devModeCodePreview: rawCode,
    deliveryStatus: hasLiveNotificationProvider ? 'Sent' : 'SimulatedInDev',
    createdAt: nowIso,
  };

  db.notifications.unshift(notification);

  return {
    rawVerificationCode: rawCode,
    credential,
    notification,
  };
}

export function buildCustomerBookingVerifiedView(
  db: PlatformDatabaseSchema,
  booking: Booking
): CustomerBookingVerifiedView {
  const apartment = db.apartments.find((a) => a.id === booking.apartmentId);
  const nights = Math.max(1, calculateNights(booking.checkIn, booking.checkOut));
  const nightlyRate = booking.nightlyRate ?? apartment?.pricePerNight ?? 0;
  const cleaningFee = booking.cleaningFee ?? apartment?.cleaningFee ?? 0;
  const serviceFee = booking.serviceFee ?? apartment?.serviceFee ?? 0;
  const totalPrice = booking.totalPrice;
  const amountPaid = booking.amountPaid ?? (booking.paymentStatus === 'Paid' ? totalPrice : 0);
  const balanceAmount = Math.max(0, totalPrice - amountPaid);
  const depositRequiredAmount =
    booking.depositRequiredAmount ??
    (booking.paymentPolicySnapshot === 'Deposit'
      ? Math.round((totalPrice * db.realtorConfig.depositPercentage) / 100)
      : totalPrice);

  const bookingPayments = db.payments
    .filter((p) => p.bookingId === booking.id)
    .map((p) => ({
      id: p.id,
      reference: p.reference,
      providerReference: p.providerReference || p.reference,
      paymentMethod: p.paymentMethod || 'Paystack',
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      paymentStatus: p.paymentStatus || booking.paymentStatus,
      receiptVerificationStatus:
        p.receiptVerificationStatus ||
        booking.receiptVerificationStatus ||
        'NotApplicable',
      receiptStorageKey: p.receiptStorageKey || null,
      paymentType: p.paymentType,
      mode: p.mode,
      paidAt: p.paidAt,
      verifiedAt: p.verifiedAt,
      createdAt: p.createdAt,
    }));

  const paymentMethod = booking.paymentMethod || 'Paystack';
  const receiptVerificationStatus =
    booking.receiptVerificationStatus ||
    (paymentMethod === 'BankTransfer' ? 'PendingReview' : 'NotApplicable');

  const canPayNow =
    booking.status !== 'Cancelled' &&
    booking.status !== 'Rejected' &&
    booking.status !== 'Expired' &&
    booking.paymentStatus !== 'Paid' &&
    booking.paymentStatus !== 'AwaitingVerification' &&
    balanceAmount > 0 &&
    (booking.paymentPolicySnapshot !== 'PayAfterApproval' || booking.status === 'Confirmed');

  const canCancelBooking =
    booking.status === 'PendingApproval' ||
    booking.status === 'Pending' ||
    (booking.status === 'Confirmed' && booking.paymentStatus !== 'Paid');

  // Show full check-in instructions ONLY when booking is explicitly Confirmed by an administrator
  const showFullCheckInInstructions = booking.status === 'Confirmed';

  let nextStepsSummary =
    'Your booking request is being processed by our reservations desk.';
  if (booking.status === 'Confirmed') {
    nextStepsSummary =
      'Your booking is Confirmed! Full property address and check-in instructions are unlocked below.';
  } else if (booking.status === 'Rejected') {
    nextStepsSummary = `This booking request was not approved.${booking.rejectionReason ? ` Reason: ${booking.rejectionReason}` : ''}`;
  } else if (booking.status === 'Cancelled') {
    nextStepsSummary = 'This booking has been cancelled and the dates have been released.';
  } else if (paymentMethod === 'Paystack' && booking.paymentStatus === 'Paid') {
    nextStepsSummary =
      'Your Paystack online payment has been verified! Your booking is currently Pending Admin Approval. Our administrator will review and confirm your reservation shortly.';
  } else if (
    paymentMethod === 'BankTransfer' &&
    receiptVerificationStatus === 'PendingReview'
  ) {
    nextStepsSummary =
      'Your bank transfer receipt has been uploaded and is Pending Review. Once our administrator verifies the transfer and approves your booking, your status will update to Confirmed.';
  } else if (
    paymentMethod === 'BankTransfer' &&
    receiptVerificationStatus === 'Verified'
  ) {
    nextStepsSummary =
      'Your bank transfer receipt has been verified by our administrator. Your booking is now awaiting final administrator approval.';
  } else if (
    paymentMethod === 'BankTransfer' &&
    receiptVerificationStatus === 'Rejected'
  ) {
    nextStepsSummary = `Your uploaded transfer receipt could not be verified.${booking.rejectionReason ? ` Reason: ${booking.rejectionReason}` : ''}`;
  }

  return {
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    apartmentId: booking.apartmentId,
    apartmentName: apartment?.name || 'Serviced Residence',
    apartmentLocation: apartment?.location || 'Lagos, Nigeria',
    apartmentAddress: showFullCheckInInstructions
      ? apartment?.address || 'Address provided upon confirmation'
      : `${apartment?.area || ''}, ${apartment?.city || 'Lagos'} (Full street address unlocked upon administrator confirmation)`,
    apartmentImage:
      apartment?.images?.[0] ||
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80',
    unitType: apartment?.unitType || 'Executive Suite',
    customerFullName: booking.guestName,
    customerMaskedEmail: maskEmailAddress(booking.guestEmail),
    customerMaskedPhone: maskPhoneNumber(booking.guestPhone),
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    nights,
    guests: booking.guests,
    nightlyRate,
    cleaningFee,
    serviceFee,
    totalPrice,
    depositRequiredAmount,
    amountPaid,
    balanceAmount,
    currency: 'NGN',
    status: booking.status,
    bookingStatus: booking.bookingStatus || booking.status,
    paymentMethod,
    paymentStatus: booking.paymentStatus,
    receiptVerificationStatus,
    hasUploadedReceipt: Boolean(booking.receiptStorageKey),
    receiptStorageKey: booking.receiptStorageKey || null,
    rejectionReason: booking.rejectionReason || null,
    approvedAt: booking.approvedAt || null,
    paymentPolicy: booking.paymentPolicySnapshot || db.realtorConfig.paymentPolicy,
    specialRequests: booking.specialRequests,
    checkInTime: db.realtorConfig.defaultCheckInTime,
    checkOutTime: db.realtorConfig.defaultCheckOutTime,
    checkInInstructions: showFullCheckInInstructions
      ? booking.checkInInstructions ||
        apartment?.checkInInstructions ||
        db.realtorConfig.defaultCheckInInstructions
      : 'Check-in instructions and smart-lock access codes will appear here once an administrator approves and confirms your booking.',
    cancellationPolicySummary: db.realtorConfig.cancellationPolicySummary,
    realtorBusinessName: db.realtorConfig.businessName,
    realtorContactEmail: db.realtorConfig.contactEmail,
    realtorContactPhone: db.realtorConfig.contactPhone,
    realtorWhatsapp: db.realtorConfig.whatsappNumber,
    canPayNow,
    canCancelBooking,
    nextStepsSummary,
    payments: bookingPayments,
    createdAt: booking.createdAt,
  };
}

const GENERIC_VERIFICATION_ERROR =
  'Unable to verify booking access. Please check your verification code (and booking reference if provided) or request a fresh code.';

export function verifyBookingAccessCode(input: {
  verificationCode: string;
  bookingReference?: string;
  rateLimitKey?: string;
}):
  | {
      ok: true;
      sessionToken: string;
      sessionExpiresAt: string;
      booking: CustomerBookingVerifiedView;
    }
  | {
      ok: false;
      error: string;
      code: 'INVALID_INPUT' | 'RATE_LIMITED' | 'EXPIRED_CODE' | 'USED_CODE' | 'UNAUTHORIZED';
      status: 400 | 401 | 429;
    } {
  const rawCode = input.verificationCode?.trim() || '';
  const optionalRef = input.bookingReference?.trim().toUpperCase() || '';
  const rateKey = (input.rateLimitKey || 'global-anon').trim().toLowerCase();

  if (!rawCode || rawCode.replace(/[\s-]/g, '').length < 4) {
    return {
      ok: false,
      error: 'Please enter a valid 6-digit verification code.',
      code: 'INVALID_INPUT',
      status: 400,
    };
  }

  return withDatabaseTransaction((db) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const maxAttempts = db.realtorConfig.verificationMaxAttempts || 5;

    // 1. Check rate limit record for this caller key
    let rateRecord = db.verificationRateLimits.find((r) => r.key === rateKey);
    if (!rateRecord) {
      rateRecord = {
        key: rateKey,
        attempts: 0,
        windowStartAt: nowIso,
        lockedUntil: null,
      };
      db.verificationRateLimits.push(rateRecord);
    }

    if (rateRecord.lockedUntil && new Date(rateRecord.lockedUntil) > now) {
      return {
        ok: false as const,
        error:
          'Too many failed verification attempts. Please wait 15 minutes before trying again or contact support.',
        code: 'RATE_LIMITED' as const,
        status: 429 as const,
      };
    }

    // Reset window if older than 15 minutes
    if (now.getTime() - new Date(rateRecord.windowStartAt).getTime() > 15 * 60 * 1000) {
      rateRecord.attempts = 0;
      rateRecord.windowStartAt = nowIso;
      rateRecord.lockedUntil = null;
    }

    const submittedHash = hashVerificationCode(rawCode);

    // Find matching credential by hash (and optional bookingReference if provided)
    const matchingCredentials = db.bookingAccessCredentials.filter((c) => {
      if (optionalRef && c.bookingReference.toUpperCase() !== optionalRef) {
        return false;
      }
      return c.codeHash === submittedHash;
    });

    if (matchingCredentials.length === 0) {
      rateRecord.attempts += 1;
      if (rateRecord.attempts >= maxAttempts) {
        rateRecord.lockedUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
      }

      // If bookingReference was provided, also increment failedAttempts on any active credential for that booking
      if (optionalRef) {
        for (const cred of db.bookingAccessCredentials) {
          if (
            cred.bookingReference.toUpperCase() === optionalRef &&
            !cred.usedAt &&
            !cred.revokedAt
          ) {
            cred.failedAttempts += 1;
            cred.lastAttemptAt = nowIso;
            if (cred.failedAttempts >= maxAttempts) {
              cred.lockedUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
            }
          }
        }
      }

      if (rateRecord.lockedUntil) {
        return {
          ok: false as const,
          error:
            'Too many failed verification attempts. Please wait 15 minutes before trying again.',
          code: 'RATE_LIMITED' as const,
          status: 429 as const,
        };
      }

      return {
        ok: false as const,
        error: GENERIC_VERIFICATION_ERROR,
        code: 'UNAUTHORIZED' as const,
        status: 401 as const,
      };
    }

    // Pick the most recent matching credential
    const credential = matchingCredentials[0];

    if (credential.lockedUntil && new Date(credential.lockedUntil) > now) {
      return {
        ok: false as const,
        error:
          'Too many failed verification attempts for this booking. Please request a fresh verification code.',
        code: 'RATE_LIMITED' as const,
        status: 429 as const,
      };
    }

    if (credential.revokedAt || credential.usedAt) {
      return {
        ok: false as const,
        error:
          'This one-time verification code has already been used or superseded. Please request a fresh verification code below.',
        code: 'USED_CODE' as const,
        status: 401 as const,
      };
    }

    if (new Date(credential.expiresAt) <= now) {
      return {
        ok: false as const,
        error:
          'This verification code has expired. Please request a fresh verification code below.',
        code: 'EXPIRED_CODE' as const,
        status: 401 as const,
      };
    }

    const booking = db.bookings.find((b) => b.id === credential.bookingId);
    if (!booking) {
      return {
        ok: false as const,
        error: GENERIC_VERIFICATION_ERROR,
        code: 'UNAUTHORIZED' as const,
        status: 401 as const,
      };
    }

    // Valid! Mark the one-time code as used and reset rate limit counter
    credential.usedAt = nowIso;
    credential.lastAttemptAt = nowIso;
    rateRecord.attempts = 0;
    rateRecord.lockedUntil = null;

    // Issue a short-lived protected booking-access session token (30 minutes)
    const sessionToken = generateBookingSessionToken();
    const sessionExpiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    db.bookingAccessSessions.unshift({
      id: `bksess-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      tokenHash: hashSessionToken(sessionToken),
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      customerId: credential.customerId,
      expiresAt: sessionExpiresAt,
      createdAt: nowIso,
    });

    db.auditLogs.unshift({
      id: `aud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      clientId: db.realtorConfig.clientId,
      actorUserId: credential.customerId,
      actorEmail: booking.guestEmail,
      actorRole: 'CUSTOMER',
      action: 'CUSTOMER_VERIFIED_BOOKING_CODE',
      targetType: 'BOOKING',
      targetId: booking.id,
      metadataJson: JSON.stringify({
        bookingReference: booking.bookingReference,
        credentialId: credential.id,
      }),
      createdAt: nowIso,
    });

    return {
      ok: true as const,
      sessionToken,
      sessionExpiresAt,
      booking: buildCustomerBookingVerifiedView(db, booking),
    };
  });
}

export function getVerifiedBookingBySessionToken(
  sessionToken: string | undefined
):
  | { ok: true; booking: CustomerBookingVerifiedView; rawBooking: Booking }
  | { ok: false; error: string; status: 401 } {
  if (!sessionToken || !sessionToken.trim()) {
    return {
      ok: false,
      error: 'Booking verification session required. Please enter your verification code.',
      status: 401,
    };
  }

  const db = readDatabase();
  const tokenHash = hashSessionToken(sessionToken.trim());
  const now = new Date();

  const session = db.bookingAccessSessions.find(
    (s) => s.tokenHash === tokenHash && new Date(s.expiresAt) > now
  );

  if (!session) {
    return {
      ok: false,
      error: 'Your booking access session has expired. Please enter a verification code.',
      status: 401,
    };
  }

  const booking = db.bookings.find((b) => b.id === session.bookingId);
  if (!booking) {
    return {
      ok: false,
      error: 'Booking not found.',
      status: 401,
    };
  }

  return {
    ok: true,
    booking: buildCustomerBookingVerifiedView(db, booking),
    rawBooking: booking,
  };
}

export function requestFreshBookingVerificationCode(input: {
  bookingReference: string;
  emailOrPhone: string;
}):
  | {
      ok: true;
      message: string;
      devModeCodePreview: string | null;
      expiresAt: string | null;
    }
  | { ok: false; error: string; status: 400 } {
  const ref = input.bookingReference?.trim().toUpperCase() || '';
  const contact = input.emailOrPhone?.trim().toLowerCase() || '';

  if (!ref || !contact) {
    return {
      ok: false,
      error: 'Booking reference and the email address or phone number used at booking are required.',
      status: 400,
    };
  }

  return withDatabaseTransaction((db) => {
    const booking = db.bookings.find((b) => b.bookingReference.toUpperCase() === ref);
    const contactDigits = contact.replace(/\D/g, '');

    const matchesContact =
      booking &&
      (booking.guestEmail.toLowerCase().trim() === contact ||
        (contactDigits.length >= 8 &&
          booking.guestPhone.replace(/\D/g, '') === contactDigits));

    // Safe generic response if no match — never leaks whether the booking or email/phone exists
    if (!booking || !matchesContact) {
      return {
        ok: true as const,
        message:
          'If a matching booking was found for those details, a fresh one-time verification code has been sent to the registered email and phone number.',
        devModeCodePreview: null,
        expiresAt: null,
      };
    }

    const customer = findOrCreateCustomerInTransaction(db, {
      fullName: booking.guestName,
      email: booking.guestEmail,
      phone: booking.guestPhone,
    });

    const issued = issueBookingVerificationCredentialInTransaction(db, {
      booking,
      customer,
      template: 'FRESH_VERIFICATION_CODE',
    });

    return {
      ok: true as const,
      message:
        'If a matching booking was found for those details, a fresh one-time verification code has been sent to the registered email and phone number.',
      devModeCodePreview: issued.notification.devModeCodePreview,
      expiresAt: issued.credential.expiresAt,
    };
  });
}

export function adminReissueBookingVerificationCode(
  actorUserId: string | undefined,
  bookingId: string
):
  | {
      ok: true;
      bookingReference: string;
      devModeCodePreview: string | null;
      expiresAt: string;
      message: string;
    }
  | { ok: false; error: string; status: 401 | 403 | 404 } {
  const auth = requireRealtorAdmin(actorUserId);
  if (!auth.ok) {
    return auth;
  }

  return withDatabaseTransaction((db) => {
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return {
        ok: false as const,
        error: 'Booking not found.',
        status: 404 as const,
      };
    }

    const customer = findOrCreateCustomerInTransaction(db, {
      fullName: booking.guestName,
      email: booking.guestEmail,
      phone: booking.guestPhone,
    });

    const issued = issueBookingVerificationCredentialInTransaction(db, {
      booking,
      customer,
      template: 'FRESH_VERIFICATION_CODE',
    });

    db.auditLogs.unshift({
      id: `aud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      clientId: db.realtorConfig.clientId,
      actorUserId: auth.actor.id,
      actorEmail: auth.actor.email,
      actorRole: auth.actor.role,
      action: 'ADMIN_REISSUE_VERIFICATION_CODE',
      targetType: 'VERIFICATION_CODE',
      targetId: booking.id,
      metadataJson: JSON.stringify({
        bookingReference: booking.bookingReference,
        expiresAt: issued.credential.expiresAt,
      }),
      createdAt: new Date().toISOString(),
    });

    return {
      ok: true as const,
      bookingReference: booking.bookingReference,
      devModeCodePreview: issued.notification.devModeCodePreview,
      expiresAt: issued.credential.expiresAt,
      message: `Fresh verification code issued and dispatched to ${booking.guestEmail}.`,
    };
  });
}

export { hashVerificationCode };
export const getVerifiedBookingSessionView = getVerifiedBookingBySessionToken;

export function verifyBookingWithCode(input: {
  verificationCode: string;
  bookingReference?: string;
  contactMethod?: string;
  contactValue?: string;
  rateLimitKey?: string;
  ipKey?: string;
}) {
  const result = verifyBookingAccessCode({
    verificationCode: input.verificationCode,
    bookingReference: input.bookingReference,
    rateLimitKey: input.rateLimitKey || input.ipKey,
  });
  if (!result.ok) {
    return result;
  }
  return {
    ...result,
    accessToken: result.sessionToken,
  };
}

/**
 * The guest's own copy of a booking: strips administrator-only fields
 * (internal notes, approver ids, status history notes) before it leaves the server.
 */
export function toGuestBooking(booking: Booking): Booking {
  const { adminNotes, approvedByUserId, statusHistory, ...rest } = booking;
  return {
    ...rest,
    statusHistory: (statusHistory || []).map((h) => ({ ...h, note: '' })),
  };
}

/**
 * Issues a short-lived (30 minute) booking-access session for a booking the
 * caller has just proven ownership of (completed payment or bank-transfer
 * submission). Same session store the /my-booking code verification uses.
 */
export function issueBookingAccessSession(
  bookingId: string
): { sessionToken: string; sessionExpiresAt: string } | null {
  return withDatabaseTransaction((db) => {
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) return null;

    const customerId =
      booking.customerId ||
      db.customers.find((c) => c.email.toLowerCase() === booking.guestEmail.toLowerCase())?.id ||
      '';
    const now = new Date();
    const sessionToken = generateBookingSessionToken();
    const sessionExpiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    db.bookingAccessSessions.unshift({
      id: `bksess-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      tokenHash: hashSessionToken(sessionToken),
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      customerId,
      expiresAt: sessionExpiresAt,
      createdAt: now.toISOString(),
    });

    return { sessionToken, sessionExpiresAt };
  });
}
