'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { ApartmentForm } from '@/components/admin/ApartmentForm';

export default function NewApartmentPage() {
  const { createApartment } = useBookingContext();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/admin/apartments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-brand-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Apartment Listings</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-2">
          Create New Apartment Listing
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Add a new residence to the portfolio. Once saved as active, it will
          immediately appear on the public website and availability calendar.
        </p>
      </div>

      <ApartmentForm
        onSubmit={createApartment}
        submitLabel="Create & Publish Apartment"
      />
    </div>
  );
}
