'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CalendarSearch,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { PublicAvailabilityCalendar } from '@/components/booking/PublicAvailabilityCalendar';
import { ApartmentCard } from '@/components/apartments/ApartmentCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { filterPublicApartments } from '@/lib/availability';
import { calculateNights, formatDisplayDate } from '@/lib/utils';

function PublicAvailabilityPageContent() {
  const searchParams = useSearchParams();
  // Note: Only `apartments` and sanitized `publicOccupiedIntervals` are read here.
  // Raw `bookings` and `blocks` are never accessed on the public calendar page.
  const { apartments, publicOccupiedIntervals, isHydrated } =
    useBookingContext();

  const activeApartments = useMemo(
    () => apartments.filter((a) => a.isActive),
    [apartments]
  );

  const [selectedApartmentId, setSelectedApartmentId] = useState<string>(
    searchParams.get('apartmentId') || activeApartments[0]?.id || 'all'
  );
  const [checkIn, setCheckIn] = useState<string>(
    searchParams.get('checkIn') || ''
  );
  const [checkOut, setCheckOut] = useState<string>(
    searchParams.get('checkOut') || ''
  );
  const [guests, setGuests] = useState<number>(
    Number(searchParams.get('guests')) || 2
  );

  useEffect(() => {
    const urlApt = searchParams.get('apartmentId');
    if (urlApt) {
      setSelectedApartmentId(urlApt);
    } else if (
      selectedApartmentId !== 'all' &&
      activeApartments.length > 0 &&
      !activeApartments.some((a) => a.id === selectedApartmentId)
    ) {
      setSelectedApartmentId(activeApartments[0].id);
    }
  }, [searchParams, activeApartments, selectedApartmentId]);

  const availableForSelectedDates = useMemo(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return [];
    return filterPublicApartments(activeApartments, publicOccupiedIntervals, {
      checkIn,
      checkOut,
      guests,
    });
  }, [activeApartments, publicOccupiedIntervals, checkIn, checkOut, guests]);

  if (!isHydrated) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <LoadingState label="Loading public availability calendar..." />
      </div>
    );
  }

  if (activeApartments.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20">
        <EmptyState
          title="No Active Apartments Available"
          description="There are currently no active apartment listings available for public booking."
        />
      </div>
    );
  }

  const stayNights = calculateNights(checkIn, checkOut);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-xs text-stone-500"
      >
        <Link href="/" className="hover:text-stone-900">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="font-semibold text-stone-800">
          Availability Calendar
        </span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-900 text-xs font-semibold">
            <CalendarSearch className="w-3.5 h-3.5 text-brand-700" />
            <span>Live Public Availability</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900">
            Apartment Availability Calendar
          </h1>
          <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
            Inspect open dates across our serviced residences without creating
            an account. Select an apartment below, choose your check-in and
            check-out dates, and proceed directly to your reservation request.
          </p>
        </div>

        {/* Privacy & Policy Callout */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs max-w-md space-y-1.5 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-900">
            <ShieldCheck className="w-4 h-4 text-brand-700 shrink-0" />
            <span>Guest Privacy & Real-Time Sync</span>
          </div>
          <p className="text-[11px] text-stone-600 leading-relaxed">
            To protect guest privacy, reserved dates display only as{' '}
            <strong>Booked</strong> and maintenance dates as{' '}
            <strong>Unavailable</strong>. Check-in is inclusive and check-out is
            exclusive.
          </p>
        </div>
      </div>

      {/* Interactive Public Availability Calendar */}
      <PublicAvailabilityCalendar
        apartments={activeApartments}
        occupiedIntervals={publicOccupiedIntervals}
        selectedApartmentId={selectedApartmentId}
        onSelectApartment={(aptId) => {
          setSelectedApartmentId(aptId);
          setCheckIn('');
          setCheckOut('');
        }}
        checkIn={checkIn}
        checkOut={checkOut}
        onSelectRange={(nextIn, nextOut) => {
          setCheckIn(nextIn);
          setCheckOut(nextOut);
        }}
        guests={guests}
        onGuestsChange={setGuests}
        showApartmentSelector={true}
        showBookingActions={true}
      />

      {/* Other Apartments Available for the Selected Date Range */}
      {checkIn && checkOut && stayNights > 0 && (
        <section className="space-y-5 pt-4 border-t border-stone-200">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-brand-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Matching Residences for Your Dates
              </span>
              <h2 className="font-serif text-2xl font-bold text-stone-900 mt-1">
                Apartments Available {formatDisplayDate(checkIn)} –{' '}
                {formatDisplayDate(checkOut)} ({stayNights}{' '}
                {stayNights === 1 ? 'Night' : 'Nights'})
              </h2>
            </div>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full self-start sm:self-auto">
              {availableForSelectedDates.length} Available{' '}
              {availableForSelectedDates.length === 1
                ? 'Residence'
                : 'Residences'}
            </span>
          </div>

          {availableForSelectedDates.length === 0 ? (
            <EmptyState
              title="No Apartments Available for This Exact Range & Guest Count"
              description="Try selecting different dates on the calendar above or reducing the guest count."
              actionLabel="Clear Selected Dates"
              onAction={() => {
                setCheckIn('');
                setCheckOut('');
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableForSelectedDates.map((apt) => (
                <ApartmentCard
                  key={apt.id}
                  apartment={apt}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  guests={guests}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Helpful Booking Policy Footer Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Same-Day Turnover Supported</span>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            Check-in (from 2:00 PM) is inclusive and check-out (by 11:00 AM) is
            exclusive. You can check in on the same day another guest checks
            out.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-800">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Instant Date Hold on Request</span>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            Submitting a booking request immediately places a hold on your
            selected dates so no overlapping reservation can be submitted.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-800">
            <ShieldCheck className="w-4 h-4 text-brand-700" />
            <span>Strict Guest Privacy</span>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            Personal guest information, booking references, and internal
            maintenance notes are never exposed on the public availability
            calendar.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function PublicAvailabilityPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-20">
          <LoadingState label="Loading availability calendar..." />
        </div>
      }
    >
      <PublicAvailabilityPageContent />
    </Suspense>
  );
}
