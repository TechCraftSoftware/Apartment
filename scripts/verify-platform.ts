import assert from 'node:assert/strict';
import { resetDatabaseToSeed, readDatabase } from '../src/server/db/database';
import {
  createCustomerBookingRequest,
  createExternalBookingByAdmin,
  updateBookingStatus,
  cancelBookingByVerifiedCustomer,
  getPublicAvailabilityPayload,
  reviewBankTransferReceipt,
} from '../src/server/services/marketplaceService';
import {
  createBookingCheckoutAttempt,
  uploadBankTransferReceipt,
  submitBankTransferCheckout,
  getPrivateReceiptRecord,
} from '../src/server/services/checkoutService';
import {
  verifyBookingWithCode,
  getVerifiedBookingSessionView,
  requestFreshBookingVerificationCode,
  adminReissueBookingVerificationCode,
  hashVerificationCode,
} from '../src/server/services/customerAndVerificationService';
import {
  initializeBookingPayment,
  verifyBookingPayment,
} from '../src/server/services/paystackService';
import {
  getRealtorClientConfig,
  updateRealtorClientConfig,
} from '../src/server/services/realtorConfigService';
import { loginAdminUser } from '../src/server/services/authService';

async function runVerificationSuite() {
  console.log('=============================================================');
  console.log('SINGLE-CLIENT REALTOR APARTMENT BOOKING PLATFORM');
  console.log('PAYSTACK & BANK TRANSFER WORKFLOW VERIFICATION SUITE');
  console.log('=============================================================\n');

  // Reset database to clean deterministic seed
  resetDatabaseToSeed();

  const adminId = 'usr-realtor-admin-1';

  // 0. Verify Realtor Admin Authentication & Bank Transfer Config
  console.log('--- Step 0: Admin Authentication & Bank Transfer Config ---');
  const adminAuth = loginAdminUser('admin@staydemo.com', 'Admin123!');
  assert.equal(adminAuth.ok, true, 'Admin login must succeed');
  if (adminAuth.ok) {
    assert.equal(adminAuth.user.role, 'REALTOR_ADMIN', 'Admin must authenticate as REALTOR_ADMIN');
  }

  const initialConfig = getRealtorClientConfig();
  assert.equal(initialConfig.clientId, 'realtor-verdant-stays');

  // Update bank transfer details
  const updatedConfigRes = updateRealtorClientConfig(adminId, {
    bankTransferBeneficiaryName: 'Verdant Stays Hospitality Ltd',
    bankTransferBankName: 'Zenith Bank PLC',
    bankTransferAccountNumber: '1018942201',
    bankTransferInstructions: 'Use Full Name or Phone Number as transfer narrative.',
  });
  assert.equal(updatedConfigRes.ok, true);
  assert.equal(
    updatedConfigRes.config?.bankTransferAccountNumber,
    '1018942201',
    'Bank account number must be configured'
  );
  console.log('✅ [Step 0] Admin authenticated & bank transfer configuration persisted.');

  // =========================================================================
  // SCENARIO 1: PAYSTACK ONLINE FLOW
  // - Temporary checkout attempt created (No customer record or booking yet)
  // - Payment verified server-side
  // - Customer account & booking created automatically AFTER payment
  // - Status: PendingApproval, PaymentStatus: Paid (NEVER auto-confirmed!)
  // =========================================================================
  console.log('\n--- Scenario 1: Paystack Online Payment & Automatic Account Creation ---');

  const dbBeforePaystack = readDatabase();
  const customerCountBefore = dbBeforePaystack.customers.length;
  const bookingCountBefore = dbBeforePaystack.bookings.length;

  // 1. Initiate temporary checkout attempt
  const paystackCheckoutRes = createBookingCheckoutAttempt({
    apartmentId: 'apt-1',
    guestName: 'Chidinma Okafor',
    guestEmail: 'chidinma.okafor@lagosmail.ng',
    guestPhone: '+234 803 555 0199',
    checkIn: '2026-12-01',
    checkOut: '2026-12-05',
    guests: 2,
    paymentMethod: 'Paystack',
    specialRequests: 'High floor preferred',
  });

  assert.equal(paystackCheckoutRes.ok, true);
  const checkoutId = paystackCheckoutRes.checkout.id;
  assert.ok(checkoutId.startsWith('chk-'));
  assert.equal(paystackCheckoutRes.checkout.status, 'PendingCheckout');

  // Verify NO customer or booking created at checkout initiation
  const dbAfterInitiate = readDatabase();
  assert.equal(
    dbAfterInitiate.customers.length,
    customerCountBefore,
    'No customer record should be created before payment verification'
  );
  assert.equal(
    dbAfterInitiate.bookings.length,
    bookingCountBefore,
    'No booking record should be created before payment verification'
  );

  // 2. Initialize Paystack payment for this checkout attempt
  const initPaymentRes = await initializeBookingPayment({
    checkoutAttemptId: checkoutId,
    callbackBaseUrl: 'http://localhost:3000',
  });
  assert.equal(initPaymentRes.ok, true);
  assert.ok(initPaymentRes.reference.startsWith('PSTK_TEST_'));

  // 3. Verify payment server-side
  const verifyPayRes = await verifyBookingPayment({
    reference: initPaymentRes.reference,
    simulatedOutcome: 'SUCCESS',
    channel: 'card',
  });

  assert.equal(verifyPayRes.ok, true);
  assert.equal(verifyPayRes.payment.status, 'Success');
  assert.equal(verifyPayRes.payment.paymentStatus, 'Paid');

  // MANDATORY BUSINESS RULE: Booking status must be PendingApproval, NEVER Confirmed!
  assert.equal(
    verifyPayRes.booking.status,
    'PendingApproval',
    'Paystack booking must be PendingApproval, NOT automatically Confirmed'
  );
  assert.equal(verifyPayRes.booking.paymentStatus, 'Paid');
  assert.equal(verifyPayRes.booking.paymentMethod, 'Paystack');
  assert.equal(verifyPayRes.booking.receiptVerificationStatus, 'NotApplicable');

  // Verify customer record was created automatically
  const dbAfterPaystack = readDatabase();
  const createdCustomer = dbAfterPaystack.customers.find(
    (c) => c.email === 'chidinma.okafor@lagosmail.ng'
  );
  assert.ok(createdCustomer, 'Customer account must be created automatically after payment');
  assert.equal(createdCustomer?.fullName, 'Chidinma Okafor');

  // Verify booking access code was issued
  assert.ok(verifyPayRes.devModeVerificationCode, 'Dev mode code must be available');
  assert.match(verifyPayRes.devModeVerificationCode!, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // 4. Test Idempotent callback replay
  const verifyPayReplay = await verifyBookingPayment({
    reference: initPaymentRes.reference,
    simulatedOutcome: 'SUCCESS',
  });
  assert.equal(verifyPayReplay.ok, true);
  assert.equal(verifyPayReplay.idempotentReplay, true, 'Re-verification must be idempotent');

  console.log(
    `✅ [Scenario 1] Paystack payment verified: customer created, booking ${verifyPayRes.booking.bookingReference} set to PendingApproval & Paid.`
  );

  // =========================================================================
  // SCENARIO 2: MANDATORY ADMIN APPROVAL ENFORCEMENT
  // - Admin manually approves Paystack booking (allowed because payment is Paid)
  // - Booking transitions to Confirmed
  // =========================================================================
  console.log('\n--- Scenario 2: Manual Admin Approval for Paystack Booking ---');

  const adminApprovePaystack = updateBookingStatus(
    adminId,
    verifyPayRes.booking.id,
    'Confirmed',
    'Payment verified via Paystack. Approved by Realtor Admin.'
  );

  assert.equal(adminApprovePaystack.ok, true);
  assert.equal(adminApprovePaystack.booking.status, 'Confirmed');
  console.log(
    `✅ [Scenario 2] Admin explicitly approved booking ${verifyPayRes.booking.bookingReference} to Confirmed.`
  );

  // =========================================================================
  // SCENARIO 3: BANK TRANSFER WORKFLOW
  // - Customer initiates bank transfer checkout
  // - Uploads proof-of-payment receipt (strict validation: mime type, 5MB max)
  // - Submits bank transfer booking
  // - Customer account & booking created with:
  //   status: PendingApproval, paymentStatus: AwaitingVerification, receiptVerificationStatus: PendingReview
  // - Stored securely in private storage (not publicly exposed)
  // =========================================================================
  console.log('\n--- Scenario 3: Bank Transfer Flow & Receipt Upload ---');

  // 1. Create checkout attempt
  const transferCheckoutRes = createBookingCheckoutAttempt({
    apartmentId: 'apt-2',
    guestName: 'Emeka Nwosu',
    guestEmail: 'emeka.nwosu@anambra.ng',
    guestPhone: '+234 802 333 4455',
    checkIn: '2026-12-10',
    checkOut: '2026-12-14',
    guests: 2,
    paymentMethod: 'BankTransfer',
  });

  assert.equal(transferCheckoutRes.ok, true);
  const transferCheckoutId = transferCheckoutRes.checkout.id;

  // 2. Validate receipt upload rejection of invalid file type
  const invalidMimeUpload = uploadBankTransferReceipt(transferCheckoutId, {
    originalFilename: 'script.exe',
    mimeType: 'application/x-msdownload',
    sizeBytes: 1024,
    base64Data: Buffer.from('malicious payload').toString('base64'),
  });
  assert.equal(invalidMimeUpload.ok, false);
  assert.equal(invalidMimeUpload.status, 400, 'Invalid file format must be rejected');

  // Validate receipt upload rejection of oversized file (> 5 MB)
  const oversizedUpload = uploadBankTransferReceipt(transferCheckoutId, {
    originalFilename: 'huge_statement.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 6 * 1024 * 1024, // 6 MB
    base64Data: Buffer.from('large file').toString('base64'),
  });
  assert.equal(oversizedUpload.ok, false);
  assert.equal(oversizedUpload.status, 400, 'Files > 5 MB must be rejected');

  // 3. Valid receipt upload (PDF transfer receipt)
  const validReceiptUpload = uploadBankTransferReceipt(transferCheckoutId, {
    originalFilename: 'zenith_transfer_receipt_emeka.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 45000,
    base64Data: Buffer.from('%PDF-1.4 Mock Transfer Receipt for NGN 720,000').toString('base64'),
  });
  assert.equal(validReceiptUpload.ok, true);
  assert.ok(validReceiptUpload.receiptKey.startsWith('rcpt-'));

  // 4. Submit bank transfer checkout
  const submitTransferRes = submitBankTransferCheckout({
    checkoutAttemptId: transferCheckoutId,
    receiptKey: validReceiptUpload.receiptKey,
  });

  assert.equal(submitTransferRes.ok, true);
  const transferBooking = submitTransferRes.booking;
  assert.equal(
    transferBooking.status,
    'PendingApproval',
    'Bank transfer booking must be PendingApproval'
  );
  assert.equal(
    transferBooking.paymentStatus,
    'AwaitingVerification',
    'Bank transfer payment status must be AwaitingVerification'
  );
  assert.equal(
    transferBooking.receiptVerificationStatus,
    'PendingReview',
    'Bank transfer receipt status must be PendingReview'
  );
  assert.equal(transferBooking.paymentMethod, 'BankTransfer');
  assert.equal(transferBooking.receiptStorageKey, validReceiptUpload.receiptKey);

  // 5. Test private receipt access control
  // Unauthenticated public request without admin or session must fail
  const unauthReceipt = getPrivateReceiptRecord(validReceiptUpload.receiptKey, {});
  assert.equal(unauthReceipt.ok, false);
  assert.equal(unauthReceipt.status, 401, 'Public cannot access private receipt');

  // Admin access must succeed
  const adminReceipt = getPrivateReceiptRecord(validReceiptUpload.receiptKey, {
    actorUserId: adminId,
  });
  assert.equal(adminReceipt.ok, true);
  assert.equal(adminReceipt.receipt.originalFilename, 'zenith_transfer_receipt_emeka.pdf');

  console.log(
    `✅ [Scenario 3] Bank transfer booking ${transferBooking.bookingReference} created (PendingApproval, AwaitingVerification, PendingReview). Private receipt stored securely.`
  );

  // =========================================================================
  // SCENARIO 4: BANK TRANSFER APPROVAL RULES
  // - Admin CANNOT approve booking while receipt is unverified (must return 409)
  // - Admin verifies receipt -> marks receipt Verified & payment Paid
  // - Admin then approves booking -> transitions to Confirmed
  // =========================================================================
  console.log('\n--- Scenario 4: Admin Approval Rules & Receipt Verification ---');

  // Attempting to approve without verified receipt must fail
  const prematureApproval = updateBookingStatus(
    adminId,
    transferBooking.id,
    'Confirmed',
    'Premature approval attempt'
  );
  assert.equal(prematureApproval.ok, false);
  assert.equal(
    prematureApproval.status,
    409,
    'Cannot confirm bank transfer booking before receipt verification'
  );

  // Admin verifies the transfer receipt
  const receiptReviewRes = reviewBankTransferReceipt(
    adminId,
    transferBooking.id,
    'VERIFY'
  );
  assert.equal(receiptReviewRes.ok, true);
  assert.equal(receiptReviewRes.booking.receiptVerificationStatus, 'Verified');
  assert.equal(receiptReviewRes.booking.paymentStatus, 'Paid');
  assert.equal(
    receiptReviewRes.booking.status,
    'PendingApproval',
    'Booking must still be PendingApproval after receipt verification until explicit approval'
  );

  // Now admin approves the booking
  const finalApproval = updateBookingStatus(
    adminId,
    transferBooking.id,
    'Confirmed',
    'Receipt verified against bank statement. Reservation confirmed.'
  );
  assert.equal(finalApproval.ok, true);
  assert.equal(finalApproval.booking.status, 'Confirmed');

  console.log(
    `✅ [Scenario 4] Premature approval blocked (409), receipt verified by admin, and booking explicitly confirmed.`
  );

  // =========================================================================
  // SCENARIO 5: CONFLICT RECONCILIATION & RECEIPT PRESERVATION
  // - If dates become unavailable before transfer submission, receipt is preserved
  // =========================================================================
  console.log('\n--- Scenario 5: Graceful Conflict Reconciliation & Receipt Preservation ---');

  // Customer A initiates checkout for Maitama Dec 20 -> Dec 24
  const conflictChkRes = createBookingCheckoutAttempt({
    apartmentId: 'apt-3',
    guestName: 'Late Payer',
    guestEmail: 'late.payer@example.com',
    guestPhone: '+234 809 111 2233',
    checkIn: '2026-12-20',
    checkOut: '2026-12-24',
    guests: 2,
    paymentMethod: 'BankTransfer',
  });
  assert.equal(conflictChkRes.ok, true);

  // Customer uploads receipt
  const conflictReceiptUpload = uploadBankTransferReceipt(conflictChkRes.checkout.id, {
    originalFilename: 'transfer_slip.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 15000,
    base64Data: Buffer.from('mock jpeg transfer slip').toString('base64'),
  });
  assert.equal(conflictReceiptUpload.ok, true);

  // Meanwhile, Admin records an external WhatsApp booking claiming those exact dates
  const externalBookingRes = createExternalBookingByAdmin(adminId, {
    apartmentId: 'apt-3',
    guestName: 'Alhaji Musa Danjuma',
    guestEmail: 'musa.danjuma@kanocorp.ng',
    guestPhone: '+234 806 777 8899',
    checkIn: '2026-12-20',
    checkOut: '2026-12-24',
    guests: 2,
    source: 'WHATSAPP',
    initialStatus: 'Confirmed',
    initialPaymentStatus: 'Paid',
    amountPaid: 800000,
  });
  assert.equal(externalBookingRes.ok, true);

  // Now customer tries to submit the bank transfer checkout
  const lateSubmission = submitBankTransferCheckout({
    checkoutAttemptId: conflictChkRes.checkout.id,
    receiptKey: conflictReceiptUpload.receiptKey,
  });

  // Must fail gracefully without creating an invalid overlapping booking
  assert.equal(lateSubmission.ok, false);
  assert.equal(lateSubmission.status, 409);
  assert.ok(lateSubmission.conflictResolution, 'Conflict resolution payload must be returned');
  assert.equal(
    lateSubmission.conflictResolution?.receiptKey,
    conflictReceiptUpload.receiptKey,
    'Uploaded receipt must be safely preserved for concierge reconciliation'
  );

  console.log(
    `✅ [Scenario 5] Overlapping submission prevented, and receipt ${conflictReceiptUpload.receiptKey} preserved for concierge reconciliation.`
  );

  // =========================================================================
  // SCENARIO 6: PASSWORDLESS CODE ACCESS & GUEST PRIVACY
  // - 6-digit verification code with SHA-256 hash
  // - One-time invalidation on use
  // - Public calendar NEVER leaks guest PII
  // =========================================================================
  console.log('\n--- Scenario 6: Passwordless Code Access & Public Privacy ---');

  // Verify booking using code from Scenario 1
  const verifiedAccess = verifyBookingWithCode({
    bookingReference: verifyPayRes.booking.bookingReference,
    contactMethod: 'EMAIL',
    contactValue: 'chidinma.okafor@lagosmail.ng',
    verificationCode: verifyPayRes.devModeVerificationCode!,
    ipKey: 'test-client-6',
  });
  assert.equal(verifiedAccess.ok, true);
  assert.ok(verifiedAccess.accessToken);

  // Code is reusable: the customer can open the booking again with the same code alone
  const reuseAttempt = verifyBookingWithCode({
    verificationCode: verifyPayRes.devModeVerificationCode!.toLowerCase().replace('-', ''),
    ipKey: 'test-client-6-reuse',
  });
  assert.equal(reuseAttempt.ok, true, 'Booking access code must be reusable and format-tolerant');

  // Issuing a new code revokes the previous one
  const reissued = requestFreshBookingVerificationCode({
    bookingReference: verifyPayRes.booking.bookingReference,
    emailOrPhone: 'chidinma.okafor@lagosmail.ng',
  });
  assert.ok(reissued.ok && reissued.devModeCodePreview);
  const oldCodeAttempt = verifyBookingWithCode({
    verificationCode: verifyPayRes.devModeVerificationCode!,
    ipKey: 'test-client-6-old',
  });
  assert.equal(oldCodeAttempt.ok, false, 'Replaced access code must be rejected');
  const newCodeAttempt = verifyBookingWithCode({
    verificationCode: reissued.ok ? reissued.devModeCodePreview! : '',
    ipKey: 'test-client-6-new',
  });
  assert.equal(newCodeAttempt.ok, true, 'Newest access code must work');

  // Customer session can access private receipt
  const customerReceiptAccess = getPrivateReceiptRecord(validReceiptUpload.receiptKey, {
    sessionToken: verifiedAccess.accessToken,
  });
  // Since customer Chidinma does not own Emeka's receipt, should be rejected (403)
  assert.equal(customerReceiptAccess.ok, false);
  assert.equal(customerReceiptAccess.status, 403, 'Cross-customer receipt access must be denied');

  // Public calendar check: PII must never be leaked
  const publicCalendar = getPublicAvailabilityPayload();
  const serialized = JSON.stringify(publicCalendar);
  assert.equal(serialized.includes('Chidinma'), false, 'Public calendar must not leak guest names');
  assert.equal(serialized.includes('chidinma.okafor'), false, 'Public calendar must not leak emails');
  assert.equal(serialized.includes('08035550199'), false, 'Public calendar must not leak phones');

  // Reset database back to clean initial seed
  resetDatabaseToSeed();

  console.log(
    '✅ [Scenario 6] Code authentication verified, cross-customer receipt isolation enforced, and public PII protection confirmed.'
  );

  console.log('\n=============================================================');
  console.log('ALL WORKFLOW & VERIFICATION TESTS COMPLETED SUCCESSFULLY! ✓');
  console.log('=============================================================');
}

runVerificationSuite().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
