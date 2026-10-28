'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { GuestSelector } from './GuestSelector';
import { addDays, getTodayStr } from '@/lib/utils';

interface BookingSearchProps {
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
  onSearch?: (params: { checkIn: string; checkOut: string; guests: number }) => void;
  className?: string;
}

export function BookingSearch({
  initialCheckIn = '',
  initialCheckOut = '',
  initialGuests = 2,
  onSearch,
  className = '',
}: BookingSearchProps) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(initialGuests);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (checkIn && !checkOut) {
      const autoOut = addDays(checkIn, 2);
      setCheckOut(autoOut);
      triggerNavigation(checkIn, autoOut, guests);
      return;
    }

    if (!checkIn && checkOut) {
      setError('Please select a check-in date along with your check-out date.');
      return;
    }

    if (checkIn && checkOut && checkOut <= checkIn) {
      setError('Check-out date must be after check-in date.');
      return;
    }

    triggerNavigation(checkIn, checkOut, guests);
  };

  const triggerNavigation = (inDate: string, outDate: string, guestCount: number) => {
    if (onSearch) {
      onSearch({ checkIn: inDate, checkOut: outDate, guests: guestCount });
      return;
    }

    const params = new URLSearchParams();
    if (inDate) params.set('checkIn', inDate);
    if (outDate) params.set('checkOut', outDate);
    if (guestCount) params.set('guests', String(guestCount));

    router.push(`/apartments?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-6 shadow-xl ${className}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        <div className="lg:col-span-6">
          <DateRangePicker
            checkIn={checkIn}
            checkOut={checkOut}
            onCheckInChange={setCheckIn}
            onCheckOutChange={setCheckOut}
            minDate={getTodayStr()}
          />
        </div>

        <div className="lg:col-span-3">
          <GuestSelector
            value={guests}
            maxGuests={6}
            onChange={setGuests}
            label="Guests"
          />
        </div>

        <div className="lg:col-span-3">
          <button
            type="submit"
            className="w-full h-[44px] inline-flex items-center justify-center gap-2 px-6 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>Search Availability</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
      )}
    </form>
  );
}
