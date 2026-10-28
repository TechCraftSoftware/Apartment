'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Apartment,
  AvailabilityBlock,
  Booking,
  BookingSource,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  PublicBookedInterval,
  RealtorClientConfig,
  ToastMessage,
} from '@/types';
import {
  DEFAULT_REALTOR_CLIENT_CONFIG,
  INITIAL_APARTMENTS,
} from '@/lib/seed-data';
import {
  buildPublicOccupiedIntervals,
  checkApartmentAvailability,
  getOverlappingBlocks,
  getOverlappingBookings,
} from '@/lib/availability';
import {
  calculateNights,
  formatDisplayDate,
  generateBookingReference,
} from '@/lib/utils';
import type {
  ApartmentUnitRecord,
  AuditLogRecord,
  CustomerRecord,
  NotificationRecord,
  PaymentRecord,
  PropertyRecord,
} from '@/server/db/schema';
import { storeBookingAccessToken } from '@/lib/bookingAccessClient';

const STORAGE_KEYS = {
  DEV_CODES: 'verdant_stays_dev_verification_codes_v1',
};

export interface CreateBookingInput {
  apartmentId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  specialRequests?: string;
  reference?: string;
  source?: BookingSource;
  initialStatus?: BookingStatus;
  initialPaymentStatus?: PaymentStatus;
  amountPaid?: number;
  adminNotes?: string;
}

export type ApartmentInput = Partial<Omit<Apartment, 'id'>> & {
  name: string;
  location: string;
  pricePerNight: number;
  maxGuests: number;
};

