import crypto from 'crypto';
import { readDatabase, withDatabaseTransaction } from '@/server/db/database';
import {
  BookingCheckoutAttemptRecord,
  PrivateReceiptFileRecord,
  PaymentRecord,
} from '@/server/db/schema';
import {
  Booking,
  PaymentMethod,
  PaymentStatus,
  ReceiptVerificationStatus,
} from '@/types';
import { calculateNights, generateBookingReference } from '@/lib/utils';
import { hasBookingConflict, hasBlockedDateConflict } from '@/lib/availability';
import {
  findOrCreateCustomerInTransaction,
  issueBookingVerificationCredentialInTransaction,
  getVerifiedBookingBySessionToken,
} from './customerAndVerificationService';
import { requireRealtorAdmin } from './authService';

const ALLOWED_RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_RECEIPT_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface CreateCheckoutAttemptInput {
  apartmentId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  paymentMethod: PaymentMethod;
  specialRequests?: string;
  idempotencyKey?: string;
}

export function createBookingCheckoutAttempt(
  input: CreateCheckoutAttemptInput
):
  | {
      ok: true;
      checkout: BookingCheckoutAttemptRecord;
      message: string;
    }
  | { ok: false; error: string; status: 400 | 404 | 409 } {
  const guestName = input.guestName?.trim();
  const guestEmail = input.guestEmail?.trim().toLowerCase();
  const guestPhone = input.guestPhone?.trim();

  if (!input.apartmentId || !guestName || !guestEmail || !guestPhone) {
    return {
      ok: false,
      error: 'Full name, email address, phone number, and apartment selection are required.',
      status: 400,
    };
  }

  if (!input.checkIn || !input.checkOut || input.checkOut <= input.checkIn) {
    return {
      ok: false,
      error: 'Check-out date must be after check-in date.',
      status: 400,
    };
  }

  return withDatabaseTransaction((db) => {
    // Check idempotency if an idempotency key was supplied
    if (input.idempotencyKey) {
      const existing = db.checkoutAttempts.find(
        (c) => c.idempotencyKey === input.idempotencyKey
      );
      if (existing) {
        return {
          ok: true as const,
          checkout: existing,
          message: 'Existing checkout attempt retrieved (idempotent).',
        };
      }
    }

    const apartment = db.apartments.find((a) => a.id === input.apartmentId);
    if (!apartment) {
      return {
        ok: false as const,
        error: 'Selected apartment unit not found.',
        status: 404 as const,
      };
    }

    if (!apartment.isActive && apartment.status !== 'active') {
      return {
        ok: false as const,
        error: 'This apartment unit is currently inactive.',
        status: 409 as const,
      };
    }

    const nights = calculateNights(input.checkIn, input.checkOut);
    if (nights < apartment.minStay) {
      return {
        ok: false as const,
        error: `${apartment.name} requires a minimum stay of ${apartment.minStay} night(s).`,
        status: 400 as const,
      };
    }

    const guests = Number(input.guests) || 1;
    if (guests < 1 || guests > apartment.maxGuests) {
      return {
        ok: false as const,
        error: `Guest count (${guests}) exceeds maximum capacity of ${apartment.maxGuests} for ${apartment.name}.`,
        status: 400 as const,
      };
    }

    // Availability validation against active confirmed or pending bookings
    if (
      hasBookingConflict(apartment.id, input.checkIn, input.checkOut, db.bookings) ||
      hasBlockedDateConflict(apartment.id, input.checkIn, input.checkOut, db.blockedDates)
    ) {
      return {
        ok: false as const,
        error:
          'Selected dates conflict with an existing reservation or unavailable period.',
        status: 409 as const,
      };
    }

    const nightlyRate = apartment.pricePerNight;
    const cleaningFee = apartment.cleaningFee;
    const serviceFee = apartment.serviceFee;
    const totalAmount = nights * nightlyRate + cleaningFee + serviceFee;

    const now = new Date();
    const nowIso = now.toISOString();
    const holdMinutes = db.realtorConfig.bookingHoldMinutes || 60;
    const holdExpiresAt = new Date(now.getTime() + holdMinutes * 60 * 1000).toISOString();

    const checkoutReference = `CHK-${now.getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const checkoutId = `chk-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;

    const newCheckout: BookingCheckoutAttemptRecord = {
      id: checkoutId,
      checkoutReference,
      idempotencyKey: input.idempotencyKey || null,
      clientId: db.realtorConfig.clientId,
      apartmentId: apartment.id,
      unitId: apartment.id,
      guestName,
      guestEmail,
      guestPhone,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guestCount: guests,
      nightlyRate,
      cleaningFee,
      serviceFee,
      totalAmount,
      currency: 'NGN',
      paymentMethod: input.paymentMethod,
      specialRequests: input.specialRequests?.trim() || '',
      status: 'PendingCheckout',
      paystackReference: null,
      paystackAccessCode: null,
      paystackAuthorizationUrl: null,
      paystackMode: null,
      receiptStorageKey: null,
      receiptOriginalFilename: null,
      receiptMimeType: null,
      receiptSizeBytes: null,
      receiptUploadedAt: null,
      finalizedBookingId: null,
      finalizedBookingReference: null,
      finalizedCustomerId: null,
      finalizedPaymentId: null,
      holdExpiresAt,
      failureOrReconciliationNote: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.checkoutAttempts.unshift(newCheckout);

    return {
      ok: true as const,
      checkout: newCheckout,
      message: `Checkout attempt ${checkoutReference} initialized.`,
    };
  });
}

export interface UploadReceiptInput {
  checkoutId?: string;
  checkoutAttemptId?: string;
  filename?: string;
  originalFilename?: string;
  mimeType: string;
  sizeBytes: number;
  base64Data: string;
  uploaderEmail?: string;
}

export function uploadBankTransferReceipt(
  firstArg: string | UploadReceiptInput,
  secondArg?: Partial<UploadReceiptInput>
):
  | {
      ok: true;
      storageKey: string;
      receiptKey: string;
      checkout: BookingCheckoutAttemptRecord;
      message: string;
    }
  | { ok: false; error: string; status: 400 | 404 | 409 } {
  let input: UploadReceiptInput;
  if (typeof firstArg === 'string') {
    input = {
      checkoutId: firstArg,
      ...(secondArg || {}),
      filename: secondArg?.filename || secondArg?.originalFilename || 'transfer-receipt',
      mimeType: secondArg?.mimeType || '',
      sizeBytes: secondArg?.sizeBytes || 0,
      base64Data: secondArg?.base64Data || '',
    };
  } else {
    input = {
      ...firstArg,
      checkoutId: firstArg.checkoutId || firstArg.checkoutAttemptId,
      filename: firstArg.filename || firstArg.originalFilename || 'transfer-receipt',
    };
  }

  const normMime = input.mimeType?.toLowerCase().trim() || '';
  if (!ALLOWED_RECEIPT_MIME_TYPES.has(normMime)) {
    return {
      ok: false,
      error:
        'Invalid receipt file format. Allowed formats: PNG, JPG/JPEG, WEBP, and PDF.',
      status: 400,
    };
  }

  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_RECEIPT_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `Receipt file exceeds the maximum allowed size of 5 MB.`,
      status: 400,
    };
  }

  if (!input.base64Data || input.base64Data.length < 10) {
    return {
      ok: false,
      error: 'Receipt file payload is empty or invalid.',
      status: 400,
    };
  }

  return withDatabaseTransaction((db) => {
    const targetId = input.checkoutId || input.checkoutAttemptId;
    const checkout = db.checkoutAttempts.find((c) => c.id === targetId);
    if (!checkout) {
      return {
        ok: false as const,
        error: 'Associated checkout attempt not found.',
        status: 404 as const,
      };
    }

    if (checkout.status === 'Finalized') {
      return {
        ok: false as const,
        error: 'This checkout attempt has already been finalized.',
        status: 409 as const,
      };
    }

    const nowIso = new Date().toISOString();
    const safeFilename = input.filename?.trim() || 'transfer-receipt.png';
    const cleanExt = safeFilename.split('.').pop()?.toLowerCase() || 'png';
    const storageKey = `rcpt-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.${cleanExt}`;

    const receiptRecord: PrivateReceiptFileRecord = {
      storageKey,
      checkoutId: checkout.id,
      bookingId: null,
      bookingReference: null,
      customerId: null,
      originalFilename: safeFilename,
      mimeType: normMime,
      sizeBytes: input.sizeBytes,
      base64Data: input.base64Data,
      uploadedByEmail: input.uploaderEmail || checkout.guestEmail,
      createdAt: nowIso,
    };

    db.privateReceipts.unshift(receiptRecord);

    checkout.receiptStorageKey = storageKey;
    checkout.receiptOriginalFilename = receiptRecord.originalFilename;
    checkout.receiptMimeType = normMime;
    checkout.receiptSizeBytes = input.sizeBytes;
    checkout.receiptUploadedAt = nowIso;
    checkout.status = 'ReceiptUploaded';
    checkout.updatedAt = nowIso;

    db.auditLogs.unshift({
      id: `aud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      clientId: db.realtorConfig.clientId,
      actorUserId: 'customer',
      actorEmail: checkout.guestEmail,
      actorRole: 'CUSTOMER',
      action: 'UPLOAD_BANK_TRANSFER_RECEIPT',
      targetType: 'TRANSFER_RECEIPT',
      targetId: storageKey,
      metadataJson: JSON.stringify({
        checkoutId: checkout.id,
        filename: receiptRecord.originalFilename,
        sizeBytes: input.sizeBytes,
      }),
      createdAt: nowIso,
    });

    return {
      ok: true as const,
      storageKey,
      receiptKey: storageKey,
      checkout,
      message: 'Receipt uploaded successfully and saved to private storage.',
    };
  });
}

export interface SubmitBankTransferCheckoutInput {
  checkoutId?: string;
  checkoutAttemptId?: string;
  receiptKey?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  specialRequests?: string;
}

export function submitBankTransferCheckout(
  input: SubmitBankTransferCheckoutInput
):
  | {
      ok: true;
      booking: Booking;
      payment: PaymentRecord;
      devModeVerificationCode: string | null;
      idempotentReplay: boolean;
      message: string;
    }
  | {
      ok: false;
      error: string;
      conflict?: boolean;
      conflictResolution?: { receiptKey: string; checkoutId: string; message?: string };
      status: 400 | 404 | 409;
    } {
  return withDatabaseTransaction((db) => {
    const targetCheckoutId = input.checkoutId || input.checkoutAttemptId;
    if (!targetCheckoutId) {
      return {
        ok: false as const,
        error: 'Checkout attempt ID is required.',
        status: 400 as const,
      };
    }

    const checkout = db.checkoutAttempts.find((c) => c.id === targetCheckoutId);
    if (!checkout) {
      return {
        ok: false as const,
        error: 'Checkout attempt not found.',
        status: 404 as const,
      };
    }

    if (input.receiptKey && !checkout.receiptStorageKey) {
      checkout.receiptStorageKey = input.receiptKey;
    }

    // IDEMPOTENCY GUARD: If already finalized, return existing booking without duplicates
    if (checkout.status === 'Finalized' && checkout.finalizedBookingId) {
      const existingBooking = db.bookings.find(
        (b) => b.id === checkout.finalizedBookingId
      );
      const existingPayment = db.payments.find(
        (p) => p.id === checkout.finalizedPaymentId
      );
      if (existingBooking && existingPayment) {
        return {
          ok: true as const,
          booking: existingBooking,
          payment: existingPayment,
          devModeVerificationCode: null,
          idempotentReplay: true,
          message: 'Booking request already submitted (idempotent submission).',
        };
      }
    }

    // Receipt verification check
    if (!checkout.receiptStorageKey) {
      return {
        ok: false as const,
        error:
          'Proof of payment transfer receipt must be uploaded before submitting.',
        status: 400 as const,
      };
    }

    const receipt = db.privateReceipts.find(
      (r) => r.storageKey === checkout.receiptStorageKey
    );
    if (!receipt) {
      return {
        ok: false as const,
        error: 'Uploaded receipt could not be located in private storage.',
        status: 400 as const,
      };
    }

    const guestName = input.guestName?.trim() || checkout.guestName;
    const guestEmail = (input.guestEmail?.trim() || checkout.guestEmail).toLowerCase();
    const guestPhone = input.guestPhone?.trim() || checkout.guestPhone;

    // REVALIDATE APARTMENT AVAILABILITY
    const apartment = db.apartments.find((a) => a.id === checkout.apartmentId);
    if (!apartment) {
      return {
        ok: false as const,
        error: 'Apartment unit not found.',
        status: 404 as const,
      };
    }

    const hasConflict =
      hasBookingConflict(apartment.id, checkout.checkIn, checkout.checkOut, db.bookings) ||
      hasBlockedDateConflict(apartment.id, checkout.checkIn, checkout.checkOut, db.blockedDates);

    if (hasConflict) {
      // PRESERVE RECEIPT FOR CONCIERGE RECONCILIATION without creating invalid booking
      checkout.status = 'ConflictReconciliation';
      checkout.failureOrReconciliationNote =
        'Selected dates became unavailable prior to receipt submission. Receipt securely preserved for admin reconciliation.';
      checkout.updatedAt = new Date().toISOString();

      return {
        ok: false as const,
        conflict: true,
        conflictResolution: {
          receiptKey: checkout.receiptStorageKey || input.receiptKey || '',
          checkoutId: checkout.id,
          message:
            'Selected dates were claimed before receipt submission. Receipt securely preserved for concierge reconciliation.',
        },
        error:
          'These dates were claimed before your transfer receipt submission was finalized. Your receipt has been securely preserved in our system for administrator concierge reconciliation.',
        status: 409 as const,
      };
    }

    const nowIso = new Date().toISOString();

    // 4. Create or associate customer account only now
    const customer = findOrCreateCustomerInTransaction(db, {
      fullName: guestName,
      email: guestEmail,
      phone: guestPhone,
    });

    // 5. Generate unique booking reference
    let bookingReference = generateBookingReference();
    while (db.bookings.some((b) => b.bookingReference === bookingReference)) {
      bookingReference = generateBookingReference();
    }

    const bookingId = `bk-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;

    // 6. Create Booking in PendingApproval status
    const newBooking: Booking = {
      id: bookingId,
      clientId: db.realtorConfig.clientId,
      reference: bookingReference,
      bookingReference,
      apartmentId: apartment.id,
      unitId: apartment.id,
      propertyId: apartment.propertyId,
      customerId: customer.id,
      guestName: customer.fullName,
      guestEmail: customer.email,
      guestPhone: customer.phone,
      checkIn: checkout.checkIn,
      checkOut: checkout.checkOut,
      guests: checkout.guestCount,
      guestCount: checkout.guestCount,
      nightlyRate: checkout.nightlyRate,
      cleaningFee: checkout.cleaningFee,
      serviceFee: checkout.serviceFee,
      totalPrice: checkout.totalAmount,
      totalAmount: checkout.totalAmount,
      depositRequiredAmount: checkout.totalAmount,
      amountPaid: 0,
      balanceAmount: checkout.totalAmount,
      currency: 'NGN',
      status: 'PendingApproval',
      bookingStatus: 'PendingApproval',
      paymentMethod: 'BankTransfer',
      paymentStatus: 'AwaitingVerification',
      receiptVerificationStatus: 'PendingReview',
      receiptStorageKey: checkout.receiptStorageKey,
      receiptOriginalFilename: checkout.receiptOriginalFilename,
      receiptMimeType: checkout.receiptMimeType,
      approvedByUserId: null,
      approvedAt: null,
      rejectionReason: null,
      holdExpiresAt: checkout.holdExpiresAt,
      checkoutAttemptId: checkout.id,
      paymentPolicySnapshot: 'FullPayment',
      source: 'ONLINE',
      specialRequests: input.specialRequests?.trim() || checkout.specialRequests,
      adminNotes: 'Submitted via Bank Transfer with uploaded receipt.',
      checkInInstructions:
        apartment.checkInInstructions || db.realtorConfig.defaultCheckInInstructions,
      statusHistory: [
        {
          status: 'PendingApproval',
          timestamp: nowIso,
          note: 'Bank transfer receipt uploaded. Booking is Pending Admin Review & Manual Approval.',
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.bookings.unshift(newBooking);

    // 7. Create PaymentRecord with BankTransfer, AwaitingVerification & PendingReview
    const paymentId = `pay-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const paymentRecord: PaymentRecord = {
      id: paymentId,
      clientId: db.realtorConfig.clientId,
      bookingId: newBooking.id,
      bookingReference: newBooking.bookingReference,
      customerId: customer.id,
      paymentMethod: 'BankTransfer',
      provider: 'BankTransfer',
      mode: 'BANK_TRANSFER_RECEIPT',
      reference: `TRF_${bookingReference.replace(/[^A-Z0-9]/gi, '')}_${Date.now().toString(36).toUpperCase()}`,
      providerReference: `TRF_${bookingReference.replace(/[^A-Z0-9]/gi, '')}_${Date.now().toString(36).toUpperCase()}`,
      authorizationUrl: '',
      accessCode: '',
      amount: newBooking.totalPrice,
      amountKobo: Math.round(newBooking.totalPrice * 100),
      currency: 'NGN',
      paymentType: 'BankTransfer',
      status: 'AwaitingVerification',
      paymentStatus: 'AwaitingVerification',
      receiptVerificationStatus: 'PendingReview',
      receiptStorageKey: checkout.receiptStorageKey,
      receiptOriginalFilename: checkout.receiptOriginalFilename,
      receiptMimeType: checkout.receiptMimeType,
      verifiedByUserId: null,
      verifiedAt: null,
      rejectionReason: null,
      channel: 'bank_transfer',
      gatewayResponse: 'Receipt uploaded by customer; awaiting administrator verification.',
      paidAt: null,
      rawResponseSummary: JSON.stringify({
        checkoutId: checkout.id,
        storageKey: checkout.receiptStorageKey,
      }),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.payments.unshift(paymentRecord);

    // 8. Associate private receipt with newly created booking
    receipt.bookingId = newBooking.id;
    receipt.bookingReference = newBooking.bookingReference;
    receipt.customerId = customer.id;

    // 9. Update checkout attempt to Finalized
    checkout.status = 'Finalized';
    checkout.finalizedBookingId = newBooking.id;
    checkout.finalizedBookingReference = newBooking.bookingReference;
    checkout.finalizedCustomerId = customer.id;
    checkout.finalizedPaymentId = paymentRecord.id;
    checkout.updatedAt = nowIso;

    // 10. Issue secure 6-digit access code (SHA-256 hashed)
    const issuedCredential = issueBookingVerificationCredentialInTransaction(db, {
      booking: newBooking,
      customer,
      template: 'BOOKING_CREATED_CODE',
    });

    db.notifications.unshift({
      id: `notif-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      clientId: db.realtorConfig.clientId,
      bookingId: newBooking.id,
      bookingReference: newBooking.bookingReference,
      customerId: customer.id,
      recipientEmail: customer.email,
      recipientPhone: customer.phone,
      channel: 'Both',
      template: 'RECEIPT_SUBMITTED_PENDING_REVIEW',
      subject: `Receipt Submitted for Booking ${newBooking.bookingReference} — Awaiting Admin Review`,
      messagePreview: `Hello ${customer.fullName}, your bank transfer receipt for booking ${newBooking.bookingReference} has been received. Our team will verify the payment and approve your booking shortly.`,
      devModeCodePreview: issuedCredential.notification.devModeCodePreview,
      deliveryStatus: 'SimulatedInDev',
      createdAt: nowIso,
    });

    db.auditLogs.unshift({
      id: `aud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      clientId: db.realtorConfig.clientId,
      actorUserId: customer.id,
      actorEmail: customer.email,
      actorRole: 'CUSTOMER',
      action: 'SUBMIT_BANK_TRANSFER_BOOKING',
      targetType: 'BOOKING',
      targetId: newBooking.id,
      metadataJson: JSON.stringify({
        bookingReference: newBooking.bookingReference,
        checkoutId: checkout.id,
        receiptStorageKey: checkout.receiptStorageKey,
        totalAmount: newBooking.totalAmount,
      }),
      createdAt: nowIso,
    });

    return {
      ok: true as const,
      booking: newBooking,
      payment: paymentRecord,
      devModeVerificationCode: issuedCredential.notification.devModeCodePreview,
      idempotentReplay: false,
      message: `Booking ${newBooking.bookingReference} submitted. Transfer receipt is Pending Review and booking is Pending Approval.`,
    };
  });
}

export function getPrivateReceiptRecord(
  storageKey: string,
  auth: { actorUserId?: string; sessionToken?: string }
):
  | { ok: true; receipt: PrivateReceiptFileRecord }
  | { ok: false; error: string; status: 401 | 403 | 404 } {
  const cleanKey = storageKey?.trim();
  if (!cleanKey) {
    return { ok: false, error: 'Receipt storage key is required.', status: 400 as any };
  }

  const db = readDatabase();
  const receipt = db.privateReceipts.find((r) => r.storageKey === cleanKey);
  if (!receipt) {
    return { ok: false, error: 'Receipt record not found.', status: 404 };
  }

  // If neither credential provided, return 401
  if (!auth.actorUserId && !auth.sessionToken) {
    return {
      ok: false,
      error: 'Authentication required. Admin login or valid booking session token needed.',
      status: 401,
    };
  }

  // 1. If requester is a Realtor Admin, grant access
  if (auth.actorUserId) {
    const adminCheck = requireRealtorAdmin(auth.actorUserId);
    if (adminCheck.ok) {
      return { ok: true, receipt };
    }
  }

  // 2. If requester is a verified customer with session token for this booking
  if (auth.sessionToken) {
    const sessionCheck = getVerifiedBookingBySessionToken(auth.sessionToken);
    if (sessionCheck.ok) {
      if (
        receipt.bookingId === sessionCheck.rawBooking.id ||
        receipt.bookingReference === sessionCheck.rawBooking.bookingReference
      ) {
        return { ok: true, receipt };
      }
    }
  }

  return {
    ok: false,
    error: 'Unauthorized: You do not have permission to view this receipt.',
    status: 403,
  };
}
