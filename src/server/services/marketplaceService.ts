import crypto from 'crypto';
import { readDatabase, withDatabaseTransaction } from '@/server/db/database';
import {
  ApartmentUnitRecord,
  PropertyRecord,
  PaymentRecord,
} from '@/server/db/schema';
import {
  Apartment,
  BlockedDate,
  Booking,
  BookingSource,
  BookingStatus,
  PaymentStatus,
} from '@/types';
import {
  getPublicUnavailableIntervals,
  hasBlockedDateConflict,
  hasBookingConflict,
} from '@/lib/availability';
import { calculateNights, generateBookingReference } from '@/lib/utils';
import { getAdminById, requireRealtorAdmin, toPublicAdminProfile } from './authService';
import {
  findOrCreateCustomerInTransaction,
  issueBookingVerificationCredentialInTransaction,
  getVerifiedBookingBySessionToken,
  buildCustomerBookingVerifiedView,
  hasCustomerMadePayment,
} from './customerAndVerificationService';
import { isEmailDeliveryConfigured, queueBookingEmail } from './emailService';

export function getPublicMarketplaceListings(): ApartmentUnitRecord[] {
  const db = readDatabase();
  return db.apartments.filter((apt) => apt.status === 'active');
}

export function getPublicAvailabilityPayload(apartmentId?: string) {
  const db = readDatabase();
  const activeApartments = db.apartments.filter((apt) => apt.status === 'active');
  const activeIds = new Set(activeApartments.map((a) => a.id));

  const scopedBookings = db.bookings.filter((b) => activeIds.has(b.apartmentId));
  const scopedBlocked = db.blockedDates.filter((bl) => activeIds.has(bl.apartmentId));

  const intervals = getPublicUnavailableIntervals(
    scopedBookings,
    scopedBlocked,
    apartmentId
  );

  return {
    generatedAt: new Date().toISOString(),
    privacyNotice:
      'Sanitized public availability feed. Personal guest data, booking references, payment amounts, and internal block reasons are strictly omitted.',
    apartments: activeApartments.map((apt) => ({
      id: apt.id,
      name: apt.name,
      slug: apt.slug,
      location: apt.location,
      city: apt.city,
      area: apt.area,
      unitType: apt.unitType,
      pricePerNight: apt.pricePerNight,
      cleaningFee: apt.cleaningFee,
      serviceFee: apt.serviceFee,
      minStay: apt.minStay,
      maxGuests: apt.maxGuests,
      bedrooms: apt.bedrooms,
      bathrooms: apt.bathrooms,
    })),
    unavailableIntervals: intervals,
  };
}

export interface CreateCustomerBookingInput {
  id?: string;
  bookingReference?: string;
  apartmentId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  specialRequests?: string;
  source?: BookingSource;
  initialStatus?: BookingStatus;
  initialPaymentStatus?: PaymentStatus;
  amountPaid?: number;
  adminNotes?: string;
  customVerificationExpiryMinutes?: number;
}

/**
 * Restricts an untrusted (public) booking request to guest-supplied fields so
 * visitors cannot set status, payment, source, notes, ids or references.
 */
export function pickPublicBookingInput(raw: Record<string, unknown>): CreateCustomerBookingInput {
  return {
    apartmentId: String(raw.apartmentId ?? ''),
    guestName: String(raw.guestName ?? ''),
    guestEmail: String(raw.guestEmail ?? ''),
    guestPhone: String(raw.guestPhone ?? ''),
    checkIn: String(raw.checkIn ?? ''),
    checkOut: String(raw.checkOut ?? ''),
    guests: Number(raw.guests ?? raw.guestCount) || 0,
    specialRequests: typeof raw.specialRequests === 'string' ? raw.specialRequests : undefined,
  };
}

