export type BookingStatus =
  | 'PendingApproval'
  | 'Pending'
  | 'Confirmed'
  | 'Rejected'
  | 'Cancelled'
  | 'Completed'
  | 'Expired';

export type PaymentMethod = 'Paystack' | 'BankTransfer';

export type PaymentStatus =
  | 'Unpaid'
  | 'Pending'
  | 'AwaitingVerification'
  | 'Partially Paid'
  | 'DepositPaid'
  | 'Paid'
  | 'Failed'
  | 'Rejected'
  | 'Refunded'
  | 'Partially Refunded';

export type ReceiptVerificationStatus =
  | 'NotApplicable'
  | 'PendingReview'
  | 'Verified'
  | 'Rejected';

export type PaymentPolicyType = 'FullPayment' | 'Deposit' | 'PayAfterApproval';

export type BookingSource =
  | 'ONLINE'
  | 'PUBLIC_MARKETPLACE'
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'PHONE'
  | 'WALK_IN'
  | 'AGENT';

export type ApartmentStatus = 'active' | 'inactive';

export type UnitType =
  | 'Studio'
  | '1 Bedroom'
  | '2 Bedroom'
  | '3 Bedroom'
  | 'Penthouse'
  | 'Short-let Suite';

export type PublicDateStatus = 'Available' | 'Booked' | 'Unavailable';
export type PublicDayStatus = 'available' | 'booked' | 'unavailable' | 'past';

export interface RealtorClientConfig {
  clientId: string;
  businessName: string;
  tagline: string;
  domain: string;
  primaryColor: string;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string;
  officeAddress: string;
  currency: 'NGN';
  paymentPolicy: PaymentPolicyType;
  depositPercentage: number;
  verificationCodeExpiryMinutes: number;
  verificationMaxAttempts: number;
  bookingHoldMinutes: number;
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  cancellationPolicySummary: string;
  defaultCheckInInstructions: string;
  bankTransferBeneficiaryName: string;
  bankTransferBankName: string;
  bankTransferAccountNumber: string;
  bankTransferInstructions: string;
  updatedAt: string;
}

export interface ApartmentAvailabilityRules {
  minNights: number;
  maxNights: number;
  checkInTime: string;
  checkOutTime: string;
  allowSameDayTurnover?: boolean;
}

export interface Apartment {
  id: string;
  clientId?: string;
  propertyId?: string;
  propertyName?: string;
  unitType?: UnitType;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  location: string;
  city: string;
  area: string;
  neighborhood: string;
  address: string;
  pricePerNight: number;
  cleaningFee: number;
  serviceFee: number;
  cautionDeposit?: number;
  minStay: number;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  sizeSqm: number;
  images: string[];
  amenities: string[];
  houseRules: string[];
  checkInInstructions?: string;
  availabilityRules: ApartmentAvailabilityRules;
  status: ApartmentStatus;
  isActive: boolean;
  featured: boolean;
  rating: number;
  reviewCount: number;
  approvalStatus?: 'Approved' | 'Pending' | 'Rejected';
  ownerId?: string;
  ownerName?: string;
}

export interface BookingStatusHistoryEntry {
  status: BookingStatus;
  timestamp: string;
  note?: string;
}

export interface Booking {
  id: string;
  clientId?: string;
  reference: string;
  bookingReference: string;
  apartmentId: string;
  unitId?: string;
  propertyId?: string;
  customerId?: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  guests: number;
  guestCount: number;
  nightlyRate: number; // Snapshot of agreed nightly rate
  cleaningFee?: number; // Snapshot of agreed cleaning fee
  serviceFee?: number; // Snapshot of agreed service fee
  totalPrice: number;
  totalAmount: number;
  depositRequiredAmount?: number;
  amountPaid?: number;
  balanceAmount?: number;
  currency?: 'NGN';
  status: BookingStatus;
  bookingStatus?: BookingStatus;
  paymentMethod?: PaymentMethod;
  paymentStatus: PaymentStatus;
  receiptVerificationStatus?: ReceiptVerificationStatus;
  receiptStorageKey?: string | null;
  receiptOriginalFilename?: string | null;
  receiptMimeType?: string | null;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  holdExpiresAt?: string | null;
  checkoutAttemptId?: string | null;
  paymentPolicySnapshot?: PaymentPolicyType;
  source?: BookingSource;
  specialRequests?: string;
  adminNotes?: string;
  checkInInstructions?: string;
  statusHistory: BookingStatusHistoryEntry[];
  createdAt: string; // ISO string
  updatedAt: string;
}

