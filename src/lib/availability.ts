import {
  Apartment,
  AvailabilityBlock,
  AvailabilityCheckResult,
  Booking,
  DayAvailabilityInfo,
  PublicAvailabilityCheckResult,
  PublicBookedInterval,
  PublicDayStatus,
  SearchFilters,
} from '@/types';
import { calculateNights, formatDisplayDate, getTodayStr } from './utils';

/**
 * Convention:
 * - checkIn / startDate is INCLUSIVE
 * - checkOut / endDate is EXCLUSIVE
 * A guest checking out on 2026-10-20 does NOT block another guest checking in on 2026-10-20.
 * Two ranges [startA, endA) and [startB, endB) overlap if and only if startA < endB && endA > startB.
 */
export function doDateRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  if (!startA || !endA || !startB || !endB) return false;
  return startA < endB && endA > startB;
}

/**
 * Returns true if the booking status represents a pending booking awaiting admin approval.
 */
export function isPendingBookingStatus(status: Booking['status']): boolean {
  return status === 'PendingApproval' || status === 'Pending';
}

/**
 * Returns true if the booking status actively holds/blocks calendar dates.
 * Policy: Both 'Confirmed' and 'PendingApproval'/'Pending' bookings block dates to prevent double-booking requests.
 * 'Cancelled', 'Rejected', and 'Expired' bookings release their dates immediately.
 */
export function isBlockingBookingStatus(status: Booking['status']): boolean {
  return status === 'Confirmed' || isPendingBookingStatus(status);
}

/**
 * PRIVACY BOUNDARY TRANSFORMER:
 * Converts internal bookings and administrative blocks into sanitized public intervals.
 * Strips all guest names, emails, phones, booking references, internal IDs, payment amounts,
 * special requests, timestamps, and administrative block reasons.
 */
export function buildPublicOccupiedIntervals(
  bookings: Booking[],
  blocks: AvailabilityBlock[]
): PublicBookedInterval[] {
  const bookedIntervals: PublicBookedInterval[] = bookings
    .filter((b) => isBlockingBookingStatus(b.status))
    .map((b) => ({
      apartmentId: b.apartmentId,
      startDate: b.checkIn,
      endDate: b.checkOut,
      status: 'booked',
    }));

  const unavailableIntervals: PublicBookedInterval[] = blocks.map((bl) => ({
    apartmentId: bl.apartmentId,
    startDate: bl.startDate,
    endDate: bl.endDate,
    status: 'unavailable',
  }));

  return [...bookedIntervals, ...unavailableIntervals];
}

/**
 * Determines the public privacy-safe status of a single calendar night `dateStr`
 * ([dateStr, dateStr + 1 day)) using ONLY sanitized `PublicBookedInterval[]`.
 */
export function getPublicDayStatus(
  apartmentId: string,
  dateStr: string,
  occupiedIntervals: PublicBookedInterval[],
  markPastAsUnavailable = true
): PublicDayStatus {
  const today = getTodayStr();

  // Check if occupied by a reservation ('booked')
  const isBooked = occupiedIntervals.some(
    (interval) =>
      interval.apartmentId === apartmentId &&
      interval.status === 'booked' &&
      dateStr >= interval.startDate &&
      dateStr < interval.endDate
  );
  if (isBooked) {
    return 'booked';
  }

  // Check if blocked by administrator ('unavailable')
  const isUnavailable = occupiedIntervals.some(
    (interval) =>
      interval.apartmentId === apartmentId &&
      interval.status === 'unavailable' &&
      dateStr >= interval.startDate &&
      dateStr < interval.endDate
  );
  if (isUnavailable) {
    return 'unavailable';
  }

  if (markPastAsUnavailable && dateStr < today) {
    return 'past';
  }

  return 'available';
}

/**
 * Privacy-safe availability check for public visitors.
 * Uses ONLY sanitized `PublicBookedInterval[]` and never exposes guest details,
 * booking references, or administrative block reasons.
 */
