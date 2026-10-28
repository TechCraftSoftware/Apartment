'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin,
  Users,
  BedDouble,
  Bath,
  Maximize2,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Apartment } from '@/types';
import { formatNaira, getTodayStr } from '@/lib/utils';
import { useBookingContext } from '@/context/BookingContext';
import { getPublicDayStatus } from '@/lib/availability';

interface ApartmentCardProps {
  apartment: Apartment;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

export function ApartmentCard({
  apartment,
  checkIn,
  checkOut,
  guests,
}: ApartmentCardProps) {
  const { publicOccupiedIntervals } = useBookingContext();
  const today = getTodayStr();
  const todayStatus = getPublicDayStatus(
    apartment.id,
    today,
    publicOccupiedIntervals,
    false
  );

  // Build query params if dates/guests are selected
  const params = new URLSearchParams();
  if (checkIn) params.set('checkIn', checkIn);
  if (checkOut) params.set('checkOut', checkOut);
  if (guests) params.set('guests', String(guests));
  const queryString = params.toString();
  const detailHref = `/apartments/${apartment.id}${
    queryString ? `?${queryString}` : ''
  }`;

  return (
    <article className="group bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs hover:shadow-xl hover:border-stone-300 transition-all duration-300 flex flex-col">
      {/* Image Header */}
      <Link
        href={detailHref}
        className="relative h-64 w-full bg-stone-200 overflow-hidden block"
      >
        <Image
          src={
            apartment.images[0] ||
            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'
          }
          alt={apartment.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 via-transparent to-stone-950/20" />

        {/* Top Badges */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
          <span className="px-3 py-1 rounded-full bg-stone-950/75 backdrop-blur-xs text-white text-xs font-medium">
            {apartment.neighborhood}
          </span>

          {checkIn && checkOut ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600/95 text-white text-xs font-semibold shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Available for Selected Dates
            </span>
          ) : todayStatus === 'available' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50/95 text-emerald-900 border border-emerald-200 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Available Tonight
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50/95 text-amber-900 border border-amber-200 text-xs font-medium">
              <Clock className="w-3 h-3 text-amber-700" />
              Check Calendar
            </span>
          )}
        </div>

        {/* Bottom Price Overlay */}
        <div className="absolute bottom-3.5 left-3.5 right-3.5 flex items-end justify-between text-white">
          <div>
            <span className="text-xl font-bold tracking-tight">
              {formatNaira(apartment.pricePerNight)}
            </span>
            <span className="text-xs text-stone-200"> / night</span>
          </div>
        </div>
      </Link>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2.5">
          <div>
            <Link
              href={detailHref}
              className="text-lg font-bold text-stone-900 group-hover:text-brand-800 transition-colors line-clamp-1"
            >
              {apartment.name}
            </Link>
            <p className="text-xs text-stone-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-brand-700 shrink-0" />
              <span className="truncate">{apartment.location}</span>
            </p>
          </div>

          <p className="text-sm text-stone-600 line-clamp-2 leading-relaxed">
            {apartment.shortDescription}
          </p>
        </div>

        <div className="space-y-4 pt-2">
          {/* Room Specs */}
          <div className="grid grid-cols-4 gap-2 py-2.5 px-3 rounded-xl bg-sand-50 border border-stone-200/70 text-xs text-stone-700">
            <div className="flex items-center gap-1.5" title="Max Guests">
              <Users className="w-3.5 h-3.5 text-brand-700 shrink-0" />
              <span>{apartment.maxGuests} Guests</span>
            </div>
            <div className="flex items-center gap-1.5" title="Bedrooms">
              <BedDouble className="w-3.5 h-3.5 text-brand-700 shrink-0" />
              <span>
                {apartment.bedrooms} {apartment.bedrooms === 1 ? 'Bed' : 'Beds'}
              </span>
            </div>
            <div className="flex items-center gap-1.5" title="Bathrooms">
              <Bath className="w-3.5 h-3.5 text-brand-700 shrink-0" />
              <span>{apartment.bathrooms} Bath</span>
            </div>
            <div className="flex items-center gap-1.5" title="Floor Area">
              <Maximize2 className="w-3.5 h-3.5 text-brand-700 shrink-0" />
              <span>{apartment.sizeSqm} m²</span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap gap-1.5 overflow-hidden max-h-6">
              {apartment.amenities.slice(0, 2).map((amenity) => (
                <span
                  key={amenity}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 truncate max-w-[140px]"
                >
                  {amenity}
                </span>
              ))}
            </div>

            <Link
              href={detailHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-xs font-semibold transition-colors shrink-0"
            >
              <span>View Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
