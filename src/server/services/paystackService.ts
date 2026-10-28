import crypto from 'crypto';
import { readDatabase, withDatabaseTransaction } from '@/server/db/database';
import type { PaymentRecord, BookingCheckoutAttemptRecord } from '@/server/db/schema';
import type { Booking, PaymentPolicyType } from '@/types';
import { hasBookingConflict, hasBlockedDateConflict } from '@/lib/availability';
import {
  findOrCreateCustomerInTransaction,
  issueBookingVerificationCredentialInTransaction,
} from './customerAndVerificationService';
import { generateBookingReference } from '@/lib/utils';

export function isLivePaystackTestKeyConfigured(): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim() || '';
  return key.startsWith('sk_test_') && key.length > 12;
}

export interface InitializePaymentInput {
  checkoutAttemptId?: string;
  bookingId?: string;
  paymentChoice?: 'FullPayment' | 'Deposit' | 'Balance';
  callbackBaseUrl?: string;
}

export async function initializeBookingPayment(
  input: InitializePaymentInput
): Promise<
  | {
      ok: true;
      checkout?: BookingCheckoutAttemptRecord;
      payment?: PaymentRecord;
      booking?: Booking;
      authorizationUrl: string;
      accessCode: string;
      reference: string;
      mode: 'LIVE_TEST_API' | 'SIMULATED_TEST_MODE';
    }
  | { ok: false; error: string; status: 400 | 404 | 409 }