export function checkPublicApartmentAvailability(
  apartmentId: string,
  checkIn: string,
  checkOut: string,
  occupiedIntervals: PublicBookedInterval[],
  apartment?: Apartment
): PublicAvailabilityCheckResult {
  if (!checkIn || !checkOut) {
    return {
      isAvailable: false,
      reason: 'Please select both check-in and check-out dates.',
      conflictType: 'invalid',
    };
  }

  if (checkOut <= checkIn) {
    return {
      isAvailable: false,
      reason: 'Check-out date must be after the check-in date.',
      conflictType: 'invalid',
    };
  }

  const today = getTodayStr();
  if (checkIn < today) {
    return {
      isAvailable: false,
      reason: 'Check-in date cannot be in the past.',
      conflictType: 'invalid',
    };
  }

  if (apartment) {
    const nights = calculateNights(checkIn, checkOut);
    const minNights = apartment.availabilityRules?.minNights || 1;
    const maxNights = apartment.availabilityRules?.maxNights || 90;
    if (nights < minNights) {
      return {
        isAvailable: false,
        reason: `This apartment requires a minimum stay of ${minNights} night${
          minNights > 1 ? 's' : ''
        }.`,
        conflictType: 'rules',
      };
    }
    if (nights > maxNights) {
      return {
        isAvailable: false,
        reason: `Maximum stay length for this apartment is ${maxNights} nights.`,
        conflictType: 'rules',
      };
    }
  }

  const overlapping = occupiedIntervals.filter(
    (interval) =>
      interval.apartmentId === apartmentId &&
      doDateRangesOverlap(checkIn, checkOut, interval.startDate, interval.endDate)
  );

  const bookedConflict = overlapping.find((i) => i.status === 'booked');
  if (bookedConflict) {
    return {
      isAvailable: false,
      reason:
        'One or more dates in your selected range are already Booked. Please select open dates.',
      conflictType: 'booked',
    };
  }

  const unavailableConflict = overlapping.find(
    (i) => i.status === 'unavailable'
  );
  if (unavailableConflict) {
    return {
      isAvailable: false,
      reason:
        'One or more dates in your selected range are Unavailable. Please select open dates.',
      conflictType: 'unavailable',
    };
  }

  return {
    isAvailable: true,
  };
}

/**
 * Finds all active (Pending or Confirmed) bookings for an apartment that overlap [startDate, endDate).
 * Used by Admin workflows and booking creation validation.
 */
export function getOverlappingBookings(
  apartmentId: string,
  startDate: string,
  endDate: string,
  bookings: Booking[],
  excludeBookingId?: string
): Booking[] {
  return bookings.filter((b) => {
    if (b.apartmentId !== apartmentId) return false;
    if (excludeBookingId && b.id === excludeBookingId) return false;
    if (!isBlockingBookingStatus(b.status)) return false;
    return doDateRangesOverlap(startDate, endDate, b.checkIn, b.checkOut);
  });
}

/**
 * Finds all availability blocks for an apartment that overlap [startDate, endDate).
 * Optionally excludes a specific block ID.
 */
export function getOverlappingBlocks(
  apartmentId: string,
  startDate: string,
  endDate: string,
  blocks: AvailabilityBlock[],
  excludeBlockId?: string
): AvailabilityBlock[] {
  return blocks.filter((bl) => {
    if (bl.apartmentId !== apartmentId) return false;
    if (excludeBlockId && bl.id === excludeBlockId) return false;
    return doDateRangesOverlap(startDate, endDate, bl.startDate, bl.endDate);
  });
}

/**
 * Comprehensive check for whether an apartment is available for [checkIn, checkOut).
 * Used by Admin Dashboard & internal validation.
 */