export function createCustomerBookingRequest(
  input: CreateCustomerBookingInput
):
  | {
      ok: true;
      booking: Booking;
      customerId: string;
      verificationCodeExpiresAt: string;
      /**
       * Provided in development/test mode so evaluators can immediately test
       * /my-booking without an external SMS/email gateway.
       */
      devModeVerificationCode: string | null;
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
      error: 'Check-out date must be after the check-in date.',
      status: 400,
    };
  }

  return withDatabaseTransaction((db) => {
    const apartment = db.apartments.find((a) => a.id === input.apartmentId);
    if (!apartment) {
      return {
        ok: false as const,
        error: 'Selected apartment unit was not found.',
        status: 404 as const,
      };
    }

    const isExternalAdminEntry =
      input.source && input.source !== 'ONLINE';

    if (apartment.status !== 'active' && !isExternalAdminEntry) {
      return {
        ok: false as const,
        error: 'This apartment unit is currently inactive and unavailable for online booking.',
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
        error: `Guest count (${guests}) exceeds the maximum capacity of ${apartment.maxGuests} guests for ${apartment.name}.`,
        status: 400 as const,
      };
    }

    // Check overlapping bookings (inclusive checkIn, exclusive checkOut)
    if (
      hasBookingConflict(
        apartment.id,
        input.checkIn,
        input.checkOut,
        db.bookings
      ) ||
      hasBlockedDateConflict(
        apartment.id,
        input.checkIn,
        input.checkOut,
        db.blockedDates
      )
    ) {
      return {
        ok: false as const,
        error:
          'Selected dates conflict with an existing reservation or unavailable period. Please choose different dates.',
        status: 409 as const,
      };
    }

    // Create or match Customer without requiring password
    const customer = findOrCreateCustomerInTransaction(db, {
      fullName: guestName,
      email: guestEmail,
      phone: guestPhone,
    });

    // Snapshot agreed pricing at the time of booking
    const nightlyRate = apartment.pricePerNight;
    const cleaningFee = apartment.cleaningFee;
    const serviceFee = apartment.serviceFee;
    const totalPrice = nights * nightlyRate + cleaningFee + serviceFee;

    const policy = db.realtorConfig.paymentPolicy;
    const depositPct = db.realtorConfig.depositPercentage || 50;
    const depositRequiredAmount =
      policy === 'Deposit'
        ? Math.round((totalPrice * depositPct) / 100)
        : totalPrice;

    const amountPaid = Math.min(totalPrice, Math.max(0, Number(input.amountPaid) || 0));
    const balanceAmount = Math.max(0, totalPrice - amountPaid);

    let paymentStatus: PaymentStatus = input.initialPaymentStatus || 'Unpaid';
    if (amountPaid >= totalPrice) {
      paymentStatus = 'Paid';
    } else if (amountPaid > 0) {
      paymentStatus = 'Partially Paid';
    }

    // Ensure unique BookingReference
    let bookingReference = input.bookingReference?.trim().toUpperCase() || generateBookingReference();
    while (db.bookings.some((b) => b.bookingReference.toUpperCase() === bookingReference)) {
      bookingReference = generateBookingReference();
    }

    const nowIso = new Date().toISOString();
    const initialStatus = input.initialStatus || 'PendingApproval';
    const newBooking: Booking = {
      id: input.id || `bk-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
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
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests,
      guestCount: guests,
      nightlyRate,
      cleaningFee,
      serviceFee,
      totalPrice,
      totalAmount: totalPrice,
      depositRequiredAmount,
      amountPaid,
      balanceAmount,
      currency: 'NGN',
      status: initialStatus,
      bookingStatus: initialStatus,
      paymentMethod: 'Paystack',
      paymentStatus,
      receiptVerificationStatus: 'NotApplicable',
      receiptStorageKey: null,
      approvedByUserId: null,
      approvedAt: null,
      rejectionReason: null,
      holdExpiresAt: null,
      paymentPolicySnapshot: policy,
      source: input.source || 'ONLINE',
      specialRequests: input.specialRequests?.trim() || '',
      adminNotes: input.adminNotes?.trim() || '',
      checkInInstructions:
        apartment.checkInInstructions || db.realtorConfig.defaultCheckInInstructions,
      statusHistory: [
        {
          status: initialStatus,
          timestamp: nowIso,
          note:
            input.adminNotes?.trim() ||
            'Booking request created and verification code dispatched to customer.',
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.bookings.unshift(newBooking);

    // Issue cryptographically generated SHA-256 hashed verification code
    const issuedCredential = issueBookingVerificationCredentialInTransaction(db, {
      booking: newBooking,
      customer,
      template: 'BOOKING_CREATED_CODE',
      customExpiryMinutes: input.customVerificationExpiryMinutes,
    });

    db.auditLogs.unshift({
      id: `aud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      clientId: db.realtorConfig.clientId,
      actorUserId: customer.id,
      actorEmail: customer.email,
      actorRole: 'CUSTOMER',
      action:
        newBooking.source === 'ONLINE'
          ? 'CREATE_CUSTOMER_BOOKING'
          : `CREATE_EXTERNAL_BOOKING_${newBooking.source}`,
      targetType: 'BOOKING',
      targetId: newBooking.id,
      metadataJson: JSON.stringify({
        bookingReference: newBooking.bookingReference,
        apartmentId: newBooking.apartmentId,
        checkIn: newBooking.checkIn,
        checkOut: newBooking.checkOut,
        totalPrice: newBooking.totalPrice,
        source: newBooking.source,
        status: newBooking.status,
        paymentStatus: newBooking.paymentStatus,
      }),
      createdAt: nowIso,
    });

    return {
      ok: true as const,
      booking: newBooking,
      customerId: customer.id,
      verificationCodeExpiresAt: issuedCredential.credential.expiresAt,
      devModeVerificationCode: issuedCredential.notification.devModeCodePreview,
      message: `Booking ${newBooking.bookingReference} created and verification code issued.`,
    };
  });
}

