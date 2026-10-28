'use client';

import React from 'react';
import { Apartment, PublicBookedInterval } from '@/types';
import { PublicAvailabilityCalendar } from './PublicAvailabilityCalendar';

interface AvailabilityCalendarProps {
  apartment: Apartment;
  occupiedIntervals: PublicBookedInterval[];
  checkIn: string;
  checkOut: string;
  onSelectRange: (checkIn: string, checkOut: string) => void;
}

/**
 * Single-apartment wrapper around `PublicAvailabilityCalendar`.
 * Receives only sanitized `PublicBookedInterval[]` and never receives raw Booking or AvailabilityBlock records.
 */
export function AvailabilityCalendar({
  apartment,
  occupiedIntervals,
  checkIn,
  checkOut,
  onSelectRange,
}: AvailabilityCalendarProps) {
  return (
    <PublicAvailabilityCalendar
      apartments={[apartment]}
      occupiedIntervals={occupiedIntervals}
      selectedApartmentId={apartment.id}
      checkIn={checkIn}
      checkOut={checkOut}
      onSelectRange={onSelectRange}
      showApartmentSelector={false}
      showBookingActions={false}
    />
  );
}