export interface AvailabilityBlock {
  id: string;
  apartmentId: string;
  startDate: string; // YYYY-MM-DD (inclusive)
  endDate: string; // YYYY-MM-DD (exclusive or end date)
  reason: string; // Internal only — NEVER exposed on public endpoints or components
  createdAt?: string;
}

export type BlockedDate = AvailabilityBlock;

/**
 * Sanitized public availability interval.
 * Strictly excludes guest names, emails, phones, booking references, payment data,
 * special requests, internal IDs, and administrator block reasons.
 */
export interface PublicBookedInterval {
  apartmentId: string;
  startDate: string; // YYYY-MM-DD (inclusive)
  endDate: string; // YYYY-MM-DD (exclusive)
  status: 'booked' | 'unavailable';
}

export type PublicUnavailableInterval = PublicBookedInterval;

export interface PublicAvailabilityCheckResult {
  isAvailable: boolean;
  reason?: string;
  conflictType?: 'booked' | 'unavailable' | 'rules' | 'invalid';
}

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  reason?: string;
  conflictingBookings: Booking[];
  conflictingBlocks: AvailabilityBlock[];
}

export interface DayAvailabilityInfo {
  date: string;
  status: 'available' | 'confirmed' | 'pending' | 'blocked' | 'past';
  booking?: Booking;
  block?: AvailabilityBlock;
}

export interface CustomerBookingVerifiedView {
  bookingId: string;
  bookingReference: string;
  apartmentId: string;
  apartmentName: string;
  apartmentLocation: string;
  apartmentAddress: string;
  apartmentImage: string;
  unitType: string;
  customerFullName: string;
  customerMaskedEmail: string;
  customerMaskedPhone: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  nightlyRate: number;
  cleaningFee: number;
  serviceFee: number;
  totalPrice: number;
  depositRequiredAmount: number;
  amountPaid: number;
  balanceAmount: number;
  currency: 'NGN';
  status: BookingStatus;
  bookingStatus: BookingStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  receiptVerificationStatus: ReceiptVerificationStatus;
  hasUploadedReceipt: boolean;
  receiptStorageKey: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  paymentPolicy: PaymentPolicyType;
  specialRequests?: string;
  checkInTime: string;
  checkOutTime: string;
  checkInInstructions?: string;
  cancellationPolicySummary: string;
  realtorBusinessName: string;
  realtorContactEmail: string;
  realtorContactPhone: string;
  realtorWhatsapp: string;
  canPayNow: boolean;
  canCancelBooking: boolean;
  nextStepsSummary: string;
  payments: {
    id: string;
    reference: string;
    providerReference: string;
    paymentMethod: PaymentMethod;
    amount: number;
    currency: 'NGN';
    status: string;
    paymentStatus: PaymentStatus;
    receiptVerificationStatus: ReceiptVerificationStatus;
    receiptStorageKey: string | null;
    paymentType: string;
    mode: 'LIVE_TEST_API' | 'SIMULATED_TEST_MODE' | 'BANK_TRANSFER_RECEIPT';
    paidAt: string | null;
    verifiedAt: string | null;
    createdAt: string;
  }[];
  createdAt: string;
}

export interface SearchFilters {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  city?: string;
  bedrooms?: number | 'all';
  minPrice?: number;
  maxPrice?: number;
  searchQuery?: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  description?: string;
  type: 'success' | 'error' | 'info';
}
