'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  MapPin,
  Users,
  BedDouble,
  Bath,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { ApartmentGallery } from '@/components/apartments/ApartmentGallery';
import { PublicAvailabilityCalendar } from '@/components/booking/PublicAvailabilityCalendar';
import { DateRangePicker } from '@/components/booking/DateRangePicker';
import { GuestSelector } from '@/components/booking/GuestSelector';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  calculateBookingTotal,
  checkPublicApartmentAvailability,
} from '@/lib/availability';
import {
  formatDisplayDate,
  formatNaira,
  getTodayStr,
} from '@/lib/utils';

function ApartmentDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { apartments, publicOccupiedIntervals, isHydrated } =
    useBookingContext();

  const apartmentId = params?.id || '';
  const apartment = apartments.find((a) => a.id === apartmentId);

  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || '');
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || '');
  const [guests, setGuests] = useState<number>(
    Number(searchParams.get('guests')) || 2
  );

  useEffect(() => {
    if (apartment && guests > apartment.maxGuests) {
      setGuests(apartment.maxGuests);
    }
  }, [apartment, guests]);

  if (!isHydrated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20">
        <LoadingState />
      </div>
    );
  }

  if (!apartment || !apartment.isActive) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20">
        <EmptyState
          title={
            apartment && !apartment.isActive
              ? 'This Residence Listing is Currently Inactive'
              : 'Apartment Not Found'
          }
          description={
            apartment && !apartment.isActive
              ? `"${apartment.name}" has been temporarily deactivated by the administrator and is not accepting public reservations at this time.`
              : 'The apartment listing you are looking for does not exist or has been removed.'
          }
          actionLabel="Browse Active Apartments"
          onAction={() => router.push('/apartments')}
        />
      </div>
    );
  }

  const availability =
    checkIn && checkOut
      ? checkPublicApartmentAvailability(
          apartment.id,
          checkIn,
          checkOut,
          publicOccupiedIntervals,
          apartment
        )
      : null;

  const { nights, totalAmount } = calculateBookingTotal(
    apartment.pricePerNight,
    checkIn,
    checkOut
  );

  const handleProceedToBooking = () => {
    if (!checkIn || !checkOut || !availability?.isAvailable) return;
    const query = new URLSearchParams({
      checkIn,
      checkOut,
      guests: String(guests),
    });
    router.push(`/booking/${apartment.id}?${query.toString()}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-xs text-stone-500"
      >
        <Link href="/" className="hover:text-stone-900">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/apartments" className="hover:text-stone-900">
          Apartments
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="font-semibold text-stone-800 truncate">
          {apartment.name}
        </span>
      </nav>

      {/* Title & Location Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-900 text-xs font-semibold mb-2">
            <span>{apartment.neighborhood}</span>
            <span>•</span>
            <span>Serviced Residence</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900">
            {apartment.name}
          </h1>
          <p className="text-sm text-stone-600 flex items-center gap-1.5 mt-1.5">
            <MapPin className="w-4 h-4 text-brand-700 shrink-0" />
            <span>{apartment.location}</span>
          </p>
        </div>

        <div className="flex items-baseline gap-1.5 bg-white px-4 py-3 rounded-2xl border border-stone-200 shadow-2xs self-start md:self-auto">
          <span className="text-2xl font-bold text-brand-900">
            {formatNaira(apartment.pricePerNight)}
          </span>
          <span className="text-xs font-medium text-stone-500">/ night</span>
        </div>
      </div>

      {/* Image Gallery */}
      <ApartmentGallery
        images={apartment.images}
        apartmentName={apartment.name}
      />

      {/* Main Content + Sticky Booking Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
        {/* Left Column: Specs, Description, Amenities, Interactive Calendar */}
        <div className="lg:col-span-8 space-y-8">
          {/* Room & Capacity Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-stone-500">Capacity</p>
                <p className="text-sm font-bold text-stone-900">
                  Up to {apartment.maxGuests} Guests
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center shrink-0">
                <BedDouble className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-stone-500">Bedrooms</p>
                <p className="text-sm font-bold text-stone-900">
                  {apartment.bedrooms}{' '}
                  {apartment.bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center shrink-0">
                <Bath className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-stone-500">Bathrooms</p>
                <p className="text-sm font-bold text-stone-900">
                  {apartment.bathrooms} Baths
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center shrink-0">
                <Maximize2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-stone-500">Floor Area</p>
                <p className="text-sm font-bold text-stone-900">
                  {apartment.sizeSqm} m²
                </p>
              </div>
            </div>
          </div>

          {/* About this Residence */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-2xs space-y-4">
            <h2 className="text-lg font-bold text-stone-900">
              About This Residence
            </h2>
            <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
              {apartment.description}
            </p>
            <div className="pt-3 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-stone-600">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-700 shrink-0" />
                <span>
                  Check-In: <strong>{apartment.availabilityRules.checkInTime}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-700 shrink-0" />
                <span>
                  Check-Out: <strong>{apartment.availabilityRules.checkOutTime}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-700 shrink-0" />
                <span>
                  Minimum Stay:{' '}
                  <strong>
                    {apartment.availabilityRules.minNights}{' '}
                    {apartment.availabilityRules.minNights === 1
                      ? 'Night'
                      : 'Nights'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-2xs space-y-4">
            <h2 className="text-lg font-bold text-stone-900">
              Residence Amenities & Services
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {apartment.amenities.map((amenity) => (
                <div
                  key={amenity}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-sand-50 border border-stone-200/70 text-xs sm:text-sm font-medium text-stone-800"
                >
                  <CheckCircle2 className="w-4 h-4 text-brand-700 shrink-0" />
                  <span>{amenity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Monthly Public Availability Calendar */}
          <div id="availability-calendar">
            <PublicAvailabilityCalendar
              apartments={[apartment]}
              occupiedIntervals={publicOccupiedIntervals}
              selectedApartmentId={apartment.id}
              checkIn={checkIn}
              checkOut={checkOut}
              onSelectRange={(nextIn, nextOut) => {
                setCheckIn(nextIn);
                setCheckOut(nextOut);
              }}
              showApartmentSelector={false}
              showBookingActions={false}
            />
          </div>
        </div>

        {/* Right Column: Sticky Booking Summary & Estimator Panel */}
        <div className="lg:col-span-4 lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-lg space-y-5">
            <div className="flex items-baseline justify-between border-b border-stone-100 pb-4">
              <div>
                <span className="text-2xl font-bold text-stone-900">
                  {formatNaira(apartment.pricePerNight)}
                </span>
                <span className="text-xs text-stone-500"> / night</span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                Instant Hold
              </span>
            </div>

            {/* Date Pickers synced with calendar */}
            <DateRangePicker
              checkIn={checkIn}
              checkOut={checkOut}
              onCheckInChange={setCheckIn}
              onCheckOutChange={setCheckOut}
              minDate={getTodayStr()}
              compact
            />

            {/* Guest Selector */}
            <GuestSelector
              value={guests}
              maxGuests={apartment.maxGuests}
              minGuests={1}
              onChange={setGuests}
              label={`Guests (Max ${apartment.maxGuests})`}
              compact
            />

            {/* Availability Feedback */}
            {checkIn && checkOut && availability && !availability.isAvailable && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{availability.reason}</span>
              </div>
            )}

            {checkIn && checkOut && availability?.isAvailable && (
              <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Dates Available!</p>
                  <p className="text-emerald-800 mt-0.5">
                    {formatDisplayDate(checkIn)} – {formatDisplayDate(checkOut)} (
                    {nights} {nights === 1 ? 'night' : 'nights'})
                  </p>
                </div>
              </div>
            )}

            {/* Estimated Price Breakdown */}
            {nights > 0 && availability?.isAvailable ? (
              <div className="pt-3 border-t border-stone-100 space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-stone-600">
                  <span>
                    {formatNaira(apartment.pricePerNight)} × {nights}{' '}
                    {nights === 1 ? 'night' : 'nights'}
                  </span>
                  <span className="font-medium text-stone-900">
                    {formatNaira(totalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-stone-600">
                  <span>24/7 Power & Service Charge</span>
                  <span className="text-emerald-700 font-medium text-xs">
                    Included
                  </span>
                </div>
                <div className="pt-2.5 border-t border-stone-200 flex items-baseline justify-between">
                  <span className="font-bold text-stone-900">
                    Estimated Total
                  </span>
                  <span className="text-xl font-bold text-brand-900">
                    {formatNaira(totalAmount)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/70 text-xs text-stone-600 text-center">
                Select available check-in and check-out dates on the calendar or
                date picker above to calculate your stay total.
              </div>
            )}

            {/* Primary CTA */}
            <button
              type="button"
              disabled={!checkIn || !checkOut || !availability?.isAvailable}
              onClick={handleProceedToBooking}
              className="w-full py-3.5 px-5 rounded-xl bg-brand-800 hover:bg-brand-900 disabled:bg-stone-300 disabled:text-stone-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Request to Book</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-[11px] text-center text-stone-500 leading-relaxed">
              You won&apos;t be charged yet. Submitting a booking request places a{' '}
              <strong>Pending</strong> hold on your dates while our Reservations
              Desk confirms your stay.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ApartmentDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-20">
          <LoadingState />
        </div>
      }
    >
      <ApartmentDetailContent />
    </Suspense>
  );
}