export function checkApartmentAvailability(
  apartmentId: string,
  checkIn: string,
  checkOut: string,
  bookings: Booking[],
  blocks: AvailabilityBlock[],
  options?: {
    excludeBookingId?: string;
    ignorePastDateCheck?: boolean;
    apartment?: Apartment;
    privacySafeMessages?: boolean;
  }
): AvailabilityCheckResult {
  if (!checkIn || !checkOut) {
    return {
      isAvailable: false,
      reason: 'Please select both check-in and check-out dates.',
      conflictingBookings: [],
      conflictingBlocks: [],
    };
  }

  if (checkOut <= checkIn) {
    return {
      isAvailable: false,
      reason: 'Check-out date must be after the check-in date.',
      conflictingBookings: [],
      conflictingBlocks: [],
    };
  }

  const today = getTodayStr();
  if (!options?.ignorePastDateCheck && checkIn < today) {
    return {
      isAvailable: false,
      reason: 'Check-in date cannot be in the past.',
      conflictingBookings: [],
      conflictingBlocks: [],
    };
  }

  if (options?.apartment) {
    const nights = calculateNights(checkIn, checkOut);
    const minNights = options.apartment.availabilityRules?.minNights || 1;
    const maxNights = options.apartment.availabilityRules?.maxNights || 90;
    if (nights < minNights) {
      return {
        isAvailable: false,
        reason: `This apartment requires a minimum stay of ${minNights} night${minNights > 1 ? 's' : ''}.`,
        conflictingBookings: [],
        conflictingBlocks: [],
      };
    }
    if (nights > maxNights) {
      return {
        isAvailable: false,
        reason: `Maximum stay length for this apartment is ${maxNights} nights.`,
        conflictingBookings: [],
        conflictingBlocks: [],
      };
    }
  }

  const conflictingBookings = getOverlappingBookings(
    apartmentId,
    checkIn,
    checkOut,
    bookings,
    options?.excludeBookingId
  );

  const conflictingBlocks = getOverlappingBlocks(
    apartmentId,
    checkIn,
    checkOut,
    blocks
  );

  if (conflictingBookings.length > 0) {
    if (options?.privacySafeMessages) {
      return {
        isAvailable: false,
        reason:
          'One or more dates in your selected range are already Booked. Please select an open date range.',
        conflictingBookings,
        conflictingBlocks,
      };
    }
    const first = conflictingBookings[0];
    const statusLabel =
      first.status === 'Confirmed'
        ? 'a confirmed reservation'
        : 'a pending booking request';
    return {
      isAvailable: false,
      reason: `Selected dates overlap with ${statusLabel} (${formatDisplayDate(
        first.checkIn
      )} – ${formatDisplayDate(first.checkOut)}).`,
      conflictingBookings,
      conflictingBlocks,
    };
  }

  if (conflictingBlocks.length > 0) {
    if (options?.privacySafeMessages) {
      return {
        isAvailable: false,
        reason:
          'One or more dates in your selected range are Unavailable. Please select an open date range.',
        conflictingBookings,
        conflictingBlocks,
      };
    }
    const first = conflictingBlocks[0];
    return {
      isAvailable: false,
      reason: `Selected dates include unavailable/blocked dates (${formatDisplayDate(
        first.startDate
      )} – ${formatDisplayDate(first.endDate)}: ${first.reason}).`,
      conflictingBookings,
      conflictingBlocks,
    };
  }

  return {
    isAvailable: true,
    conflictingBookings: [],
    conflictingBlocks: [],
  };
}

/**
 * Determines the full administrative status of a specific calendar night `dateStr`
 * for the Admin Dashboard & Admin Calendar.
 */
export function getDayAvailabilityStatus(
  apartmentId: string,
  dateStr: string,
  bookings: Booking[],
  blocks: AvailabilityBlock[],
  markPastAsUnavailable = false
): DayAvailabilityInfo {
  const today = getTodayStr();

  // Check confirmed bookings first (dateStr >= checkIn && dateStr < checkOut)
  const confirmedBooking = bookings.find(
    (b) =>
      b.apartmentId === apartmentId &&
      b.status === 'Confirmed' &&
      dateStr >= b.checkIn &&
      dateStr < b.checkOut
  );
  if (confirmedBooking) {
    return {
      date: dateStr,
      status: 'confirmed',
      booking: confirmedBooking,
    };
  }

  // Check pending bookings (PendingApproval or Pending)
  const pendingBooking = bookings.find(
    (b) =>
      b.apartmentId === apartmentId &&
      isPendingBookingStatus(b.status) &&
      dateStr >= b.checkIn &&
      dateStr < b.checkOut
  );
  if (pendingBooking) {
    return {
      date: dateStr,
      status: 'pending',
      booking: pendingBooking,
    };
  }

  // Check maintenance/admin blocks
  const block = blocks.find(
    (bl) =>
      bl.apartmentId === apartmentId &&
      dateStr >= bl.startDate &&
      dateStr < bl.endDate
  );
  if (block) {
    return {
      date: dateStr,
      status: 'blocked',
      block,
    };
  }

  if (markPastAsUnavailable && dateStr < today) {
    return {
      date: dateStr,
      status: 'past',
    };
  }

  return {
    date: dateStr,
    status: 'available',
  };
}