export function createExternalBookingByAdmin(
  actorUserId: string | undefined,
  input: CreateCustomerBookingInput
) {
  const auth = requireRealtorAdmin(actorUserId);
  if (!auth.ok) {
    return auth;
  }

  return createCustomerBookingRequest({
    ...input,
    source: input.source || 'WHATSAPP',
    initialStatus: input.initialStatus || 'Confirmed',
  });
}

export function updateBookingStatus(
  actorUserId: string | undefined,
  bookingId: string,
  newStatus: BookingStatus,
  adminNotes?: string,
  newPaymentStatus?: PaymentStatus
):
  | { ok: true; booking: Booking; message: string }
  | { ok: false; error: string; status: 400 | 401 | 403 | 404 | 409 } {
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

    // MANDATORY ADMIN APPROVAL RULE: Enforce payment conditions before approving/confirming
    if (newStatus === 'Confirmed' && booking.status !== 'Confirmed') {
      const isBankTransfer = booking.paymentMethod === 'BankTransfer';
      if (isBankTransfer) {
        const isReceiptVerified = booking.receiptVerificationStatus === 'Verified';
        const isPaid = (newPaymentStatus || booking.paymentStatus) === 'Paid';
        if (!isReceiptVerified || !isPaid) {
          return {
            ok: false as const,
            error:
              'Cannot confirm a Bank Transfer booking until the transfer receipt has been verified by an administrator.',
            status: 409 as const,
          };
        }
      } else {
        // Paystack
        const isPaid = (newPaymentStatus || booking.paymentStatus) === 'Paid';
        if (!isPaid) {
          return {
            ok: false as const,
            error:
              'Cannot confirm a Paystack booking until payment has been verified server-side.',
            status: 409 as const,
          };
        }
      }

      // Re-check availability before confirming a booking
      const otherBookings = db.bookings.filter((b) => b.id !== booking.id);
      if (
        hasBookingConflict(
          booking.apartmentId,
          booking.checkIn,
          booking.checkOut,
          otherBookings,
          booking.id
        ) ||
        hasBlockedDateConflict(
          booking.apartmentId,
          booking.checkIn,
          booking.checkOut,
          db.blockedDates
        )
      ) {
        return {
          ok: false as const,
          error:
            'Cannot confirm this booking because the selected dates now conflict with another reservation or blocked period.',
          status: 409 as const,
        };
      }
    }

    const nowIso = new Date().toISOString();
    booking.status = newStatus;
    booking.bookingStatus = newStatus;

    if (newStatus === 'Confirmed') {
      booking.approvedByUserId = auth.actor.id;
      booking.approvedAt = nowIso;
    } else if (newStatus === 'Rejected') {
      booking.rejectionReason = adminNotes?.trim() || 'Booking request rejected by administrator.';
    }

    if (newPaymentStatus) {
      booking.paymentStatus = newPaymentStatus;
      if (newPaymentStatus === 'Paid') {
        booking.amountPaid = booking.totalPrice;
        booking.balanceAmount = 0;
      }
    }
    if (adminNotes !== undefined) {
      booking.adminNotes = adminNotes.trim();
    }
    booking.updatedAt = nowIso;

    const sendConfirmationEmail = newStatus === 'Confirmed' && isEmailDeliveryConfigured();
    const statusNotification = {
      id: `notif-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      clientId: db.realtorConfig.clientId,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      customerId: booking.customerId || 'cust-unknown',
      recipientEmail: booking.guestEmail,
      recipientPhone: booking.guestPhone,
      channel: 'Both' as const,
      template: 'BOOKING_STATUS_UPDATED' as const,
      subject:
        newStatus === 'Confirmed'
          ? `Your booking ${booking.bookingReference} is confirmed — ${db.realtorConfig.businessName}`
          : `Booking ${booking.bookingReference} Status Updated to ${booking.status}`,
      messagePreview: `Dear ${booking.guestName}, your booking ${booking.bookingReference} is now ${booking.status} (Payment status: ${booking.paymentStatus}).`,
      devModeCodePreview: null,
      deliveryStatus: sendConfirmationEmail ? ('Queued' as const) : ('SimulatedInDev' as const),
      createdAt: nowIso,
    };
    db.notifications.unshift(statusNotification);

    if (sendConfirmationEmail) {
      queueBookingEmail({
        kind: 'BOOKING_CONFIRMED',
        notificationId: statusNotification.id,
        recipientEmail: booking.guestEmail,
        subject: statusNotification.subject,
        accessCode: null,
        booking: buildCustomerBookingVerifiedView(db, booking),
      });
    }

    db.auditLogs.unshift({
      id: `aud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      clientId: db.realtorConfig.clientId,
      actorUserId: auth.actor.id,
      actorEmail: auth.actor.email,
      actorRole: auth.actor.role,
      action: `UPDATE_BOOKING_STATUS_${newStatus.toUpperCase()}`,
      targetType: 'BOOKING',
      targetId: booking.id,
      metadataJson: JSON.stringify({
        bookingReference: booking.bookingReference,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
      }),
      createdAt: nowIso,
    });

    return {
      ok: true as const,
      booking,
      message: `Booking ${booking.bookingReference} updated to ${booking.status}.`,
    };
  });
}

