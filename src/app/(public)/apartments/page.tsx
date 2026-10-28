'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  SlidersHorizontal,
  RotateCcw,
  Search,
  CalendarCheck2,
  Building2,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { filterPublicApartments } from '@/lib/availability';
import {
  addDays,
  calculateNights,
  formatDisplayDate,
  formatNaira,
  getTodayStr,
} from '@/lib/utils';
import { ApartmentCard } from '@/components/apartments/ApartmentCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';

function ApartmentsCatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { apartments, publicOccupiedIntervals, isHydrated } =
    useBookingContext();

  const today = getTodayStr();

  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || '');
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || '');
  const [guests, setGuests] = useState<number>(
    Number(searchParams.get('guests')) || 1
  );
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [bedrooms, setBedrooms] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<
    'featured' | 'price-asc' | 'price-desc' | 'capacity'
  >('featured');

  useEffect(() => {
    const urlIn = searchParams.get('checkIn');
    const urlOut = searchParams.get('checkOut');
    const urlGuests = searchParams.get('guests');
    if (urlIn !== null) setCheckIn(urlIn);
    if (urlOut !== null) setCheckOut(urlOut);
    if (urlGuests !== null && Number(urlGuests) > 0) {
      setGuests(Number(urlGuests));
    }
  }, [searchParams]);

  const handleCheckInChange = (val: string) => {
    setCheckIn(val);
    if (val && (!checkOut || checkOut <= val)) {
      setCheckOut(addDays(val, 2));
    }
  };

  const resetAllFilters = () => {
    setCheckIn('');
    setCheckOut('');
    setGuests(1);
    setMinPrice('');
    setMaxPrice('');
    setBedrooms('all');
    setSearchQuery('');
    setSortBy('featured');
    router.replace('/apartments');
  };

  const filteredApartments = useMemo(() => {
    const list = filterPublicApartments(apartments, publicOccupiedIntervals, {
      checkIn,
      checkOut,
      guests,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      bedrooms,
      searchQuery,
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price-asc') return a.pricePerNight - b.pricePerNight;
      if (sortBy === 'price-desc') return b.pricePerNight - a.pricePerNight;
      if (sortBy === 'capacity') return b.maxGuests - a.maxGuests;
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    });
  }, [
    apartments,
    publicOccupiedIntervals,
    checkIn,
    checkOut,
    guests,
    minPrice,
    maxPrice,
    bedrooms,
    searchQuery,
    sortBy,
  ]);

  const totalActiveCount = apartments.filter((a) => a.isActive).length;
  const stayNights = calculateNights(checkIn, checkOut);

  if (!isHydrated) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-brand-700">
            Serviced Residences
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mt-1">
            Browse Available Apartments
          </h1>
          <p className="text-sm text-stone-600 mt-1.5 max-w-2xl">
            Filter by check-in and check-out dates, guest capacity, nightly budget,
            or bedroom count. Only active residences available for your entire
            selected stay are shown.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-stone-600 bg-white px-3.5 py-2 rounded-xl border border-stone-200 self-start md:self-auto">
          <Building2 className="w-4 h-4 text-brand-700" />
          <span>
            Showing <strong>{filteredApartments.length}</strong> of{' '}
            <strong>{totalActiveCount}</strong> active listings
          </span>
        </div>
      </div>

      {/* Comprehensive Filter Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between gap-4 border-b border-stone-100 pb-3.5">
          <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
            <SlidersHorizontal className="w-4 h-4 text-brand-700" />
            <span>Availability & Residence Filters</span>
          </div>

          <button
            type="button"
            onClick={resetAllFilters}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-brand-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Check-in */}
          <div>
            <label
              htmlFor="filter-checkin"
              className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
            >
              Check-In
            </label>
            <input
              id="filter-checkin"
              type="date"
              min={today}
              value={checkIn}
              onChange={(e) => handleCheckInChange(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
          </div>

          {/* Check-out */}
          <div>
            <label
              htmlFor="filter-checkout"
              className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
            >
              Check-Out
            </label>
            <input
              id="filter-checkout"
              type="date"
              min={checkIn ? addDays(checkIn, 1) : addDays(today, 1)}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
          </div>

          {/* Guests */}
          <div>
            <label
              htmlFor="filter-guests"
              className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
            >
              Guests
            </label>
            <select
              id="filter-guests"
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <option key={num} value={num}>
                  {num}+ {num === 1 ? 'Guest' : 'Guests'}
                </option>
              ))}
            </select>
          </div>

          {/* Bedrooms */}
          <div>
            <label
              htmlFor="filter-bedrooms"
              className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
            >
              Bedrooms
            </label>
            <select
              id="filter-bedrooms"
              value={bedrooms}
              onChange={(e) =>
                setBedrooms(
                  e.target.value === 'all' ? 'all' : Number(e.target.value)
                )
              }
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            >
              <option value="all">Any Bedrooms</option>
              <option value={1}>1+ Bedroom / Studio</option>
              <option value={2}>2+ Bedrooms</option>
              <option value={3}>3+ Bedrooms</option>
            </select>
          </div>

          {/* Min Price */}
          <div>
            <label
              htmlFor="filter-min-price"
              className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
            >
              Min Price (₦)
            </label>
            <input
              id="filter-min-price"
              type="number"
              step={10000}
              min={0}
              placeholder="e.g. 90000"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
          </div>

          {/* Max Price */}
          <div>
            <label
              htmlFor="filter-max-price"
              className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
            >
              Max Price (₦)
            </label>
            <input
              id="filter-max-price"
              type="number"
              step={10000}
              min={0}
              placeholder="e.g. 250000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
          </div>
        </div>

        {/* Secondary Search & Sort Row */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by apartment name, neighborhood (Ikoyi, VI, Lekki), or amenity..."
              className="w-full rounded-xl border border-stone-300 bg-stone-50/60 pl-10 pr-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:bg-white focus:border-brand-700 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-stone-500 shrink-0">
              Sort by:
            </span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as typeof sortBy)
              }
              className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-800 focus:border-brand-700 focus:outline-none"
            >
              <option value="featured">Recommended / Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="capacity">Guest Capacity</option>
            </select>
          </div>
        </div>

        {/* Active Date Filter Banner */}
        {checkIn && checkOut && stayNights > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-brand-50 border border-brand-200 text-xs text-brand-950">
            <div className="flex items-center gap-2">
              <CalendarCheck2 className="w-4 h-4 text-brand-700 shrink-0" />
              <span>
                Filtering for <strong>{stayNights}-night stay</strong>:{' '}
                <strong>{formatDisplayDate(checkIn)}</strong> to{' '}
                <strong>{formatDisplayDate(checkOut)}</strong> •{' '}
                <strong>
                  {guests} {guests === 1 ? 'Guest' : 'Guests'}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCheckIn('');
                setCheckOut('');
              }}
              className="text-brand-800 hover:underline font-semibold"
            >
              Clear Dates
            </button>
          </div>
        )}
      </div>

      {/* Results Grid or Empty State */}
      {filteredApartments.length === 0 ? (
        <EmptyState
          title="No Available Apartments Match Your Criteria"
          description={
            checkIn && checkOut
              ? `No apartments are available for the entire stay from ${formatDisplayDate(
                  checkIn
                )} to ${formatDisplayDate(
                  checkOut
                )} with your current price/guest filters. Try adjusting your dates or clearing price limits.`
              : `No active listings match your current filter combination (${
                  maxPrice ? `max ${formatNaira(Number(maxPrice))}` : 'custom filters'
                }).`
          }
          actionLabel="Reset All Filters"
          onAction={resetAllFilters}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
          {filteredApartments.map((apartment) => (
            <ApartmentCard
              key={apartment.id}
              apartment={apartment}
              checkIn={checkIn}
              checkOut={checkOut}
              guests={guests}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ApartmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-20">
          <LoadingState />
        </div>
      }
    >
      <ApartmentsCatalogContent />
    </Suspense>
  );
}