/**
 * Calculates total amount for a stay
 */
export function calculateBookingTotal(
  pricePerNight: number,
  checkIn: string,
  checkOut: string
): { nights: number; totalAmount: number } {
  const nights = calculateNights(checkIn, checkOut);
  return {
    nights,
    totalAmount: nights * pricePerNight,
  };
}

/**
 * Filters public apartments by active status, date range availability, guest capacity, price, bedrooms, and search query.
 * Uses sanitized `PublicBookedInterval[]` so no private booking records are needed by public catalog pages.
 */
export function filterPublicApartments(
  apartments: Apartment[],
  occupiedIntervals: PublicBookedInterval[],
  filters: SearchFilters
): Apartment[] {
  return apartments.filter((apt) => {
    // Must be active and approved for public customers
    if (!apt.isActive) return false;
    if (apt.approvalStatus && apt.approvalStatus !== 'Approved') return false;

    // Guest capacity filter
    if (filters.guests && filters.guests > 0 && apt.maxGuests < filters.guests) {
      return false;
    }

    // Price range filter
    if (
      typeof filters.minPrice === 'number' &&
      !Number.isNaN(filters.minPrice) &&
      apt.pricePerNight < filters.minPrice
    ) {
      return false;
    }
    if (
      typeof filters.maxPrice === 'number' &&
      !Number.isNaN(filters.maxPrice) &&
      filters.maxPrice > 0 &&
      apt.pricePerNight > filters.maxPrice
    ) {
      return false;
    }

    // Bedrooms filter
    if (
      filters.bedrooms !== undefined &&
      filters.bedrooms !== 'all' &&
      apt.bedrooms < filters.bedrooms
    ) {
      return false;
    }

    // Text search filter
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchesName = apt.name.toLowerCase().includes(q);
      const matchesLocation = apt.location.toLowerCase().includes(q);
      const matchesDesc = apt.shortDescription.toLowerCase().includes(q);
      const matchesAmenity = apt.amenities.some((a) =>
        a.toLowerCase().includes(q)
      );
      if (!matchesName && !matchesLocation && !matchesDesc && !matchesAmenity) {
        return false;
      }
    }

    // Date range availability filter using privacy-safe public intervals
    if (
      filters.checkIn &&
      filters.checkOut &&
      filters.checkOut > filters.checkIn
    ) {
      const availability = checkPublicApartmentAvailability(
        apt.id,
        filters.checkIn,
        filters.checkOut,
        occupiedIntervals,
        apt
      );
      if (!availability.isAvailable) {
        return false;
      }
    }

    return true;
  });
}

export function hasBookingConflict(
  apartmentId: string,
  checkIn: string,
  checkOut: string,
  bookings: Booking[],
  excludeBookingId?: string
): boolean {
  return (
    getOverlappingBookings(
      apartmentId,
      checkIn,
      checkOut,
      bookings,
      excludeBookingId
    ).length > 0
  );
}

export function hasBlockedDateConflict(
  apartmentId: string,
  checkIn: string,
  checkOut: string,
  blocks: AvailabilityBlock[],
  excludeBlockId?: string
): boolean {
  return (
    getOverlappingBlocks(
      apartmentId,
      checkIn,
      checkOut,
      blocks,
      excludeBlockId
    ).length > 0
  );
}

export function getPublicUnavailableIntervals(
  bookings: Booking[],
  blocks: AvailabilityBlock[],
  apartmentId?: string
): PublicBookedInterval[] {
  const all = buildPublicOccupiedIntervals(bookings, blocks);
  if (!apartmentId) return all;
  return all.filter((i) => i.apartmentId === apartmentId);
}