export function reviewBankTransferReceipt(
  actorUserId: string | undefined,
  bookingId: string,
  action: 'VERIFY' | 'REJECT',
  rejectionReason?: string
):
  | { ok: true; booking: Booking; payment: PaymentRecord; message: string }
  | { ok: false; error: string; status: 400 | 401 | 403 | 404 | 409 } {
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

    if (booking.paymentMethod !== 'BankTransfer') {
      return {
        ok: false as const,
        error: 'This booking was not submitted via Bank Transfer.',
        status: 400 as const,
      };
    }

    const payment = db.payments.find(
      (p) => p.bookingId === booking.id && p.paymentMethod === 'BankTransfer'
    );
    if (!payment) {
      return {
        ok: false as const,
        error: 'Associated bank transfer payment record not found.',
        status: 404 as const,
      };
    }

    const nowIso = new Date().toISOString();

    if (action === 'VERIFY') {
      payment.receiptVerificationStatus = 'Verified';
      payment.paymentStatus = 'Paid';
      payment.status = 'Success';
      payment.verifiedByUserId = auth.actor.id;
      payment.verifiedAt = nowIso;
      payment.rejectionReason = null;
      payment.paidAt = nowIso;
      payment.gatewayResponse = `Transfer receipt verified by Realtor Admin (${auth.actor.email})`;
      payment.updatedAt = nowIso;

      booking.receiptVerificationStatus = 'Verified';
      booking.paymentStatus = 'Paid';
      booking.amountPaid = booking.totalPrice;
      booking.balanceAmount = 0;
      booking.rejectionReason = null;
      // CRITICAL: The booking MUST remain PendingApproval until explicitly approved by the admin!
      if (booking.status === 'Pending') {
        booking.status = 'PendingApproval';
        booking.bookingStatus = 'PendingApproval';
      }
      booking.updatedAt = nowIso;

      booking.statusHistory.push({
        status: booking.status,
        timestamp: nowIso,
        note: `Bank transfer receipt verified by ${auth.actor.fullName}. Booking remains PendingApproval awaiting final approval.`,
      });

      db.notifications.unshift({
        id: `notif-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
        clientId: db.realtorConfig.clientId,
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        customerId: booking.customerId || 'cust-unknown',
        recipientEmail: booking.guestEmail,
        recipientPhone: booking.guestPhone,
        channel: 'Both',
        template: 'RECEIPT_VERIFIED',
        subject: `Payment Verified for Booking ${booking.bookingReference}`,
        messagePreview: `Your bank transfer receipt for booking ${booking.bookingReference} has been verified. Your booking is awaiting final administrator approval.`,
        devModeCodePreview: null,
        deliveryStatus: 'SimulatedInDev',
        createdAt: nowIso,
      });

      db.auditLogs.unshift({
        id: `aud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
        clientId: db.realtorConfig.clientId,
        actorUserId: auth.actor.id,
        actorEmail: auth.actor.email,
        actorRole: auth.actor.role,
        action: 'ADMIN_VERIFY_TRANSFER_RECEIPT',
        targetType: 'TRANSFER_RECEIPT',
        targetId: payment.id,
        metadataJson: JSON.stringify({
          bookingReference: booking.bookingReference,
          amount: payment.amount,
          verifiedBy: auth.actor.email,
        }),
        createdAt: nowIso,
      });

      return {
        ok: true as const,
        booking,
        payment,
        message: 'Bank transfer receipt marked as Verified. Booking remains Pending Admin Approval.',
      };
    } else {
      // REJECT
      const reason = rejectionReason?.trim() || 'Bank transfer receipt could not be validated against bank records.';
      payment.receiptVerificationStatus = 'Rejected';
      payment.paymentStatus = 'Rejected';
      payment.status = 'Failed';
      payment.rejectionReason = reason;
      payment.verifiedByUserId = auth.actor.id;
      payment.verifiedAt = nowIso;
      payment.gatewayResponse = `Receipt rejected: ${reason}`;
      payment.updatedAt = nowIso;

      booking.receiptVerificationStatus = 'Rejected';
      booking.paymentStatus = 'Rejected';
      booking.rejectionReason = reason;
      booking.updatedAt = nowIso;

      booking.statusHistory.push({
        status: booking.status,
        timestamp: nowIso,
        note: `Bank transfer receipt rejected by administrator: ${reason}`,
      });

      db.notifications.unshift({
        id: `notif-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
        clientId: db.realtorConfig.clientId,
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        customerId: booking.customerId || 'cust-unknown',
        recipientEmail: booking.guestEmail,
        recipientPhone: booking.guestPhone,
        channel: 'Both',
        template: 'RECEIPT_REJECTED',
        subject: `Transfer Receipt Update for Booking ${booking.bookingReference}`,
        messagePreview: `Your bank transfer receipt for booking ${booking.bookingReference} could not be verified: ${reason}`,
        devModeCodePreview: null,
        deliveryStatus: 'SimulatedInDev',
        createdAt: nowIso,
      });

      db.auditLogs.unshift({
        id: `aud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
        clientId: db.realtorConfig.clientId,
        actorUserId: auth.actor.id,
        actorEmail: auth.actor.email,
        actorRole: auth.actor.role,
        action: 'ADMIN_REJECT_TRANSFER_RECEIPT',
        targetType: 'TRANSFER_RECEIPT',
        targetId: payment.id,
        metadataJson: JSON.stringify({
          bookingReference: booking.bookingReference,
          reason,
          verifiedBy: auth.actor.email,
        }),
        createdAt: nowIso,
      });

      return {
        ok: true as const,
        booking,
        payment,
        message: `Transfer receipt marked as Rejected: ${reason}`,
      };
    }
  });
}

