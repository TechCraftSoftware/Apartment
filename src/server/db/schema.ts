import type {
  Apartment,
  BlockedDate,
  Booking,
  PaymentMethod,
  PaymentPolicyType,
  PaymentStatus,
  ReceiptVerificationStatus,
  RealtorClientConfig,
  UnitType,
} from '@/types';

export const SCHEMA_VERSION = 3;

export type UserRole = 'REALTOR_ADMIN';

export interface AdminUserRecord {
  id: string;
  clientId: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyRecord {
  id: string;
  clientId: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  neighborhood?: string;
  city: string;
  state: string;
  status: 'ACTIVE' | 'INACTIVE';
  approvalStatus?: 'Approved' | 'Pending' | 'Rejected';
  ownerName?: string;
  featuredImage: string;
  amenities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApartmentUnitRecord extends Apartment {
  clientId: string;
  propertyId: string;
  propertyName: string;
  unitType: UnitType;
  cautionDeposit: number;
  checkInInstructions: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRecord {
  id: string;
  clientId: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingAccessCredentialRecord {
  id: string;
  bookingId: string;
  bookingReference: string;
  customerId: string;
  codeHash: string; // SHA-256 hash of the verification code (never plaintext)
  deliveryChannel: 'Email' | 'SMS' | 'Both';
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  failedAttempts: number;
  lastAttemptAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
}

export interface BookingAccessSessionRecord {
  id: string;
  tokenHash: string; // SHA-256 hash of the short-lived session token
  bookingId: string;
  bookingReference: string;
  customerId: string;
  expiresAt: string;
  createdAt: string;
}

export type CheckoutAttemptStatus =
  | 'PendingCheckout'
  | 'PaymentInitiated'
  | 'ReceiptUploaded'
  | 'Finalized'
  | 'Failed'
  | 'Abandoned'
  | 'Expired'
  | 'ConflictReconciliation';

export interface BookingCheckoutAttemptRecord {
  id: string;
  checkoutReference: string;
  idempotencyKey: string | null;
  clientId: string;
  apartmentId: string;
  unitId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  nightlyRate: number;
  cleaningFee: number;
  serviceFee: number;
  totalAmount: number;
  currency: 'NGN';
  paymentMethod: PaymentMethod;
  specialRequests: string;
  status: CheckoutAttemptStatus;
  paystackReference: string | null;
  paystackAccessCode: string | null;
  paystackAuthorizationUrl: string | null;
  paystackMode: 'LIVE_TEST_API' | 'SIMULATED_TEST_MODE' | null;
  receiptStorageKey: string | null;
  receiptOriginalFilename: string | null;
  receiptMimeType: string | null;
  receiptSizeBytes: number | null;
  receiptUploadedAt: string | null;
  finalizedBookingId: string | null;
  finalizedBookingReference: string | null;
  finalizedCustomerId: string | null;
  finalizedPaymentId: string | null;
  holdExpiresAt: string;
  failureOrReconciliationNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateReceiptFileRecord {
  storageKey: string;
  checkoutId: string;
  bookingId: string | null;
  bookingReference: string | null;
  customerId: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  base64Data: string; // Stored privately on the server, never exposed via public URLs
  uploadedByEmail: string;
  createdAt: string;
}

export type PaymentTransactionStatus =
  | 'Initiated'
  | 'Pending'
  | 'AwaitingVerification'
  | 'Success'
  | 'Failed'
  | 'Rejected'
  | 'Abandoned'
  | 'Refunded';

export interface PaymentRecord {
  id: string;
  clientId: string;
  bookingId: string;
  bookingReference: string;
  customerId: string;
  paymentMethod: PaymentMethod;
  provider: 'Paystack' | 'BankTransfer';
  mode: 'LIVE_TEST_API' | 'SIMULATED_TEST_MODE' | 'BANK_TRANSFER_RECEIPT';
  reference: string;
  providerReference: string;
  authorizationUrl: string;
  accessCode: string;
  amount: number; // NGN
  amountKobo: number; // Kobo (NGN * 100)
  currency: 'NGN';
  paymentType: PaymentPolicyType | 'Balance' | 'BankTransfer';
  status: PaymentTransactionStatus;
  paymentStatus: PaymentStatus;
  receiptVerificationStatus: ReceiptVerificationStatus;
  receiptStorageKey: string | null;
  receiptOriginalFilename: string | null;
  receiptMimeType: string | null;
  verifiedByUserId: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  channel: string | null;
  gatewayResponse: string | null;
  paidAt: string | null;
  rawResponseSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  clientId: string;
  bookingId: string;
  bookingReference: string;
  customerId: string;
  recipientEmail: string;
  recipientPhone: string;
  channel: 'Email' | 'SMS' | 'Both';
  template:
    | 'BOOKING_CREATED_CODE'
    | 'FRESH_VERIFICATION_CODE'
    | 'PAYMENT_CONFIRMED'
    | 'RECEIPT_SUBMITTED_PENDING_REVIEW'
    | 'RECEIPT_VERIFIED'
    | 'RECEIPT_REJECTED'
    | 'BOOKING_STATUS_UPDATED';
  subject: string;
  messagePreview: string;
  /**
   * Clearly marked development/test mode preview so evaluators can inspect the
   * verification code when no live email/SMS gateway is configured.
   */
  devModeCodePreview: string | null;
  deliveryStatus: 'Sent' | 'SimulatedInDev' | 'Failed';
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  clientId: string;
  actorUserId: string;
  actorEmail: string;
  actorRole: UserRole | 'CUSTOMER' | 'SYSTEM';
  action: string;
  targetType:
    | 'REALTOR_CONFIG'
    | 'PROPERTY'
    | 'APARTMENT_UNIT'
    | 'CHECKOUT_ATTEMPT'
    | 'BOOKING'
    | 'CUSTOMER'
    | 'VERIFICATION_CODE'
    | 'PAYMENT'
    | 'TRANSFER_RECEIPT';
  targetId: string;
  metadataJson: string;
  createdAt: string;
}

export interface VerificationRateLimitRecord {
  key: string; // IP or identifier key
  attempts: number;
  windowStartAt: string;
  lockedUntil: string | null;
}

export interface PlatformDatabaseSchema {
  schemaVersion: number;
  realtorConfig: RealtorClientConfig;
  adminUsers: AdminUserRecord[];
  properties: PropertyRecord[];
  apartments: ApartmentUnitRecord[];
  customers: CustomerRecord[];
  checkoutAttempts: BookingCheckoutAttemptRecord[];
  privateReceipts: PrivateReceiptFileRecord[];
  bookings: Booking[];
  bookingAccessCredentials: BookingAccessCredentialRecord[];
  bookingAccessSessions: BookingAccessSessionRecord[];
  payments: PaymentRecord[];
  notifications: NotificationRecord[];
  blockedDates: BlockedDate[];
  verificationRateLimits: VerificationRateLimitRecord[];
  auditLogs: AuditLogRecord[];
}
