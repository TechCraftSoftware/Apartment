'use client';

import React from 'react';
import Image from 'next/image';
import {
  MapPin,
  Calendar,
  Users,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Apartment } from '@/types';
import {
  calculateNights,
  formatDisplayDate,
  formatNaira,
} from '@/lib/utils';

interface BookingSummaryProps {
  apartment: Apartment;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  reference?: string;
}

export function BookingSummary({
  apartment,
  checkIn,
  checkOut,
  guestCount,
  reference,
}: BookingSummaryProps) {
  const nights = calculateNights(checkIn, checkOut);
  const totalAmount = nights * apartment.pricePerNight;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-md">
      {/* Apartment Preview Header */}
      <div className="relative h-48 w-full bg-stone-200">
        <Image
          src={apartment.images[0]}
          alt={apartment.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 400px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/75 via-stone-950/20 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-brand-800/90 text-[11px] font-semibold tracking-wide uppercase mb-1.5">
            {apartment.neighborhood}
          </span>
          <h3 className="text-lg font-bold leading-snug">{apartment.name}</h3>
          <p className="text-xs text-stone-200 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {apartment.location}
          </p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {reference && (
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-sand-100 border border-stone-200">
            <span className="text-xs font-medium text-stone-600">
              Booking Reference
            </span>
            <span className="text-xs font-mono font-bold text-brand-900">
              {reference}
            </span>
          </div>
        )}

        {/* Stay Dates & Guests */}
        <div className="space-y-3 text-sm">
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2 text-stone-600">
              <Calendar className="w-4 h-4 text-brand-700 shrink-0" />
              <span>Check-In</span>
            </div>
            <div className="text-right">
              <span className="font-semibold text-stone-900 block">
                {formatDisplayDate(checkIn, true)}
              </span>
              <span className="text-xs text-stone-500">
                From {apartment.availabilityRules.checkInTime}
              </span>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2 text-stone-600">
              <Calendar className="w-4 h-4 text-brand-700 shrink-0" />
              <span>Check-Out</span>
            </div>
            <div className="text-right">
              <span className="font-semibold text-stone-900 block">
                {formatDisplayDate(checkOut, true)}
              </span>
              <span className="text-xs text-stone-500">
                By {apartment.availabilityRules.checkOutTime}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2 text-stone-600">
              <Users className="w-4 h-4 text-brand-700 shrink-0" />
              <span>Guests</span>
            </div>
            <span className="font-semibold text-stone-900">
              {guestCount} {guestCount === 1 ? 'Guest' : 'Guests'} (Max{' '}
              {apartment.maxGuests})
            </span>
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="space-y-2.5 pt-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Price Breakdown
          </h4>
          <div className="flex items-center justify-between text-sm text-stone-700">
            <span>
              {formatNaira(apartment.pricePerNight)} × {nights}{' '}
              {nights === 1 ? 'night' : 'nights'}
            </span>
            <span className="font-medium text-stone-900">
              {formatNaira(totalAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-stone-600">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-brand-700" />
              Service, power & cleaning
            </span>
            <span className="text-emerald-700 font-medium text-xs">
              Included
            </span>
          </div>

          <div className="pt-3 border-t border-stone-200 flex items-baseline justify-between">
            <div>
              <span className="text-sm font-bold text-stone-900 block">
                Total Estimated Amount
              </span>
              <span className="text-[11px] text-stone-500">
                Payable upon reservation confirmation
              </span>
            </div>
            <span className="text-xl font-bold text-brand-900">
              {formatNaira(totalAmount)}
            </span>
          </div>
        </div>

        {/* Policy Note */}
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            No Online Payment Charged Today
          </p>
          <p className="text-amber-800/90 leading-relaxed">
            Submitting this form places a temporary hold (<strong>Pending</strong>{' '}
            status) on your selected dates while our Reservations Desk verifies and
            confirms your stay.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-stone-500 pt-1">
          <ShieldCheck className="w-4 h-4 text-brand-700 shrink-0" />
          <span>Instant availability re-verification before submission</span>
        </div>
      </div>
    </div>
  );
}