export function cancelBookingByVerifiedCustomer(
  sessionToken: string | undefined,
  reason?: string
):
  | { ok: true; booking: Booking; message: string }
  | { ok: false; error: string; status: 400 | 401 | 409 } {
  const verified = getVerifiedBookingBySessionToken(sessionToken);
  if (!verified.ok) {
    return verified;
  }

  return withDatabaseTransaction((db) => {
    const booking = db.bookings.find((b) => b.id === verified.rawBooking.id);
    if (!booking) {
      return {
        ok: false as const,
        error: 'Booking not found.',
        status: 401 as const,
      };
    }

    if (booking.status === 'Cancelled' || booking.status === 'Rejected') {
      return {
        ok: false as const,
        error: `This booking is already ${booking.status.toLowerCase()}.`,
        status: 409 as const,
      };
    }

    if (hasCustomerMadePayment(booking)) {
      return {
        ok: false as const,
        error:
          'This booking can no longer be cancelled online because a payment has been made. Please contact us for help.',
        status: 409 as const,
      };
    }

    const nowIso = new Date().toISOString();
    booking.status = 'Cancelled';
    if (reason?.trim()) {
      booking.specialRequests = `${booking.specialRequests ? booking.specialRequests + ' | ' : ''}Customer cancellation note: ${reason.trim()}`;
    }
    booking.updatedAt = nowIso;

    db.auditLogs.unshift({
      id: `aud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      clientId: db.realtorConfig.clientId,
      actorUserId: booking.customerId || 'customer',
      actorEmail: booking.guestEmail,
      actorRole: 'CUSTOMER',
      action: 'CUSTOMER_CANCELLED_BOOKING',
      targetType: 'BOOKING',
      targetId: booking.id,
      metadataJson: JSON.stringify({
        bookingReference: booking.bookingReference,
        reason: reason || 'Cancelled via /my-booking portal',
      }),
      createdAt: nowIso,
    });

    return {
      ok: true as const,
      booking,
      message: `Booking ${booking.bookingReference} has been cancelled and the dates have been released.`,
    };
  });
}

export function saveApartmentListing(
  actorUserId: string | undefined,
  apartmentData: Partial<ApartmentUnitRecord> & { name: string; city: string; pricePerNight: number }
):
  | { ok: true; apartment: ApartmentUnitRecord; message: string }
  | { ok: false; error: string; status: 400 | 401 | 403 | 404 } {
  const auth = requireRealtorAdmin(actorUserId);
  if (!auth.ok) {
    return auth;
  }

  return withDatabaseTransaction((db) => {
    const nowIso = new Date().toISOString();
    const clientId = db.realtorConfig.clientId;
    const existingIndex = apartmentData.id
      ? db.apartments.findIndex((a) => a.id === apartmentData.id)
      : -1;

    // Ensure parent property exists or create one if needed
    let propertyId = apartmentData.propertyId || db.properties[0]?.id || 'prop-ikoyi-1';
    let property = db.properties.find((p) => p.id === propertyId);
    if (!property) {
      property = {
        id: `prop-${Date.now().toString(36)}`,
        clientId,
        name: apartmentData.propertyName || `${apartmentData.name} Property`,
        slug: (apartmentData.propertyName || apartmentData.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-'),
        description: apartmentData.shortDescription || apartmentData.description || '',
        address: apartmentData.address || apartmentData.location || apartmentData.city,
        city: apartmentData.city,
        state: apartmentData.city === 'Abuja' ? 'FCT' : 'Lagos',
        status: 'ACTIVE',
        featuredImage:
          apartmentData.images?.[0] ||
          'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
        amenities: apartmentData.amenities || [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.properties.push(property);
      propertyId = property.id;
    }

    if (existingIndex >= 0) {
      const current = db.apartments[existingIndex];
      const nextStatus =
        apartmentData.status ||
        (typeof apartmentData.isActive === 'boolean'
          ? apartmentData.isActive
            ? 'active'
            : 'inactive'
          : current.status);
      const nextIsActive =
        typeof apartmentData.isActive === 'boolean'
          ? apartmentData.isActive
          : nextStatus === 'active';
      const updated: ApartmentUnitRecord = {
        ...current,
        ...apartmentData,
        clientId,
        propertyId,
        propertyName: apartmentData.propertyName || property.name,
        unitType: apartmentData.unitType || current.unitType || '2 Bedroom',
        area: apartmentData.area || apartmentData.neighborhood || current.area,
        neighborhood:
          apartmentData.neighborhood || apartmentData.area || current.neighborhood,
        status: nextStatus,
        isActive: nextIsActive,
        cautionDeposit: Number(
          apartmentData.cautionDeposit ?? current.cautionDeposit ?? 50000
        ),
        checkInInstructions:
          apartmentData.checkInInstructions ||
          current.checkInInstructions ||
          db.realtorConfig.defaultCheckInInstructions,
        availabilityRules: apartmentData.availabilityRules ||
          current.availabilityRules || {
            minNights: Number(apartmentData.minStay || current.minStay || 1),
            maxNights: 60,
            checkInTime: db.realtorConfig.defaultCheckInTime,
            checkOutTime: db.realtorConfig.defaultCheckOutTime,
          },
        updatedAt: nowIso,
      };
      db.apartments[existingIndex] = updated;

      return {
        ok: true as const,
        apartment: updated,
        message: `${updated.name} updated successfully.`,
      };
    }

    const nextStatus =
      apartmentData.status ||
      (apartmentData.isActive === false ? 'inactive' : 'active');
    const nextIsActive =
      typeof apartmentData.isActive === 'boolean'
        ? apartmentData.isActive
        : nextStatus === 'active';
    const minStay =
      Number(apartmentData.minStay) ||
      Number(apartmentData.availabilityRules?.minNights) ||
      1;

    const newApt: ApartmentUnitRecord = {
      id: apartmentData.id || `apt-${Date.now().toString(36)}`,
      clientId,
      propertyId,
      propertyName: apartmentData.propertyName || property.name,
      unitType: apartmentData.unitType || '2 Bedroom',
      name: apartmentData.name.trim(),
      slug:
        apartmentData.slug ||
        apartmentData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
      shortDescription: apartmentData.shortDescription || apartmentData.name,
      description:
        apartmentData.description || apartmentData.shortDescription || '',
      location:
        apartmentData.location ||
        `${apartmentData.area || apartmentData.neighborhood || apartmentData.city}, ${apartmentData.city}`,
      city: apartmentData.city,
      area:
        apartmentData.area ||
        apartmentData.neighborhood ||
        apartmentData.city,
      neighborhood:
        apartmentData.neighborhood ||
        apartmentData.area ||
        apartmentData.city,
      address:
        apartmentData.address ||
        `${apartmentData.area || ''}, ${apartmentData.city}`,
      pricePerNight: Number(apartmentData.pricePerNight) || 120000,
      cleaningFee: Number(apartmentData.cleaningFee) || 15000,
      serviceFee: Number(apartmentData.serviceFee) || 10000,
      cautionDeposit: Number(apartmentData.cautionDeposit) || 50000,
      minStay,
      maxGuests: Number(apartmentData.maxGuests) || 4,
      bedrooms: Number(apartmentData.bedrooms) || 2,
      bathrooms: Number(apartmentData.bathrooms) || 2,
      sizeSqm: Number(apartmentData.sizeSqm) || 120,
      images:
        apartmentData.images && apartmentData.images.length > 0
          ? apartmentData.images
          : [
              'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=85',
            ],
      amenities: apartmentData.amenities || [
        '24/7 Uninterrupted Power',
        'High-Speed Wi-Fi',
        '24/7 Security',
      ],
      houseRules: apartmentData.houseRules || [
        'Check-in after 2:00 PM',
        'Check-out before 11:00 AM',
        'No smoking indoors',
      ],
      checkInInstructions:
        apartmentData.checkInInstructions ||
        db.realtorConfig.defaultCheckInInstructions,
      availabilityRules: apartmentData.availabilityRules || {
        minNights: minStay,
        maxNights: 60,
        checkInTime: db.realtorConfig.defaultCheckInTime,
        checkOutTime: db.realtorConfig.defaultCheckOutTime,
      },
      status: nextStatus,
      isActive: nextIsActive,
      featured: Boolean(apartmentData.featured),
      rating: apartmentData.rating || 4.9,
      reviewCount: apartmentData.reviewCount || 1,
      approvalStatus: 'Approved',
      ownerName: db.realtorConfig.businessName,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.apartments.unshift(newApt);

    return {
      ok: true as const,
      apartment: newApt,
      message: `${newApt.name} added to realtor portfolio.`,
    };
  });
}

export function deleteApartmentListing(
  actorUserId: string | undefined,
  apartmentId: string
):
  | { ok: true; message: string }
  | { ok: false; error: string; status: 401 | 403 | 404 } {
  const auth = requireRealtorAdmin(actorUserId);
  if (!auth.ok) {
    return auth;
  }

  return withDatabaseTransaction((db) => {
    const idx = db.apartments.findIndex((a) => a.id === apartmentId);
    if (idx < 0) {
      return {
        ok: false as const,
        error: 'Apartment unit not found.',
        status: 404 as const,
      };
    }
    const removed = db.apartments[idx];
    db.apartments.splice(idx, 1);
    return {
      ok: true as const,
      message: `${removed.name} deleted.`,
    };
  });
}

export function addBlockedDateRange(
  actorUserId: string | undefined,
  blockInput: Omit<BlockedDate, 'id'> & { id?: string }
):
  | { ok: true; blockedDate: BlockedDate; message: string }
  | { ok: false; error: string; status: 400 | 401 | 403 | 409 } {
  const auth = requireRealtorAdmin(actorUserId);
  if (!auth.ok) {
    return auth;
  }

  if (!blockInput.apartmentId || !blockInput.startDate || !blockInput.endDate) {
    return {
      ok: false,
      error: 'Apartment unit, start date, and end date are required.',
      status: 400,
    };
  }

  if (blockInput.endDate < blockInput.startDate) {
    return {
      ok: false,
      error: 'End date cannot be earlier than start date.',
      status: 400,
    };
  }

  return withDatabaseTransaction((db) => {
    // Prevent blocking dates that conflict with confirmed bookings
    const confirmedBookings = db.bookings.filter((b) => b.status === 'Confirmed');
    const endExclusiveDate = new Date(`${blockInput.endDate}T00:00:00`);
    endExclusiveDate.setDate(endExclusiveDate.getDate() + 1);
    const endExclusiveStr = endExclusiveDate.toISOString().split('T')[0];

    if (
      hasBookingConflict(
        blockInput.apartmentId,
        blockInput.startDate,
        endExclusiveStr,
        confirmedBookings
      )
    ) {
      return {
        ok: false as const,
        error:
          'Cannot block these dates because they overlap with an existing confirmed reservation.',
        status: 409 as const,
      };
    }

    const newBlock: BlockedDate = {
      id: blockInput.id || `blk-${Date.now().toString(36)}`,
      apartmentId: blockInput.apartmentId,
      startDate: blockInput.startDate,
      endDate: blockInput.endDate,
      reason: blockInput.reason?.trim() || 'Maintenance / Owner Hold',
      createdAt: new Date().toISOString(),
    };

    db.blockedDates.push(newBlock);

    return {
      ok: true as const,
      blockedDate: newBlock,
      message: 'Dates blocked on availability calendar.',
    };
  });
}

export function removeBlockedDateRange(
  actorUserId: string | undefined,
  blockId: string
):
  | { ok: true; message: string }
  | { ok: false; error: string; status: 401 | 403 | 404 } {
  const auth = requireRealtorAdmin(actorUserId);
  if (!auth.ok) {
    return auth;
  }

  return withDatabaseTransaction((db) => {
    const idx = db.blockedDates.findIndex((b) => b.id === blockId);
    if (idx < 0) {
      return {
        ok: false as const,
        error: 'Blocked date record not found.',
        status: 404 as const,
      };
    }
    db.blockedDates.splice(idx, 1);
    return {
      ok: true as const,
      message: 'Dates unblocked and reopened for booking.',
    };
  });
}

export function getFullPlatformState(actorUserId: string) {
  const db = readDatabase();
  const currentAdmin = getAdminById(actorUserId);

  return {
    realtorConfig: db.realtorConfig,
    currentUser: currentAdmin ? toPublicAdminProfile(currentAdmin) : null,
    properties: db.properties as PropertyRecord[],
    apartments: db.apartments as Apartment[],
    bookings: db.bookings,
    blocks: db.blockedDates,
    blockedDates: db.blockedDates,
    customers: db.customers,
    payments: db.payments,
    notifications: db.notifications.slice(0, 50),
    auditLogs: db.auditLogs.slice(0, 50),
  };
}

/**
 * State served to anonymous visitors: branding/config, active listings and
 * neutral occupied intervals only. No bookings, customers, payments,
 * notifications (which may carry dev-mode access codes) or audit logs.
 */
export function getPublicPlatformState() {
  const db = readDatabase();
  const activeApartments = db.apartments.filter((apt) => apt.status === 'active');
  const activeIds = new Set(activeApartments.map((a) => a.id));

  return {
    realtorConfig: db.realtorConfig,
    currentUser: null,
    properties: db.properties.filter((p) => p.status === 'ACTIVE') as PropertyRecord[],
    apartments: activeApartments as Apartment[],
    publicOccupiedIntervals: getPublicUnavailableIntervals(
      db.bookings.filter((b) => activeIds.has(b.apartmentId)),
      db.blockedDates.filter((bl) => activeIds.has(bl.apartmentId))
    ),
  };
}
