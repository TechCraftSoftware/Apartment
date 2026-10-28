'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { addDays, getTodayStr } from '@/lib/utils';

interface DateRangePickerProps {
  checkIn: string;
  checkOut: string;
  onCheckInChange: (date: string) => void;
  onCheckOutChange: (date: string) => void;
  minDate?: string;
  compact?: boolean;
}

export function DateRangePicker({
  checkIn,
  checkOut,
  onCheckInChange,
  onCheckOutChange,
  minDate,
  compact = false,
}: DateRangePickerProps) {
  const today = minDate ?? getTodayStr();
  const minCheckOut = checkIn ? addDays(checkIn, 1) : addDays(today, 1);

  const handleCheckIn = (newCheckIn: string) => {
    onCheckInChange(newCheckIn);
    if (checkOut && newCheckIn && checkOut <= newCheckIn) {
      onCheckOutChange(addDays(newCheckIn, 2));
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      <div>
        <label
          htmlFor="picker-checkin"
          className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
        >
          Check-In Date
        </label>
        <div className="relative">
          <Calendar className="w-4 h-4 text-brand-700 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="picker-checkin"
            type="date"
            min={today}
            value={checkIn}
            onChange={(e) => handleCheckIn(e.target.value)}
            className={`w-full rounded-xl border border-stone-300 bg-white pl-10 pr-3 text-sm font-medium text-stone-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20 ${
              compact ? 'py-2' : 'py-2.5'
            }`}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="picker-checkout"
          className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
        >
          Check-Out Date
        </label>
        <div className="relative">
          <Calendar className="w-4 h-4 text-brand-700 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="picker-checkout"
            type="date"
            min={minCheckOut}
            value={checkOut}
            onChange={(e) => onCheckOutChange(e.target.value)}
            className={`w-full rounded-xl border border-stone-300 bg-white pl-10 pr-3 text-sm font-medium text-stone-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20 ${
              compact ? 'py-2' : 'py-2.5'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
