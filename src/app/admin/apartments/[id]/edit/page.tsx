'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { ApartmentForm } from '@/components/admin/ApartmentForm';
import { EmptyState } from '@/components/ui/EmptyState';

export default function EditApartmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { apartments, updateApartment } = useBookingContext();

  const apartmentId = params?.id || '';
  const apartment = apartments.find((a) => a.id === apartmentId);

  if (!apartment) {
    return (
      <div className="py-12">
        <EmptyState
          title="Apartment Listing Not Found"
          description="The apartment you are attempting to edit could not be found."
          actionLabel="Return to Apartments"
          onAction={() => router.push('/admin/apartments')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Link
            href="/admin/apartments"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-brand-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Apartment Listings</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-2">
            Edit Apartment: {apartment.name}
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Update pricing, capacity, amenities, imagery, or active listing
            status.
          </p>
        </div>

        <Link
          href={`/apartments/${apartment.id}`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-800 transition-colors self-start sm:self-auto"
        >
          <span>View Public Page</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      <ApartmentForm
        initialData={apartment}
        onSubmit={(input) => updateApartment(apartment.id, input)}
        submitLabel="Save Apartment Changes"
      />
    </div>
  );
}