> {
  const dbSnapshot = readDatabase();

  // CASE 1: Initializing payment from a new checkout attempt (Pre-booking / Pre-customer)
  if (input.checkoutAttemptId) {
    const checkout = dbSnapshot.checkoutAttempts.find(
      (c) => c.id === input.checkoutAttemptId
    );
    if (!checkout) {
      return {
        ok: false,
        error: 'Checkout attempt not found.',
        status: 404,
      };
    }

    if (checkout.status === 'Finalized') {
      return {
        ok: false,
        error: 'This checkout attempt has already been finalized.',
        status: 409,
      };
    }

    // Revalidate apartment availability
    const apartment = dbSnapshot.apartments.find((a) => a.id === checkout.apartmentId);
    if (!apartment) {
      return {
        ok: false,
        error: 'Apartment unit not found.',
        status: 404,
      };
    }

    if (
      hasBookingConflict(apartment.id, checkout.checkIn, checkout.checkOut, dbSnapshot.bookings) ||
      hasBlockedDateConflict(apartment.id, checkout.checkIn, checkout.checkOut, dbSnapshot.blockedDates)
    ) {
      return {
        ok: false,
        error: 'Selected dates conflict with an existing reservation.',
        status: 409,
      };
    }

    const amountNgn = checkout.totalAmount;
    const amountKobo = Math.round(amountNgn * 100);
    const reference = `PSTK_TEST_${checkout.checkoutReference.replace(/[^A-Z0-9]/gi, '')}_${Date.now().toString(36).toUpperCase()}_${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const baseUrl = (input.callbackBaseUrl || 'http://localhost:3000').replace(/\/$/, '');
    const callbackUrl = `${baseUrl}/payment/callback?reference=${encodeURIComponent(reference)}&checkoutId=${encodeURIComponent(checkout.id)}`;

    let mode: 'LIVE_TEST_API' | 'SIMULATED_TEST_MODE' = 'SIMULATED_TEST_MODE';
    let authorizationUrl = `${baseUrl}/payment/${encodeURIComponent(checkout.id)}?reference=${encodeURIComponent(reference)}&checkout=simulated`;
    let accessCode = `ACC_SIM_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (secretKey && secretKey.startsWith('sk_test_')) {
      try {
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: checkout.guestEmail,
            amount: amountKobo,
            currency: 'NGN',
            reference,
            callback_url: callbackUrl,
            metadata: {
              checkoutAttemptId: checkout.id,
              checkoutReference: checkout.checkoutReference,
              clientId: dbSnapshot.realtorConfig.clientId,
            },
          }),
        });
        const json = await response.json();
        if (response.ok && json?.status && json?.data?.authorization_url) {
          mode = 'LIVE_TEST_API';
          authorizationUrl = json.data.authorization_url;
          accessCode = json.data.access_code || accessCode;
        }
      } catch {
        mode = 'SIMULATED_TEST_MODE';
      }
    }

    return withDatabaseTransaction((db) => {
      const chk = db.checkoutAttempts.find((c) => c.id === input.checkoutAttemptId);
      if (!chk) {
        return {
          ok: false as const,
          error: 'Checkout attempt not found.',
          status: 404 as const,
        };
      }

      chk.paystackReference = reference;
      chk.paystackAccessCode = accessCode;
      chk.paystackAuthorizationUrl = authorizationUrl;
      chk.paystackMode = mode;
      chk.status = 'PaymentInitiated';
      chk.updatedAt = new Date().toISOString();

      return {
        ok: true as const,
        checkout: chk,
        authorizationUrl,
        accessCode,
        reference,
        mode,
      };
    });
  }

  // CASE 2: Initializing payment for an existing booking (e.g. balance payment)
  const bookingId = input.bookingId;
  if (!bookingId) {
    return {
      ok: false,
      error: 'Either checkoutAttemptId or bookingId must be provided.',
      status: 400,
    };
  }

  const existingBooking = dbSnapshot.bookings.find((b) => b.id === bookingId);
  if (!existingBooking) {
    return {
      ok: false,
      error: 'Booking not found.',
      status: 404,
    };
  }

  if (
    existingBooking.status === 'Cancelled' ||
    existingBooking.status === 'Rejected' ||
    existingBooking.status === 'Expired'
  ) {
    return {
      ok: false,
      error: `Cannot initiate payment for a ${existingBooking.status.toLowerCase()} booking.`,
      status: 409,
    };
  }

  const totalPrice = existingBooking.totalPrice;
  const amountAlreadyPaid =
    existingBooking.amountPaid ?? (existingBooking.paymentStatus === 'Paid' ? totalPrice : 0);
  const remainingBalance = Math.max(0, totalPrice - amountAlreadyPaid);

  if (existingBooking.paymentStatus === 'Paid' || remainingBalance <= 0) {
    return {
      ok: false,
      error: 'This booking has already been paid in full.',
      status: 409,
    };
  }

  const policy: PaymentPolicyType =
    existingBooking.paymentPolicySnapshot || dbSnapshot.realtorConfig.paymentPolicy;

  let paymentType: PaymentPolicyType | 'Balance' = 'FullPayment';
  let amountNgn = remainingBalance;

  if (amountAlreadyPaid > 0) {
    paymentType = 'Balance';
    amountNgn = remainingBalance;
  } else if (input.paymentChoice === 'Deposit' || policy === 'Deposit') {
    paymentType = 'Deposit';
    const depositPct = dbSnapshot.realtorConfig.depositPercentage || 50;
    amountNgn =
      existingBooking.depositRequiredAmount ||
      Math.round((totalPrice * depositPct) / 100);
  } else {
    paymentType = 'FullPayment';
    amountNgn = totalPrice;
  }

  const amountKobo = Math.round(amountNgn * 100);
  const reference = `PSTK_TEST_${existingBooking.bookingReference.replace(/[^A-Z0-9]/gi, '')}_${Date.now().toString(36).toUpperCase()}_${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const baseUrl = (input.callbackBaseUrl || 'http://localhost:3000').replace(/\/$/, '');
  const callbackUrl = `${baseUrl}/payment/callback?reference=${encodeURIComponent(reference)}&bookingId=${encodeURIComponent(existingBooking.id)}`;

  let mode: 'LIVE_TEST_API' | 'SIMULATED_TEST_MODE' = 'SIMULATED_TEST_MODE';
  let authorizationUrl = `${baseUrl}/payment/${encodeURIComponent(existingBooking.id)}?reference=${encodeURIComponent(reference)}&checkout=simulated`;
  let accessCode = `ACC_SIM_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (secretKey && secretKey.startsWith('sk_test_')) {
    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: existingBooking.guestEmail,
          amount: amountKobo,
          currency: 'NGN',
          reference,
          callback_url: callbackUrl,
          metadata: {
            bookingId: existingBooking.id,
            bookingReference: existingBooking.bookingReference,
            paymentType,
            clientId: dbSnapshot.realtorConfig.clientId,
          },
        }),
      });
      const json = await response.json();
      if (response.ok && json?.status && json?.data?.authorization_url) {
        mode = 'LIVE_TEST_API';
        authorizationUrl = json.data.authorization_url;
        accessCode = json.data.access_code || accessCode;
      }
    } catch {
      mode = 'SIMULATED_TEST_MODE';
    }
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

    const nowIso = new Date().toISOString();
    const paymentRecord: PaymentRecord = {
      id: `pay-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      clientId: db.realtorConfig.clientId,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      customerId: customer.id,
      paymentMethod: 'Paystack',
      provider: 'Paystack',
      mode,
      reference,
      providerReference: reference,
      authorizationUrl,
      accessCode,
      amount: amountNgn,
      amountKobo,
      currency: 'NGN',
      paymentType,
      status: 'Pending',
      paymentStatus: 'Pending',
      receiptVerificationStatus: 'NotApplicable',
      receiptStorageKey: null,
      receiptOriginalFilename: null,
      receiptMimeType: null,
      verifiedByUserId: null,
      verifiedAt: null,
      rejectionReason: null,
      channel: null,
      gatewayResponse: 'Transaction initialized (Awaiting customer authorization)',
      paidAt: null,
      rawResponseSummary: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.payments.unshift(paymentRecord);

    return {
      ok: true as const,
      payment: paymentRecord,
      booking,
      authorizationUrl,
      accessCode,
      reference,
      mode,
    };
  });
}

export interface VerifyPaymentInput {
  reference: string;
  expectedBookingId?: string;
  expectedCheckoutId?: string;
  simulatedOutcome?: 'SUCCESS' | 'FAILED' | 'success' | 'failed';
  simulatedChannel?: 'card' | 'bank_transfer' | 'ussd';
  channel?: string;
}

export async function verifyBookingPayment(
  input: VerifyPaymentInput
): Promise<
  | {
      ok: true;
      idempotentReplay: boolean;
      payment: PaymentRecord;
      booking: Booking;
      devModeVerificationCode?: string | null;
      message: string;
    }
  | { ok: false; error: string; status: 400 | 404 | 409 }
> {
  const ref = input.reference?.trim();
  if (!ref) {
    return {
      ok: false,
      error: 'Paystack transaction reference is required for verification.',
      status: 400,
    };
  }

  const dbSnapshot = readDatabase();

  // CHECK 1: Does this reference belong to a checkout attempt?
  const checkoutAttempt = dbSnapshot.checkoutAttempts.find(
    (c) => c.paystackReference === ref || (input.expectedCheckoutId && c.id === input.expectedCheckoutId)
  );

  let expectedAmountKobo = 0;
  let expectedCurrency = 'NGN';
  let mode: 'LIVE_TEST_API' | 'SIMULATED_TEST_MODE' | 'BANK_TRANSFER_RECEIPT' = 'SIMULATED_TEST_MODE';

  if (checkoutAttempt) {
    expectedAmountKobo = Math.round(checkoutAttempt.totalAmount * 100);
    mode = checkoutAttempt.paystackMode || 'SIMULATED_TEST_MODE';
  } else {
    const existingPayment = dbSnapshot.payments.find((p) => p.reference === ref);
    if (!existingPayment) {
      return {
        ok: false,
        error: `Payment transaction with reference "${ref}" was not found.`,
        status: 404,
      };
    }
    expectedAmountKobo = existingPayment.amountKobo;
    expectedCurrency = existingPayment.currency;
    mode = existingPayment.mode;
  }

  let gatewayVerifiedSuccess =
    input.simulatedOutcome !== 'FAILED' && input.simulatedOutcome !== 'failed';
  let gatewayChannel: string = input.channel || input.simulatedChannel || 'card';
  let gatewayResponseText = gatewayVerifiedSuccess
    ? 'Approved (Paystack Test Mode)'
    : 'Declined by issuer (Paystack Test Mode)';
  let rawVerifyPayload = JSON.stringify({
    simulated: true,
    reference: ref,
    status: gatewayVerifiedSuccess ? 'success' : 'failed',
    amount: expectedAmountKobo,
    currency: expectedCurrency,
    channel: gatewayChannel,
  });

  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (mode === 'LIVE_TEST_API' && secretKey && secretKey.startsWith('sk_test_')) {
    try {
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        }
      );
      const json = await response.json();
      if (response.ok && json?.data) {
        const paystackData = json.data;
        const amountMatches = Number(paystackData.amount) === expectedAmountKobo;
        const currencyMatches =
          (paystackData.currency || 'NGN').toUpperCase() === expectedCurrency;
        gatewayVerifiedSuccess =
          paystackData.status === 'success' && amountMatches && currencyMatches;
        gatewayChannel = paystackData.channel || 'card';
        gatewayResponseText =
          paystackData.gateway_response ||
          (gatewayVerifiedSuccess ? 'Approved' : 'Verification failed');
        rawVerifyPayload = JSON.stringify(paystackData);
      }
    } catch {
      // Keep simulated outcome if network unreachable
    }
  }

  return withDatabaseTransaction((db) => {
    const nowIso = new Date().toISOString();

    // =========================================================================
    // CASE A: Verifying a checkout attempt -> FINALIZE BOOKING ONLY ON SUCCESS
    // =========================================================================
    const checkout = db.checkoutAttempts.find(
      (c) => c.paystackReference === ref || (input.expectedCheckoutId && c.id === input.expectedCheckoutId)
    );

    if (checkout) {
      // IDEMPOTENCY: If checkout was already finalized into a booking, return it
      if (checkout.status === 'Finalized' && checkout.finalizedBookingId) {
        const finalizedBooking = db.bookings.find((b) => b.id === checkout.finalizedBookingId);
        const finalizedPayment = db.payments.find((p) => p.id === checkout.finalizedPaymentId);
        if (finalizedBooking && finalizedPayment) {
          return {
            ok: true as const,
            idempotentReplay: true,
            payment: finalizedPayment,
            booking: finalizedBooking,
            devModeVerificationCode: null,
            message: 'Payment already verified and booking finalized (idempotent callback).',
          };
        }
      }

      if (!gatewayVerifiedSuccess) {
        checkout.status = 'Failed';
        checkout.failureOrReconciliationNote = gatewayResponseText;
        checkout.updatedAt = nowIso;

        return {
          ok: false as const,
          error: `Payment authorization failed or was declined: ${gatewayResponseText}`,
          status: 400 as const,
        };
      }

      // Successful Paystack payment! Now create or associate Customer account
      const customer = findOrCreateCustomerInTransaction(db, {
        fullName: checkout.guestName,
        email: checkout.guestEmail,
        phone: checkout.guestPhone,
      });

      // Generate unique Booking Reference
      let bookingReference = generateBookingReference();
      while (db.bookings.some((b) => b.bookingReference === bookingReference)) {
        bookingReference = generateBookingReference();
      }

      const bookingId = `bk-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
      const apartment = db.apartments.find((a) => a.id === checkout.apartmentId);

      // Create Booking: MUST BE PendingApproval (A successful payment does NOT automatically confirm a booking!)
      const newBooking: Booking = {
        id: bookingId,
        clientId: db.realtorConfig.clientId,
        reference: bookingReference,
        bookingReference,
        apartmentId: checkout.apartmentId,
        unitId: checkout.apartmentId,
        propertyId: apartment?.propertyId || 'prop-ikoyi-1',
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
        amountPaid: checkout.totalAmount,
        balanceAmount: 0,
        currency: 'NGN',
        status: 'PendingApproval', // MANDATORY: Never automatically Confirmed!
        bookingStatus: 'PendingApproval',
        paymentMethod: 'Paystack',
        paymentStatus: 'Paid',
        receiptVerificationStatus: 'NotApplicable',
        receiptStorageKey: null,
        receiptOriginalFilename: null,
        receiptMimeType: null,
        approvedByUserId: null,
        approvedAt: null,
        rejectionReason: null,
        holdExpiresAt: checkout.holdExpiresAt,
        checkoutAttemptId: checkout.id,
        paymentPolicySnapshot: 'FullPayment',
        source: 'ONLINE',
        specialRequests: checkout.specialRequests,
        adminNotes: 'Online Paystack payment verified. Awaiting manual administrator booking approval.',
        checkInInstructions:
          apartment?.checkInInstructions || db.realtorConfig.defaultCheckInInstructions,
        statusHistory: [
          {
            status: 'PendingApproval',
            timestamp: nowIso,
            note: `Paystack payment verified (${ref}). Booking awaiting manual administrator approval.`,
          },
        ],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      db.bookings.unshift(newBooking);

      const paymentRecord: PaymentRecord = {
        id: `pay-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
        clientId: db.realtorConfig.clientId,
        bookingId: newBooking.id,
        bookingReference: newBooking.bookingReference,
        customerId: customer.id,
        paymentMethod: 'Paystack',
        provider: 'Paystack',
        mode: checkout.paystackMode || 'SIMULATED_TEST_MODE',
        reference: ref,
        providerReference: ref,
        authorizationUrl: checkout.paystackAuthorizationUrl || '',
        accessCode: checkout.paystackAccessCode || '',
        amount: checkout.totalAmount,
        amountKobo: Math.round(checkout.totalAmount * 100),
        currency: 'NGN',
        paymentType: 'FullPayment',
        status: 'Success',
        paymentStatus: 'Paid',
        receiptVerificationStatus: 'NotApplicable',
        receiptStorageKey: null,
        receiptOriginalFilename: null,
        receiptMimeType: null,
        verifiedByUserId: null,
        verifiedAt: nowIso,
        rejectionReason: null,
        channel: gatewayChannel,
        gatewayResponse: gatewayResponseText,
        paidAt: nowIso,
        rawResponseSummary: rawVerifyPayload,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      db.payments.unshift(paymentRecord);

      // Issue 6-digit access code (SHA-256 hash)
      const issuedCredential = issueBookingVerificationCredentialInTransaction(db, {
        booking: newBooking,
        customer,
        template: 'BOOKING_CREATED_CODE',
      });

      // Update checkout attempt to Finalized
      checkout.status = 'Finalized';
      checkout.finalizedBookingId = newBooking.id;
      checkout.finalizedBookingReference = newBooking.bookingReference;
      checkout.finalizedCustomerId = customer.id;
      checkout.finalizedPaymentId = paymentRecord.id;
      checkout.updatedAt = nowIso;

      db.notifications.unshift({
        id: `notif-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
        clientId: db.realtorConfig.clientId,
        bookingId: newBooking.id,
        bookingReference: newBooking.bookingReference,
        customerId: customer.id,
        recipientEmail: customer.email,
        recipientPhone: customer.phone,
        channel: 'Both',
        template: 'PAYMENT_CONFIRMED',
        subject: `Payment Successful for Booking ${newBooking.bookingReference} — Awaiting Admin Approval`,
        messagePreview: `Hello ${customer.fullName}, your payment of NGN ${paymentRecord.amount.toLocaleString()} was successful. Your booking is awaiting manual admin approval.`,
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
        action: 'VERIFY_PAYSTACK_PAYMENT_FINALIZE_BOOKING',
        targetType: 'BOOKING',
        targetId: newBooking.id,
        metadataJson: JSON.stringify({
          bookingReference: newBooking.bookingReference,
          reference: ref,
          amount: paymentRecord.amount,
        }),
        createdAt: nowIso,
      });

      return {
        ok: true as const,
        idempotentReplay: false,
        payment: paymentRecord,
        booking: newBooking,
        devModeVerificationCode: issuedCredential.notification.devModeCodePreview,
        message: 'Payment verified successfully! Booking submitted and awaiting manual administrator approval.',
      };
    }

    // =========================================================================
    // CASE B: Verifying a payment for an existing booking record
    // =========================================================================
    const payment = db.payments.find((p) => p.reference === ref);
    if (!payment) {
      return {
        ok: false as const,
        error: 'Payment record not found.',
        status: 404 as const,
      };
    }

    const booking = db.bookings.find((b) => b.id === payment.bookingId);
    if (!booking) {
      return {
        ok: false as const,
        error: 'Associated booking not found.',
        status: 404 as const,
      };
    }

    // Idempotency guard
    if (payment.status === 'Success' && payment.verifiedAt) {
      return {
        ok: true as const,
        idempotentReplay: true,
        payment,
        booking,
        message: 'Payment already verified (idempotent callback response).',
      };
    }

    payment.verifiedAt = nowIso;
    payment.updatedAt = nowIso;
    payment.channel = gatewayChannel;
    payment.gatewayResponse = gatewayResponseText;
    payment.rawResponseSummary = rawVerifyPayload;

    if (gatewayVerifiedSuccess) {
      payment.status = 'Success';
      payment.paymentStatus = 'Paid';
      payment.paidAt = nowIso;

      const previousPaid = booking.amountPaid ?? 0;
      const newAmountPaid = Math.min(booking.totalPrice, previousPaid + payment.amount);
      booking.amountPaid = newAmountPaid;
      booking.balanceAmount = Math.max(0, booking.totalPrice - newAmountPaid);

      if (newAmountPaid >= booking.totalPrice) {
        booking.paymentStatus = 'Paid';
      } else if (newAmountPaid > 0) {
        booking.paymentStatus = 'Partially Paid';
      }

      // MANDATORY RULE: Booking status remains PendingApproval! NEVER auto-confirm!
      if (booking.status === 'Pending') {
        booking.status = 'PendingApproval';
        booking.bookingStatus = 'PendingApproval';
      }

      booking.updatedAt = nowIso;
    } else {
      payment.status = 'Failed';
      payment.paymentStatus = 'Failed';
      booking.updatedAt = nowIso;
    }

    return {
      ok: true as const,
      idempotentReplay: false,
      payment,
      booking,
      message: gatewayVerifiedSuccess
        ? `Payment verified via Paystack. Booking is awaiting manual administrator approval.`
        : 'Payment verification reported a failed or declined transaction.',
    };
  });
}

export function listAllPayments() {
  const db = readDatabase();
  return db.payments;
}