interface BookingContextValue {
  isHydrated: boolean;
  realtorConfig: RealtorClientConfig;
  properties: PropertyRecord[];
  apartments: ApartmentUnitRecord[];
  bookings: Booking[];
  blocks: AvailabilityBlock[];
  customers: CustomerRecord[];
  payments: PaymentRecord[];
  notifications: NotificationRecord[];
  auditLogs: AuditLogRecord[];
  publicOccupiedIntervals: PublicBookedInterval[];
  isAdminAuthenticated: boolean;
  /**
   * Map of bookingReference -> devModeVerificationCode so evaluators can
   * immediately test /my-booking after creating a booking or from admin re-issue.
   */
  devVerificationCodes: Record<string, string>;
  // Toasts
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  // Admin Auth
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => Promise<void>;
  recordDevVerificationCode: (bookingRef: string, rawCode: string | null | undefined) => void;
  // Platform State Refresh
  refreshPlatformState: () => Promise<void>;
  // Realtor Config
  updateRealtorConfig: (
    updates: Partial<RealtorClientConfig>
  ) => Promise<{ success: boolean; error?: string }>;
  // Bookings & Verification
  createBooking: (input: CreateBookingInput) => {
    success: boolean;
    booking?: Booking;
    devModeVerificationCode?: string | null;
    error?: string;
  };
  createBookingCheckoutAttempt: (input: {
    apartmentId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    checkIn: string;
    checkOut: string;
    guestCount: number;
    specialRequests?: string;
    paymentMethod: PaymentMethod;
  }) => Promise<{
    success: boolean;
    checkoutAttemptId?: string;
    expiresAt?: string;
    amount?: number;
    currency?: string;
    error?: string;
  }>;
  uploadTransferReceipt: (
    checkoutAttemptId: string,
    file: File
  ) => Promise<{
    success: boolean;
    receiptKey?: string;
    originalFilename?: string;
    error?: string;
  }>;
  submitBankTransferCheckout: (
    checkoutAttemptId: string,
    receiptKey: string,
    transferAmount?: number
  ) => Promise<{
    success: boolean;
    booking?: Booking;
    bookingReference?: string;
    devModeVerificationCode?: string;
    error?: string;
    conflictResolution?: {
      receiptKey: string;
      suggestedApartments?: any[];
      message: string;
    };
  }>;
  reviewBankTransferReceipt: (
    bookingId: string,
    reviewAction: 'VERIFY' | 'REJECT',
    rejectionReason?: string
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;
  createExternalBooking: (
    input: CreateBookingInput
  ) => Promise<{
    success: boolean;
    booking?: Booking;
    devModeVerificationCode?: string | null;
    error?: string;
  }>;
  updateBookingStatus: (
    bookingId: string,
    newStatus: BookingStatus,
    note?: string,
    newPaymentStatus?: PaymentStatus
  ) => Promise<{ success: boolean; error?: string }>;
  reissueVerificationCode: (
    bookingId: string
  ) => Promise<{
    success: boolean;
    devModeCodePreview?: string | null;
    expiresAt?: string;
    error?: string;
  }>;
  // Apartments & Units
  createApartment: (input: ApartmentInput) => {
    success: boolean;
    apartment?: Apartment;
    error?: string;
  };
  updateApartment: (
    id: string,
    input: Partial<ApartmentInput>
  ) => { success: boolean; apartment?: Apartment; error?: string };
  toggleApartmentActive: (id: string) => void;
  deleteApartment: (id: string) => { success: boolean; error?: string };
  // Availability Blocks
  createAvailabilityBlock: (
    apartmentId: string,
    startDate: string,
    endDate: string,
    reason: string
  ) => { success: boolean; block?: AvailabilityBlock; error?: string };
  removeAvailabilityBlock: (blockId: string) => void;
  setDateRangeAvailable: (
    apartmentId: string,
    startDate: string,
    endDate: string
  ) => { success: boolean; removedCount: number; error?: string };
  resetDemoData: () => void;
}

const DEFAULT_SEEDED_CODES: Record<string, string> = {
  'BK-2026-8421': '842101',
  'BK-2026-9104': '910402',
  'BK-2026-5532': '553203',
  'BK-2026-7719': '771904',
  'BK-2026-3390': '339005',
  'BK-2026-6128': '612806',
};

const BookingContext = createContext<BookingContextValue | undefined>(undefined);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [realtorConfig, setRealtorConfig] = useState<RealtorClientConfig>(
    DEFAULT_REALTOR_CLIENT_CONFIG
  );
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [apartments, setApartments] = useState<ApartmentUnitRecord[]>(
    INITIAL_APARTMENTS.map((apt) => ({
      ...apt,
      clientId: apt.clientId || DEFAULT_REALTOR_CLIENT_CONFIG.clientId,
      propertyId: apt.propertyId || 'prop-ikoyi-1',
      propertyName: apt.propertyName || apt.name,
      unitType: apt.unitType || '2 Bedroom',
      cautionDeposit: apt.cautionDeposit ?? 50000,
      checkInInstructions:
        apt.checkInInstructions ||
        DEFAULT_REALTOR_CLIENT_CONFIG.defaultCheckInInstructions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
  );
  // Bookings, blocks and other private records only arrive with an admin session.
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [serverPublicIntervals, setServerPublicIntervals] = useState<
    PublicBookedInterval[]
  >([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [devVerificationCodes, setDevVerificationCodes] =
    useState<Record<string, string>>(DEFAULT_SEEDED_CODES);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [
      ...prev,
      {
        ...toast,
        message: toast.message || toast.description || '',
        description: toast.description || toast.message || '',
        id,
      },
    ]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const recordDevCode = useCallback((bookingRef: string, rawCode: string | null | undefined) => {
    if (!bookingRef || !rawCode) return;
    setDevVerificationCodes((prev) => {
      const next = { ...prev, [bookingRef.toUpperCase()]: rawCode };
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(STORAGE_KEYS.DEV_CODES, JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  }, []);

  const applyServerState = useCallback(
    (data: {
      realtorConfig?: RealtorClientConfig;
      properties?: PropertyRecord[];
      apartments?: ApartmentUnitRecord[];
      bookings?: Booking[];
      blocks?: AvailabilityBlock[];
      blockedDates?: AvailabilityBlock[];
      customers?: CustomerRecord[];
      payments?: PaymentRecord[];
      notifications?: NotificationRecord[];
      auditLogs?: AuditLogRecord[];
      currentUser?: { id: string } | null;
      publicOccupiedIntervals?: PublicBookedInterval[];
    }) => {
      if ('currentUser' in data) {
        const isAdmin = Boolean(data.currentUser);
        setIsAdminAuthenticated(isAdmin);
        if (!isAdmin) {
          setBookings([]);
          setBlocks([]);
          setCustomers([]);
          setPayments([]);
          setNotifications([]);
          setAuditLogs([]);
        }
      }
      if (data.publicOccupiedIntervals) {
        setServerPublicIntervals(data.publicOccupiedIntervals);
      }
      if (data.realtorConfig) setRealtorConfig(data.realtorConfig);
      if (data.properties) setProperties(data.properties);
      if (data.apartments) setApartments(data.apartments);
      if (data.bookings) setBookings(data.bookings);
      if (data.blocks || data.blockedDates) {
        setBlocks(data.blocks || data.blockedDates || []);
      }
      if (data.customers) setCustomers(data.customers);
      if (data.payments) setPayments(data.payments);
      if (data.notifications) {
        setNotifications(data.notifications);
        const extractedCodes: Record<string, string> = {};
        for (const n of data.notifications) {
          if (
            n.bookingReference &&
            n.devModeCodePreview &&
            !extractedCodes[n.bookingReference.toUpperCase()]
          ) {
            extractedCodes[n.bookingReference.toUpperCase()] = n.devModeCodePreview;
          }
        }
        if (Object.keys(extractedCodes).length > 0) {
          setDevVerificationCodes((prev) => ({ ...prev, ...extractedCodes }));
        }
      }
      if (data.auditLogs) setAuditLogs(data.auditLogs);
    },
    []
  );

  const refreshPlatformState = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/state', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        applyServerState(data);
      }
    } catch (err) {
      console.error('Failed to fetch platform state from backend:', err);
    }
  }, [applyServerState]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedCodes = sessionStorage.getItem(STORAGE_KEYS.DEV_CODES);
        if (storedCodes) {
          const parsed = JSON.parse(storedCodes);
          setDevVerificationCodes((prev) => ({ ...prev, ...parsed }));
        }
      } catch {}
    }
    refreshPlatformState().finally(() => {
      setIsHydrated(true);
    });
  }, [refreshPlatformState]);

  const loginAdmin = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Invalid administrator email or password credentials.',
        };
      }
      await refreshPlatformState();
      addToast({
        type: 'success',
        title: 'Signed in to Realtor Admin Dashboard',
        message: `Welcome back to ${realtorConfig.businessName}.`,
      });
      return { success: true };
    } catch {
      return { success: false, error: 'Network error while signing in.' };
    }
  };

  const logoutAdmin = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    applyServerState({ currentUser: null });
    await refreshPlatformState();
    addToast({
      type: 'info',
      title: 'Signed out',
      message: 'Your Realtor Admin session has ended.',
    });
  };

  const updateRealtorConfig = async (updates: Partial<RealtorClientConfig>) => {
    try {
      const res = await fetch('/api/platform/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'UPDATE_REALTOR_CONFIG',
          config: updates,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast({
          type: 'error',
          title: 'Failed to Save Settings',
          message: data.error || 'Could not update realtor configuration.',
        });
        return { success: false, error: data.error };
      }
      if (data.state) applyServerState(data.state);
      addToast({
        type: 'success',
        title: 'Realtor Settings Updated',
        message: data.message || 'Client branding and booking policies saved.',
      });
      return { success: true };
    } catch {
      return { success: false, error: 'Network error while saving settings.' };
    }
  };

  const createBooking = (input: CreateBookingInput) => {
    const apartment = apartments.find((a) => a.id === input.apartmentId);
    if (!apartment) {
      return {
        success: false,
        error: 'Selected apartment could not be found.',
      };
    }
    if (!apartment.isActive && (!input.source || input.source === 'ONLINE')) {
      return {
        success: false,
        error:
          'This apartment unit is currently inactive and cannot accept online bookings.',
      };
    }
    if (input.guestCount < 1 || input.guestCount > apartment.maxGuests) {
      return {
        success: false,
        error: `Guest count must be between 1 and ${apartment.maxGuests} for this apartment.`,
      };
    }

    const availability = checkApartmentAvailability(
      apartment.id,
      input.checkIn,
      input.checkOut,
      bookings,
      blocks,
      { apartment, privacySafeMessages: true }
    );

    if (!availability.isAvailable) {
      return {
        success: false,
        error:
          availability.reason ||
          'The requested dates are no longer available. Please choose different dates.',
      };
    }

    const nights = calculateNights(input.checkIn, input.checkOut);
    if (nights <= 0) {
      return {
        success: false,
        error:
          'Invalid stay duration. Check-out must be at least 1 night after check-in.',
      };
    }

    const nowIso = new Date().toISOString();
    const reference = (input.reference || generateBookingReference()).toUpperCase();
    const nightlyRate = apartment.pricePerNight;
    const cleaningFee = apartment.cleaningFee || 0;
    const serviceFee = apartment.serviceFee || 0;
    const totalPrice = nights * nightlyRate + cleaningFee + serviceFee;
    const depositRequiredAmount =
      realtorConfig.paymentPolicy === 'Deposit'
        ? Math.round((totalPrice * realtorConfig.depositPercentage) / 100)
        : totalPrice;

    const newBooking: Booking = {
      id: `bk-${Date.now()}`,
      clientId: realtorConfig.clientId,
      reference,
      bookingReference: reference,
      apartmentId: apartment.id,
      propertyId: apartment.propertyId,
      source: input.source || 'ONLINE',
      guestName: input.guestName.trim(),
      guestEmail: input.guestEmail.trim(),
      guestPhone: input.guestPhone.trim(),
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guestCount,
      guestCount: input.guestCount,
      specialRequests: input.specialRequests?.trim() || '',
      nightlyRate,
      cleaningFee,
      serviceFee,
      totalPrice,
      totalAmount: totalPrice,
      depositRequiredAmount,
      amountPaid: 0,
      balanceAmount: totalPrice,
      currency: 'NGN',
      status: input.initialStatus || 'Pending',
      paymentStatus: input.initialPaymentStatus || 'Unpaid',
      paymentPolicySnapshot: realtorConfig.paymentPolicy,
      checkInInstructions:
        apartment.checkInInstructions || realtorConfig.defaultCheckInInstructions,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusHistory: [
        {
          status: input.initialStatus || 'Pending',
          timestamp: nowIso,
          note: 'Booking request submitted by guest. Verification code issued.',
        },
      ],
    };

    setBookings((prev) => [newBooking, ...prev]);

    fetch('/api/platform/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CREATE_BOOKING',
        booking: {
          id: newBooking.id,
          bookingReference: reference,
          apartmentId: apartment.id,
          guestName: newBooking.guestName,
          guestEmail: newBooking.guestEmail,
          guestPhone: newBooking.guestPhone,
          checkIn: newBooking.checkIn,
          checkOut: newBooking.checkOut,
          guests: newBooking.guests,
          specialRequests: newBooking.specialRequests,
          source: newBooking.source,
        },
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.devModeVerificationCode) {
          recordDevCode(reference, d.devModeVerificationCode);
        }
        if (d?.state) applyServerState(d.state);
      })
      .catch(() => {});

    addToast({
      type: 'success',
      title: 'Booking Request Recorded',
      message: `Reference ${reference} created. Check your verification code on the confirmation screen.`,
    });

    return { success: true, booking: newBooking };
  };

  const createExternalBooking = async (input: CreateBookingInput) => {
    try {
      const res = await fetch('/api/platform/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'CREATE_EXTERNAL_BOOKING',
          booking: {
            apartmentId: input.apartmentId,
            guestName: input.guestName,
            guestEmail: input.guestEmail,
            guestPhone: input.guestPhone,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            guests: input.guestCount,
            specialRequests: input.specialRequests,
            source: input.source || 'WHATSAPP',
            initialStatus: input.initialStatus || 'Confirmed',
            initialPaymentStatus: input.initialPaymentStatus || 'Unpaid',
            amountPaid: input.amountPaid || 0,
            adminNotes: input.adminNotes,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast({
          type: 'error',
          title: 'Cannot Record External Booking',
          message: data.error,
        });
        return { success: false, error: data.error };
      }
      if (data.devModeVerificationCode && data.booking?.bookingReference) {
        recordDevCode(data.booking.bookingReference, data.devModeVerificationCode);
      }
      if (data.state) applyServerState(data.state);
      addToast({
        type: 'success',
        title: 'External Booking Recorded',
        message: `Booking ${data.booking.bookingReference} (${data.booking.source}) added to calendar.`,
      });
      return {
        success: true,
        booking: data.booking,
        devModeVerificationCode: data.devModeVerificationCode,
      };
    } catch {
      return { success: false, error: 'Failed to create external booking.' };
    }
  };

  const createBookingCheckoutAttempt = async (input: {
    apartmentId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    checkIn: string;
    checkOut: string;
    guestCount: number;
    specialRequests?: string;
    paymentMethod: PaymentMethod;
  }) => {
    try {
      const res = await fetch('/api/checkout/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          guests: input.guestCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Failed to initialize checkout attempt.',
        };
      }
      return {
        success: true,
        checkoutAttemptId: data.checkout?.id || data.checkoutAttemptId,
        expiresAt: data.checkout?.expiresAt || data.expiresAt,
        amount: data.checkout?.totalAmount || data.amount,
        currency: data.checkout?.currency || data.currency || 'NGN',
      };
    } catch {
      return {
        success: false,
        error: 'Network error creating checkout attempt.',
      };
    }
  };

  const uploadTransferReceipt = async (
    checkoutAttemptId: string,
    file: File
  ) => {
    try {
      const formData = new FormData();
      formData.append('checkoutAttemptId', checkoutAttemptId);
      formData.append('receipt', file);

      const res = await fetch('/api/checkout/receipt', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Failed to upload receipt.',
        };
      }
      return {
        success: true,
        receiptKey: data.receiptKey,
        originalFilename: data.originalFilename,
      };
    } catch {
      return {
        success: false,
        error: 'Network error uploading receipt.',
      };
    }
  };

  const submitBankTransferCheckout = async (
    checkoutAttemptId: string,
    receiptKey: string,
    transferAmount?: number
  ) => {
    try {
      const res = await fetch('/api/checkout/submit-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutAttemptId, receiptKey, transferAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Failed to submit bank transfer booking.',
          conflictResolution: data.conflictResolution,
        };
      }
      const bookingReference: string | undefined =
        data.bookingReference || data.booking?.bookingReference;
      if (data.devModeVerificationCode && bookingReference) {
        recordDevCode(bookingReference, data.devModeVerificationCode);
      }
      storeBookingAccessToken(data.bookingAccessToken);
      await refreshPlatformState();
      return {
        success: true,
        booking: data.booking,
        bookingReference,
        devModeVerificationCode: data.devModeVerificationCode,
      };
    } catch {
      return {
        success: false,
        error: 'Network error submitting bank transfer checkout.',
      };
    }
  };

  const reviewBankTransferReceipt = async (
    bookingId: string,
    reviewAction: 'VERIFY' | 'REJECT',
    rejectionReason?: string
  ) => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/review-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewAction,
          rejectionReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast({
          type: 'error',
          title: 'Review Action Failed',
          message: data.error || 'Failed to process receipt review.',
        });
        return { success: false, error: data.error };
      }
      await refreshPlatformState();
      addToast({
        type: reviewAction === 'VERIFY' ? 'success' : 'info',
        title: reviewAction === 'VERIFY' ? 'Receipt Verified' : 'Receipt Rejected',
        message:
          data.message ||
          `Receipt has been ${reviewAction === 'VERIFY' ? 'verified' : 'rejected'}.`,
      });
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Network error reviewing receipt.',
      };
    }
  };

  const updateBookingStatus = async (
    bookingId: string,
    newStatus: BookingStatus,
    note?: string,
    newPaymentStatus?: PaymentStatus
  ): Promise<{ success: boolean; error?: string }> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) {
      return { success: false, error: 'Booking record not found.' };
    }

    if (newStatus === 'Confirmed') {
      const check = checkApartmentAvailability(
        target.apartmentId,
        target.checkIn,
        target.checkOut,
        bookings,
        blocks,
        {
          excludeBookingId: target.id,
          ignorePastDateCheck: true,
        }
      );

      if (!check.isAvailable) {
        addToast({
          type: 'error',
          title: 'Cannot Confirm Reservation',
          message:
            check.reason ||
            'Another reservation or maintenance block conflicts with these dates.',
        });
        return {
          success: false,
          error:
            check.reason ||
            'Conflict detected: another active reservation or block overlaps with these dates.',
        };
      }
    }

    const defaultNotes: Record<BookingStatus, string> = {
      PendingApproval: 'Status updated to Pending Approval.',
      Pending: 'Status returned to Pending review.',
      Confirmed: 'Reservation verified and confirmed by Realtor Admin.',
      Rejected: 'Booking request declined; dates released.',
      Cancelled: 'Reservation cancelled; dates released.',
      Completed: 'Guest stay completed.',
      Expired: 'Booking hold expired.',
    };

    try {
      const res = await fetch('/api/platform/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'UPDATE_BOOKING_STATUS',
          bookingId,
          status: newStatus,
          paymentStatus: newPaymentStatus,
          adminNotes: note || defaultNotes[newStatus],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast({
          type: 'error',
          title: 'Update Failed',
          message: data.error || 'Failed to update booking status.',
        });
        return { success: false, error: data.error };
      }

      if (data.state) {
        applyServerState(data.state);
      } else {
        await refreshPlatformState();
      }

      addToast({
        type: newStatus === 'Confirmed' ? 'success' : 'info',
        title: `Booking ${newStatus}`,
        message: `Reservation ${target.reference || target.bookingReference} (${target.guestName}) is now ${newStatus}.`,
      });

      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Network error updating booking status.',
      };
    }
  };

  const reissueVerificationCode = async (bookingId: string) => {
    try {
      const res = await fetch('/api/platform/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'REISSUE_VERIFICATION_CODE',
          bookingId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast({
          type: 'error',
          title: 'Failed to Re-issue Code',
          message: data.error,
        });
        return { success: false, error: data.error };
      }
      if (data.bookingReference && data.devModeCodePreview) {
        recordDevCode(data.bookingReference, data.devModeCodePreview);
      }
      if (data.state) applyServerState(data.state);
      addToast({
        type: 'success',
        title: 'Fresh Verification Code Issued',
        message: data.message,
      });
      return {
        success: true,
        devModeCodePreview: data.devModeCodePreview,
        expiresAt: data.expiresAt,
      };
    } catch {
      return { success: false, error: 'Failed to issue verification code.' };
    }
  };

  const createApartment = (input: ApartmentInput) => {
    if (!input.name.trim() || !input.location.trim()) {
      return {
        success: false,
        error: 'Apartment name and location are required.',
      };
    }
    if (input.pricePerNight <= 0) {
      return {
        success: false,
        error: 'Nightly price must be greater than ₦0.',
      };
    }

    const now = new Date().toISOString();
    const slug =
      input.slug ||
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    const location = input.location.trim();
    const area = input.area || input.neighborhood || 'Ikoyi';

    const newApartment: ApartmentUnitRecord = {
      shortDescription: input.shortDescription || input.name,
      description: input.description || input.name,
      city: input.city || 'Lagos',
      area,
      neighborhood: input.neighborhood || area,
      address: input.address || location,
      cleaningFee: input.cleaningFee ?? 15000,
      serviceFee: input.serviceFee ?? 10000,
      cautionDeposit: input.cautionDeposit ?? 50000,
      minStay: input.minStay || input.availabilityRules?.minNights || 1,
      bedrooms: input.bedrooms || 1,
      bathrooms: input.bathrooms || 1,
      sizeSqm: input.sizeSqm || 65,
      images: input.images || [],
      amenities: input.amenities || [],
      houseRules: input.houseRules || ['Check-in after 2:00 PM', 'No smoking inside'],
      availabilityRules: input.availabilityRules || {
        minNights: 1,
        maxNights: 60,
        checkInTime: '14:00',
        checkOutTime: '11:00',
      },
      featured: Boolean(input.featured),
      rating: input.rating || 5.0,
      reviewCount: input.reviewCount || 0,
      propertyId: input.propertyId || properties[0]?.id || 'prop-ikoyi-1',
      propertyName:
        input.propertyName ||
        properties[0]?.name ||
        realtorConfig.businessName,
      unitType: input.unitType || '2 Bedroom',
      checkInInstructions:
        input.checkInInstructions || realtorConfig.defaultCheckInInstructions,
      ...input,
      id: `apt-${slug}-${Date.now().toString().slice(-4)}`,
      slug,
      name: input.name.trim(),
      location,
      clientId: realtorConfig.clientId,
      status: input.isActive ? 'active' : 'inactive',
      isActive: Boolean(input.isActive),
      createdAt: now,
      updatedAt: now,
    };

    setApartments((prev) => [newApartment, ...prev]);

    fetch('/api/platform/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'SAVE_APARTMENT',
        apartment: newApartment,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.state) applyServerState(d.state);
      })
      .catch(() => {});

    addToast({
      type: 'success',
      title: 'Apartment Created',
      message: `"${newApartment.name}" has been added to listings.`,
    });

    return { success: true, apartment: newApartment };
  };

  const updateApartment = (id: string, input: Partial<ApartmentInput>) => {
    const existing = apartments.find((a) => a.id === id);
    if (!existing) {
      return { success: false, error: 'Apartment not found.' };
    }

    const nextIsActive =
      typeof input.isActive === 'boolean' ? input.isActive : existing.isActive;
    const updated: ApartmentUnitRecord = {
      ...existing,
      ...input,
      id,
      isActive: nextIsActive,
      status: nextIsActive ? 'active' : 'inactive',
      updatedAt: new Date().toISOString(),
    };

    setApartments((prev) => prev.map((a) => (a.id === id ? updated : a)));

    fetch('/api/platform/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'SAVE_APARTMENT',
        apartment: updated,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.state) applyServerState(d.state);
      })
      .catch(() => {});

    addToast({
      type: 'success',
      title: 'Apartment Updated',
      message: `Changes to "${updated.name}" have been saved.`,
    });

    return { success: true, apartment: updated };
  };

  const toggleApartmentActive = (id: string) => {
    const target = apartments.find((a) => a.id === id);
    if (!target) return;
    const nextStatus = !target.isActive;
    updateApartment(id, {
      isActive: nextStatus,
      status: nextStatus ? 'active' : 'inactive',
    });
  };

  const deleteApartment = (id: string) => {
    const activeBks = bookings.filter(
      (b) =>
        b.apartmentId === id &&
        (b.status === 'Confirmed' || b.status === 'Pending')
    );
    if (activeBks.length > 0) {
      const msg = `Cannot delete apartment with ${activeBks.length} active (Pending/Confirmed) reservation(s). Deactivate the listing or resolve reservations first.`;
      addToast({
        type: 'error',
        title: 'Deletion Prevented',
        message: msg,
      });
      return { success: false, error: msg };
    }

    const target = apartments.find((a) => a.id === id);
    setApartments((prev) => prev.filter((a) => a.id !== id));
    setBlocks((prev) => prev.filter((bl) => bl.apartmentId !== id));

    fetch('/api/platform/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'DELETE_APARTMENT',
        apartmentId: id,
      }),
    }).catch(() => {});

    addToast({
      type: 'info',
      title: 'Apartment Removed',
      message: target ? `"${target.name}" was deleted.` : 'Listing deleted.',
    });
    return { success: true };
  };

  const createAvailabilityBlock = (
    apartmentId: string,
    startDate: string,
    endDate: string,
    reason: string
  ) => {
    if (!apartmentId || !startDate || !endDate) {
      return {
        success: false,
        error: 'Apartment, start date, and end date are required.',
      };
    }
    if (endDate <= startDate) {
      return {
        success: false,
        error: 'End date (exclusive) must be after the start date.',
      };
    }
    if (!reason.trim()) {
      return {
        success: false,
        error:
          'Please provide a reason for blocking these dates (e.g., Maintenance, Personal use).',
      };
    }

    const overlappingBookings = getOverlappingBookings(
      apartmentId,
      startDate,
      endDate,
      bookings
    );

    if (overlappingBookings.length > 0) {
      const confirmedConflict = overlappingBookings.find(
        (b) => b.status === 'Confirmed'
      );
      if (confirmedConflict) {
        const err = `Conflict with Confirmed Reservation ${confirmedConflict.reference} (${confirmedConflict.guestName}: ${formatDisplayDate(confirmedConflict.checkIn)} – ${formatDisplayDate(confirmedConflict.checkOut)}). Confirmed reservations cannot be overwritten by a date block.`;
        return { success: false, error: err };
      }

      const pendingConflict = overlappingBookings[0];
      const err = `Conflict with Pending Booking Request ${pendingConflict.reference} (${pendingConflict.guestName}: ${formatDisplayDate(pendingConflict.checkIn)} – ${formatDisplayDate(pendingConflict.checkOut)}). Please reject or resolve the pending booking request before blocking these dates.`;
      return { success: false, error: err };
    }

    const overlappingBlocks = getOverlappingBlocks(
      apartmentId,
      startDate,
      endDate,
      blocks
    );
    if (overlappingBlocks.length > 0) {
      const firstBlk = overlappingBlocks[0];
      return {
        success: false,
        error: `Selected dates already overlap an existing block (${formatDisplayDate(firstBlk.startDate)} – ${formatDisplayDate(firstBlk.endDate)}: "${firstBlk.reason}").`,
      };
    }

    const newBlock: AvailabilityBlock = {
      id: `blk-${Date.now()}`,
      apartmentId,
      startDate,
      endDate,
      reason: reason.trim(),
      createdAt: new Date().toISOString(),
    };

    setBlocks((prev) => [...prev, newBlock]);

    fetch('/api/platform/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'ADD_BLOCKED_DATE',
        blockedDate: newBlock,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.state) applyServerState(d.state);
      })
      .catch(() => {});

    addToast({
      type: 'success',
      title: 'Dates Blocked',
      message: `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)} marked unavailable (${reason.trim()}).`,
    });

    return { success: true, block: newBlock };
  };

  const removeAvailabilityBlock = (blockId: string) => {
    const target = blocks.find((bl) => bl.id === blockId);
    setBlocks((prev) => prev.filter((bl) => bl.id !== blockId));

    fetch('/api/platform/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'REMOVE_BLOCKED_DATE',
        blockId,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.state) applyServerState(d.state);
      })
      .catch(() => {});

    if (target) {
      addToast({
        type: 'info',
        title: 'Availability Block Removed',
        message: `${formatDisplayDate(target.startDate)} – ${formatDisplayDate(target.endDate)} is now open for bookings.`,
      });
    }
  };

  const setDateRangeAvailable = (
    apartmentId: string,
    startDate: string,
    endDate: string
  ) => {
    if (!apartmentId || !startDate || !endDate || endDate <= startDate) {
      return {
        success: false,
        removedCount: 0,
        error: 'Please select a valid date range.',
      };
    }

    const overlappingBookings = getOverlappingBookings(
      apartmentId,
      startDate,
      endDate,
      bookings
    );
    if (overlappingBookings.length > 0) {
      const first = overlappingBookings[0];
      const msg = `Cannot mark dates as available because they overlap with ${first.status.toLowerCase()} reservation ${first.reference} (${first.guestName}).`;
      addToast({
        type: 'error',
        title: 'Protected Reservation Dates',
        message: msg,
      });
      return { success: false, removedCount: 0, error: msg };
    }

    const overlappingBlocks = getOverlappingBlocks(
      apartmentId,
      startDate,
      endDate,
      blocks
    );

    if (overlappingBlocks.length === 0) {
      addToast({
        type: 'info',
        title: 'Dates Already Available',
        message: 'No administrative blocks exist in the selected range.',
      });
      return { success: true, removedCount: 0 };
    }

    overlappingBlocks.forEach((blk) => {
      removeAvailabilityBlock(blk.id);
    });

    return { success: true, removedCount: overlappingBlocks.length };
  };

  const resetDemoData = () => {
    fetch('/api/platform/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'RESET_DEMO_DATA' }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok) {
          addToast({
            type: 'error',
            title: 'Demo Reset Failed',
            message: d?.error || 'Only a signed-in Realtor Admin can reset demo data.',
          });
          return;
        }
        if (d?.state) applyServerState(d.state);
        setDevVerificationCodes(DEFAULT_SEEDED_CODES);
        addToast({
          type: 'success',
          title: 'Demo Data Reset',
          message:
            'All sample properties, units, bookings, verification codes, and Paystack test records have been restored.',
        });
      })
      .catch(() => {});
  };

  // Admins derive intervals from the full records they hold; visitors use the
  // neutral intervals the server computed for them.
  const publicOccupiedIntervals = useMemo(
    () =>
      isAdminAuthenticated
        ? buildPublicOccupiedIntervals(bookings, blocks)
        : serverPublicIntervals,
    [isAdminAuthenticated, bookings, blocks, serverPublicIntervals]
  );

  return (
    <BookingContext.Provider
      value={{
        isHydrated,
        realtorConfig,
        properties,
        apartments,
        bookings,
        blocks,
        customers,
        payments,
        notifications,
        auditLogs,
        publicOccupiedIntervals,
        isAdminAuthenticated,
        devVerificationCodes,
        toasts,
        addToast,
        removeToast,
        loginAdmin,
        logoutAdmin,
        recordDevVerificationCode: recordDevCode,
        refreshPlatformState,
        updateRealtorConfig,
        createBooking,
        createBookingCheckoutAttempt,
        uploadTransferReceipt,
        submitBankTransferCheckout,
        reviewBankTransferReceipt,
        createExternalBooking,
        updateBookingStatus,
        reissueVerificationCode,
        createApartment,
        updateApartment,
        toggleApartmentActive,
        deleteApartment,
        createAvailabilityBlock,
        removeAvailabilityBlock,
        setDateRangeAvailable,
        resetDemoData,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBookingContext() {
  const ctx = useContext(BookingContext);
  if (!ctx) {
    throw new Error('useBookingContext must be used within a BookingProvider');
  }
  return ctx;
}
