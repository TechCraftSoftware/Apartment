import crypto from 'crypto';
import {
  DEFAULT_REALTOR_CLIENT_CONFIG,
  INITIAL_APARTMENTS,
  INITIAL_BLOCKED_DATES,
  INITIAL_BOOKINGS,
} from '@/lib/seed-data';
import {
  ApartmentUnitRecord,
  BookingAccessCredentialRecord,
  CustomerRecord,
  NotificationRecord,
  PaymentRecord,
  PlatformDatabaseSchema,
  PrivateReceiptFileRecord,
  PropertyRecord,
  SCHEMA_VERSION,
} from './schema';

export function hashVerificationCode(rawCode: string): string {
  const normalized = rawCode.trim().toUpperCase().replace(/[\s-]/g, '');
  return crypto.createHash('sha256').update(`verdant-booking-code:${normalized}`).digest('hex');
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(`verdant-session-token:${rawToken}`).digest('hex');
}

export const SEEDED_DEMO_VERIFICATION_CODES: Record<string, string> = {
  'BK-2026-8421': '842101',
  'BK-2026-9104': '910402',
  'BK-2026-5532': '553203',
  'BK-2026-7719': '771904',
  'BK-2026-3390': '339005',
  'BK-2026-6128': '612806',
};

// Minimal valid 1x1 PNG base64 for seeded transfer receipt demo
const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export function createSeedDatabaseState(): PlatformDatabaseSchema {
  const nowIso = new Date().toISOString();
  const futureExpiryIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const clientId = DEFAULT_REALTOR_CLIENT_CONFIG.clientId;

  const properties: PropertyRecord[] = [
    {
      id: 'prop-ikoyi-1',
      clientId,
      name: 'The Aurelia Residences Ikoyi',
      slug: 'the-aurelia-residences-ikoyi',
      description: 'Ultra-luxury waterfront residential tower in Old Ikoyi with private jetty and concierge.',
      address: '14 Bourdillon Crescent, Old Ikoyi',
      city: 'Lagos',
      state: 'Lagos',
      status: 'ACTIVE',
      featuredImage: INITIAL_APARTMENTS[0].images[0],
      amenities: INITIAL_APARTMENTS[0].amenities,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'prop-vi-1',
      clientId,
      name: 'Eko Atlantic & Victoria Island Suites',
      slug: 'eko-atlantic-victoria-island-suites',
      description: 'Executive oceanfront serviced lofts in Victoria Island financial district.',
      address: '28 Adeola Odeku Street, Victoria Island',
      city: 'Lagos',
      state: 'Lagos',
      status: 'ACTIVE',
      featuredImage: INITIAL_APARTMENTS[1].images[0],
      amenities: INITIAL_APARTMENTS[1].amenities,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'prop-maitama-1',
      clientId,
      name: 'Maitama Diplomatic Gardens Abuja',
      slug: 'maitama-diplomatic-gardens-abuja',
      description: 'Discreet diplomatic residences and garden suites in Maitama, Abuja.',
      address: '9 Yedseram Street, Maitama',
      city: 'Abuja',
      state: 'FCT',
      status: 'ACTIVE',
      featuredImage: INITIAL_APARTMENTS[2].images[0],
      amenities: INITIAL_APARTMENTS[2].amenities,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'prop-lekki-1',
      clientId,
      name: 'Admiralty Waterfront Residences Lekki',
      slug: 'admiralty-waterfront-residences-lekki',
      description: 'Smart-automated executive apartments off Admiralty Way, Lekki Phase 1.',
      address: '42 Admiralty Way, Lekki Phase 1',
      city: 'Lagos',
      state: 'Lagos',
      status: 'ACTIVE',
      featuredImage: INITIAL_APARTMENTS[3].images[0],
      amenities: INITIAL_APARTMENTS[3].amenities,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'prop-wuse-1',
      clientId,
      name: 'Wuse II Cosmopolitan Towers Abuja',
      slug: 'wuse-ii-cosmopolitan-towers-abuja',
      description: 'Family and diplomatic multi-bedroom residences in central Wuse II.',
      address: '17 Adetokunbo Ademola Crescent, Wuse II',
      city: 'Abuja',
      state: 'FCT',
      status: 'ACTIVE',
      featuredImage: INITIAL_APARTMENTS[4].images[0],
      amenities: INITIAL_APARTMENTS[4].amenities,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'prop-gra-1',
      clientId,
      name: 'New GRA Presidential Villas Port Harcourt',
      slug: 'new-gra-presidential-villas-port-harcourt',
      description: 'Secure gated executive suites in New GRA Phase 2, Port Harcourt.',
      address: '6 Forces Avenue Extension, New GRA',
      city: 'Port Harcourt',
      state: 'Rivers',
      status: 'ACTIVE',
      featuredImage: INITIAL_APARTMENTS[5].images[0],
      amenities: INITIAL_APARTMENTS[5].amenities,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const apartments: ApartmentUnitRecord[] = INITIAL_APARTMENTS.map((apt) => ({
    ...apt,
    clientId: apt.clientId || clientId,
    propertyId: apt.propertyId || 'prop-ikoyi-1',
    propertyName: apt.propertyName || apt.name,
    unitType: apt.unitType || '2 Bedroom',
    cautionDeposit: apt.cautionDeposit ?? 50000,
    checkInInstructions:
      apt.checkInInstructions || DEFAULT_REALTOR_CLIENT_CONFIG.defaultCheckInInstructions,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));

  const customers: CustomerRecord[] = INITIAL_BOOKINGS.map((bk, idx) => ({
    id: bk.customerId || `cust-10${idx + 1}`,
    clientId,
    fullName: bk.guestName,
    email: bk.guestEmail.toLowerCase().trim(),
    phone: bk.guestPhone.trim(),
    createdAt: bk.createdAt,
    updatedAt: bk.createdAt,
  }));

  const bookingAccessCredentials: BookingAccessCredentialRecord[] = INITIAL_BOOKINGS.map(
    (bk, idx) => {
      const rawCode = SEEDED_DEMO_VERIFICATION_CODES[bk.bookingReference] || `80010${idx}`;
      return {
        id: `cred-seed-${bk.id}`,
        bookingId: bk.id,
        bookingReference: bk.bookingReference,
        customerId: bk.customerId || `cust-10${idx + 1}`,
        codeHash: hashVerificationCode(rawCode),
        deliveryChannel: 'Both',
        expiresAt: futureExpiryIso,
        usedAt: null,
        revokedAt: null,
        failedAttempts: 0,
        lastAttemptAt: null,
        lockedUntil: null,
        createdAt: bk.createdAt,
      };
    }
  );

  const privateReceipts: PrivateReceiptFileRecord[] = [
    {
      storageKey: 'rcpt-seed-9104.png',
      checkoutId: 'chk-seed-102',
      bookingId: 'bk-102',
      bookingReference: 'BK-2026-9104',
      customerId: 'cust-102',
      originalFilename: 'gtbank-transfer-receipt-9104.png',
      mimeType: 'image/png',
      sizeBytes: 68,
      base64Data: SAMPLE_PNG_BASE64,
      uploadedByEmail: 'amina.bello@zenithconsult.com',
      createdAt: INITIAL_BOOKINGS[1].createdAt,
    },
    {
      storageKey: 'rcpt-seed-7719.png',
      checkoutId: 'chk-seed-104',
      bookingId: 'bk-104',
      bookingReference: 'BK-2026-7719',
      customerId: 'cust-104',
      originalFilename: 'zenith-transfer-7719.png',
      mimeType: 'image/png',
      sizeBytes: 68,
      base64Data: SAMPLE_PNG_BASE64,
      uploadedByEmail: 'zainab@studioforma.co',
      createdAt: INITIAL_BOOKINGS[3].createdAt,
    },
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'pay-seed-101',
      clientId,
      bookingId: 'bk-101',
      bookingReference: 'BK-2026-8421',
      customerId: 'cust-101',
      paymentMethod: 'Paystack',
      provider: 'Paystack',
      mode: 'SIMULATED_TEST_MODE',
      reference: 'PSTK_TEST_8421_1001',
      providerReference: 'PSTK_TEST_8421_1001',
      authorizationUrl: '/payment/callback?reference=PSTK_TEST_8421_1001&bookingId=bk-101',
      accessCode: 'ACC_TEST_8421',
      amount: 1160000,
      amountKobo: 116000000,
      currency: 'NGN',
      paymentType: 'FullPayment',
      status: 'Success',
      paymentStatus: 'Paid',
      receiptVerificationStatus: 'NotApplicable',
      receiptStorageKey: null,
      receiptOriginalFilename: null,
      receiptMimeType: null,
      verifiedByUserId: null,
      verifiedAt: INITIAL_BOOKINGS[0].createdAt,
      rejectionReason: null,
      channel: 'card',
      gatewayResponse: 'Approved (Paystack Test Mode)',
      paidAt: INITIAL_BOOKINGS[0].createdAt,
      rawResponseSummary: JSON.stringify({
        status: 'success',
        reference: 'PSTK_TEST_8421_1001',
        amount: 116000000,
        currency: 'NGN',
      }),
      createdAt: INITIAL_BOOKINGS[0].createdAt,
      updatedAt: INITIAL_BOOKINGS[0].createdAt,
    },
    {
      id: 'pay-seed-102',
      clientId,
      bookingId: 'bk-102',
      bookingReference: 'BK-2026-9104',
      customerId: 'cust-102',
      paymentMethod: 'BankTransfer',
      provider: 'BankTransfer',
      mode: 'BANK_TRANSFER_RECEIPT',
      reference: 'TRF_REF_9104_2001',
      providerReference: 'TRF_REF_9104_2001',
      authorizationUrl: '',
      accessCode: '',
      amount: 690000,
      amountKobo: 69000000,
      currency: 'NGN',
      paymentType: 'BankTransfer',
      status: 'AwaitingVerification',
      paymentStatus: 'AwaitingVerification',
      receiptVerificationStatus: 'PendingReview',
      receiptStorageKey: 'rcpt-seed-9104.png',
      receiptOriginalFilename: 'gtbank-transfer-receipt-9104.png',
      receiptMimeType: 'image/png',
      verifiedByUserId: null,
      verifiedAt: null,
      rejectionReason: null,
      channel: 'bank_transfer',
      gatewayResponse: 'Bank transfer receipt uploaded; awaiting administrator verification.',
      paidAt: null,
      rawResponseSummary: JSON.stringify({
        method: 'BankTransfer',
        receiptStorageKey: 'rcpt-seed-9104.png',
      }),
      createdAt: INITIAL_BOOKINGS[1].createdAt,
      updatedAt: INITIAL_BOOKINGS[1].createdAt,
    },
    {
      id: 'pay-seed-103',
      clientId,
      bookingId: 'bk-103',
      bookingReference: 'BK-2026-5532',
      customerId: 'cust-103',
      paymentMethod: 'Paystack',
      provider: 'Paystack',
      mode: 'SIMULATED_TEST_MODE',
      reference: 'PSTK_TEST_5532_1002',
      providerReference: 'PSTK_TEST_5532_1002',
      authorizationUrl: '/payment/callback?reference=PSTK_TEST_5532_1002&bookingId=bk-103',
      accessCode: 'ACC_TEST_5532',
      amount: 460000,
      amountKobo: 46000000,
      currency: 'NGN',
      paymentType: 'FullPayment',
      status: 'Success',
      paymentStatus: 'Paid',
      receiptVerificationStatus: 'NotApplicable',
      receiptStorageKey: null,
      receiptOriginalFilename: null,
      receiptMimeType: null,
      verifiedByUserId: null,
      verifiedAt: INITIAL_BOOKINGS[2].createdAt,
      rejectionReason: null,
      channel: 'card',
      gatewayResponse: 'Approved (Paystack Test Mode)',
      paidAt: INITIAL_BOOKINGS[2].createdAt,
      rawResponseSummary: JSON.stringify({
        status: 'success',
        reference: 'PSTK_TEST_5532_1002',
        amount: 46000000,
        currency: 'NGN',
      }),
      createdAt: INITIAL_BOOKINGS[2].createdAt,
      updatedAt: INITIAL_BOOKINGS[2].createdAt,
    },
    {
      id: 'pay-seed-104',
      clientId,
      bookingId: 'bk-104',
      bookingReference: 'BK-2026-7719',
      customerId: 'cust-104',
      paymentMethod: 'BankTransfer',
      provider: 'BankTransfer',
      mode: 'BANK_TRANSFER_RECEIPT',
      reference: 'TRF_REF_7719_1003',
      providerReference: 'TRF_REF_7719_1003',
      authorizationUrl: '',
      accessCode: '',
      amount: 400000,
      amountKobo: 40000000,
      currency: 'NGN',
      paymentType: 'BankTransfer',
      status: 'Success',
      paymentStatus: 'Paid',
      receiptVerificationStatus: 'Verified',
      receiptStorageKey: 'rcpt-seed-7719.png',
      receiptOriginalFilename: 'zenith-transfer-7719.png',
      receiptMimeType: 'image/png',
      verifiedByUserId: 'usr-realtor-admin-1',
      verifiedAt: INITIAL_BOOKINGS[3].createdAt,
      rejectionReason: null,
      channel: 'bank_transfer',
      gatewayResponse: 'Bank transfer receipt verified by Realtor Admin',
      paidAt: INITIAL_BOOKINGS[3].createdAt,
      rawResponseSummary: JSON.stringify({
        method: 'BankTransfer',
        receiptStorageKey: 'rcpt-seed-7719.png',
      }),
      createdAt: INITIAL_BOOKINGS[3].createdAt,
      updatedAt: INITIAL_BOOKINGS[3].createdAt,
    },
    {
      id: 'pay-seed-105',
      clientId,
      bookingId: 'bk-105',
      bookingReference: 'BK-2026-3390',
      customerId: 'cust-105',
      paymentMethod: 'Paystack',
      provider: 'Paystack',
      mode: 'SIMULATED_TEST_MODE',
      reference: 'PSTK_TEST_3390_1004',
      providerReference: 'PSTK_TEST_3390_1004',
      authorizationUrl: '/payment/callback?reference=PSTK_TEST_3390_1004&bookingId=bk-105',
      accessCode: 'ACC_TEST_3390',
      amount: 1160000,
      amountKobo: 116000000,
      currency: 'NGN',
      paymentType: 'FullPayment',
      status: 'Success',
      paymentStatus: 'Paid',
      receiptVerificationStatus: 'NotApplicable',
      receiptStorageKey: null,
      receiptOriginalFilename: null,
      receiptMimeType: null,
      verifiedByUserId: null,
      verifiedAt: INITIAL_BOOKINGS[4].createdAt,
      rejectionReason: null,
      channel: 'card',
      gatewayResponse: 'Approved (Paystack Test Mode)',
      paidAt: INITIAL_BOOKINGS[4].createdAt,
      rawResponseSummary: JSON.stringify({
        status: 'success',
        reference: 'PSTK_TEST_3390_1004',
        amount: 116000000,
        currency: 'NGN',
      }),
      createdAt: INITIAL_BOOKINGS[4].createdAt,
      updatedAt: INITIAL_BOOKINGS[4].createdAt,
    },
  ];

  const notifications: NotificationRecord[] = INITIAL_BOOKINGS.map((bk, idx) => {
    const rawCode = SEEDED_DEMO_VERIFICATION_CODES[bk.bookingReference] || `80010${idx}`;
    return {
      id: `notif-seed-${bk.id}`,
      clientId,
      bookingId: bk.id,
      bookingReference: bk.bookingReference,
      customerId: bk.customerId || `cust-10${idx + 1}`,
      recipientEmail: bk.guestEmail,
      recipientPhone: bk.guestPhone,
      channel: 'Both',
      template: 'BOOKING_CREATED_CODE',
      subject: `Your Booking ${bk.bookingReference} & Verification Code — ${DEFAULT_REALTOR_CLIENT_CONFIG.businessName}`,
      messagePreview: `Dear ${bk.guestName}, your booking ${bk.bookingReference} has been recorded. Use your 6-digit verification code on /my-booking to securely view your booking status.`,
      devModeCodePreview: rawCode,
      deliveryStatus: 'SimulatedInDev',
      createdAt: bk.createdAt,
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    realtorConfig: DEFAULT_REALTOR_CLIENT_CONFIG,
    adminUsers: [
      {
        id: 'usr-realtor-admin-1',
        clientId,
        email: 'admin@staydemo.com',
        passwordHash: 'Admin123!',
        fullName: 'Toluwani Adeyinka (Realtor Admin)',
        phone: '+234 809 555 0100',
        role: 'REALTOR_ADMIN',
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    properties,
    apartments,
    customers,
    checkoutAttempts: [],
    privateReceipts,
    bookings: INITIAL_BOOKINGS,
    bookingAccessCredentials,
    bookingAccessSessions: [],
    payments,
    notifications,
    blockedDates: INITIAL_BLOCKED_DATES,
    verificationRateLimits: [],
    auditLogs: [
      {
        id: 'aud-seed-1',
        clientId,
        actorUserId: 'usr-realtor-admin-1',
        actorEmail: 'admin@staydemo.com',
        actorRole: 'REALTOR_ADMIN',
        action: 'INITIALIZE_SINGLE_CLIENT_REALTOR_PLATFORM',
        targetType: 'REALTOR_CONFIG',
        targetId: clientId,
        metadataJson: JSON.stringify({
          clientId,
          businessName: DEFAULT_REALTOR_CLIENT_CONFIG.businessName,
          paymentPolicy: DEFAULT_REALTOR_CLIENT_CONFIG.paymentPolicy,
        }),
        createdAt: nowIso,
      },
    ],
  };
}

export const createInitialDatabaseState = createSeedDatabaseState;

export function runDatabaseMigrations(
  raw: Partial<PlatformDatabaseSchema> | null
): { db: PlatformDatabaseSchema; migrated: boolean } {
  const seed = createSeedDatabaseState();
  if (!raw || typeof raw !== 'object') {
    return { db: seed, migrated: true };
  }

  const needsMigration =
    raw.schemaVersion !== SCHEMA_VERSION ||
    !raw.realtorConfig ||
    !Array.isArray(raw.bookingAccessCredentials) ||
    !Array.isArray(raw.payments) ||
    !Array.isArray(raw.checkoutAttempts) ||
    !Array.isArray(raw.privateReceipts);

  const db: PlatformDatabaseSchema = {
    schemaVersion: SCHEMA_VERSION,
    realtorConfig:
      raw.realtorConfig && typeof raw.realtorConfig.clientId === 'string'
        ? { ...seed.realtorConfig, ...raw.realtorConfig }
        : seed.realtorConfig,
    adminUsers:
      Array.isArray(raw.adminUsers) && raw.adminUsers.length > 0
        ? raw.adminUsers
        : seed.adminUsers,
    properties:
      Array.isArray(raw.properties) && raw.properties.length > 0
        ? raw.properties
        : seed.properties,
    apartments:
      Array.isArray(raw.apartments) && raw.apartments.length > 0
        ? raw.apartments
        : seed.apartments,
    customers:
      Array.isArray(raw.customers) && raw.customers.length > 0
        ? raw.customers
        : seed.customers,
    checkoutAttempts: Array.isArray(raw.checkoutAttempts)
      ? raw.checkoutAttempts
      : [],
    privateReceipts:
      Array.isArray(raw.privateReceipts) && raw.privateReceipts.length > 0
        ? raw.privateReceipts
        : seed.privateReceipts,
    bookings: Array.isArray(raw.bookings) ? raw.bookings : seed.bookings,
    bookingAccessCredentials: Array.isArray(raw.bookingAccessCredentials)
      ? raw.bookingAccessCredentials
      : seed.bookingAccessCredentials,
    bookingAccessSessions: Array.isArray(raw.bookingAccessSessions)
      ? raw.bookingAccessSessions
      : [],
    payments: Array.isArray(raw.payments) ? raw.payments : seed.payments,
    notifications: Array.isArray(raw.notifications)
      ? raw.notifications
      : seed.notifications,
    blockedDates: Array.isArray(raw.blockedDates)
      ? raw.blockedDates
      : seed.blockedDates,
    verificationRateLimits: Array.isArray(raw.verificationRateLimits)
      ? raw.verificationRateLimits
      : [],
    auditLogs: Array.isArray(raw.auditLogs) ? raw.auditLogs : seed.auditLogs,
  };

  return { db, migrated: needsMigration };
}
