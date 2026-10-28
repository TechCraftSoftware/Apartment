'use client';

import React from 'react';
import { Users, Minus, Plus } from 'lucide-react';

interface GuestSelectorProps {
  value: number;
  maxGuests?: number;
  minGuests?: number;
  onChange: (guests: number) => void;
  label?: string;
  compact?: boolean;
}

export function GuestSelector({
  value,
  maxGuests = 10,
  minGuests = 1,
  onChange,
  label = 'Guests',
  compact = false,
}: GuestSelectorProps) {
  const handleDecrement = () => {
    if (value > minGuests) onChange(value - 1);
  };

  const handleIncrement = () => {
    if (value < maxGuests) onChange(value + 1);
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
          {label}
        </label>
      )}
      <div
        className={`flex items-center justify-between rounded-xl border border-stone-300 bg-white px-3.5 ${
          compact ? 'py-2' : 'py-2.5'
        }`}
      >
        <div className="flex items-center gap-2 text-stone-800">
          <Users className="w-4 h-4 text-brand-700 shrink-0" />
          <span className="text-sm font-medium">
            {value} {value === 1 ? 'Guest' : 'Guests'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDecrement}
            disabled={value <= minGuests}
            aria-label="Decrease guests"
            className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleIncrement}
            disabled={value >= maxGuests}
            aria-label="Increase guests"
            className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
