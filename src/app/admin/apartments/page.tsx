'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  PlusCircle,
  Search,
  LayoutGrid,
  List,
  Edit3,
  Power,
  Trash2,
  CalendarRange,
  ExternalLink,
  Users,
  BedDouble,
  MapPin,
  Building2,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { Apartment } from '@/types';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatNaira } from '@/lib/utils';

export default function AdminApartmentsPage() {
  const {
    realtorConfig,
    apartments,
    properties,
    bookings,
    toggleApartmentActive,
    deleteApartment,
  } = useBookingContext();

  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const [apartmentToDelete, setApartmentToDelete] =
    useState<Apartment | null>(null);

  const filteredApartments = useMemo(() => {
    return apartments.filter((apt) => {
      if (statusFilter === 'active' && !apt.isActive) return false;
      if (statusFilter === 'inactive' && apt.isActive) return false;

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = apt.name.toLowerCase().includes(q);
        const matchesLoc = apt.location.toLowerCase().includes(q);
        const matchesNeigh = apt.neighborhood.toLowerCase().includes(q);
        const matchesProp = (apt.propertyName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesLoc && !matchesNeigh && !matchesProp)
          return false;
      }

      return true;
    });
  }, [apartments, statusFilter, searchQuery]);

  const getActiveBookingCount = (apartmentId: string) => {
    return bookings.filter(
      (b) =>
        b.apartmentId === apartmentId &&
        (b.status === 'Confirmed' || b.status === 'Pending')
    ).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
            Realtor Properties &amp; Apartment Units
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Manage parent properties, rentable apartment units, pricing, and
            public website visibility for{' '}
            <strong>{realtorConfig.businessName}</strong>.
          </p>
        </div>

        <Link
          href="/admin/apartments/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-sm font-semibold transition-colors shadow-xs self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create New Apartment Unit</span>
        </Link>
      </div>

      {/* Parent Properties Overview Strip */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
            <Building2 className="w-4 h-4 text-brand-700" />
            <span>
              Managed Parent Properties ({properties.length}) &amp; Rentable
              Units ({apartments.length})
            </span>
          </div>
          <span className="text-xs text-stone-500">
            Client ID: <code>{realtorConfig.clientId}</code>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {properties.map((prop) => {
            const unitCount = apartments.filter(
              (a) => a.propertyId === prop.id
            ).length;
            return (
              <div
                key={prop.id}
                className="rounded-xl border border-stone-200/80 bg-stone-50/70 p-3.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-bold text-stone-900 text-xs truncate">
                    {prop.name}
                  </div>
                  <div className="text-[11px] text-stone-500 truncate">
                    {prop.neighborhood}, {prop.city}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-800 text-[11px] font-bold shrink-0">
                  {unitCount} {unitCount === 1 ? 'Unit' : 'Units'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter & View Switcher Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by unit name, property, or neighborhood..."
              className="w-full rounded-xl border border-stone-300 pl-10 pr-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl border border-stone-200">
            {(['all', 'active', 'inactive'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  statusFilter === status
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Layout Toggle */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === 'table'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === 'cards'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Cards
          </button>
        </div>
      </div>

      {/* Listings Content */}
      {filteredApartments.length === 0 ? (
        <EmptyState
          title="No Matching Apartments Found"
          description="No apartment listings match your current search or status filter."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery('');
            setStatusFilter('all');
          }}
        />
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  <th className="py-3.5 px-4">Apartment Unit &amp; Property</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Specs</th>
                  <th className="py-3.5 px-4">Nightly Rate</th>
                  <th className="py-3.5 px-4">Listing Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/70 text-sm">
                {filteredApartments.map((apt) => {
                  const activeBookings = getActiveBookingCount(apt.id);
                  return (
                    <tr
                      key={apt.id}
                      className="hover:bg-stone-50/70 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-14 h-11 rounded-lg overflow-hidden bg-stone-200 shrink-0">
                            <Image
                              src={
                                apt.images[0] ||
                                'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80'
                              }
                              alt={apt.name}
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          </div>
                          <div>
                            <Link
                              href={`/admin/apartments/${apt.id}/edit`}
                              className="font-bold text-stone-900 hover:text-brand-800"
                            >
                              {apt.name}
                            </Link>
                            <div className="text-xs text-stone-500">
                              {apt.propertyName || apt.neighborhood}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-stone-800">
                          {apt.neighborhood}
                        </div>
                        <div className="text-xs text-stone-500">
                          <Link
                            href={`/admin/bookings?apartmentId=${apt.id}`}
                            className="text-brand-800 font-semibold hover:underline"
                          >
                            {activeBookings} active booking(s)
                          </Link>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-stone-700">
                        <div>{apt.maxGuests} Guests Max</div>
                        <div className="text-stone-500">
                          {apt.bedrooms} Bed • {apt.bathrooms} Bath
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-stone-900">
                        {formatNaira(apt.pricePerNight)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleApartmentActive(apt.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                            apt.isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          {apt.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/calendar?apartmentId=${apt.id}`}
                            title="View Availability Calendar"
                            className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 transition-colors"
                          >
                            <CalendarRange className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/apartments/${apt.id}`}
                            title="Preview Public Page"
                            className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/admin/apartments/${apt.id}/edit`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-800 hover:bg-brand-900 text-white text-xs font-semibold transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setApartmentToDelete(apt)}
                            title="Delete Listing"
                            className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-red-50 hover:border-red-200 text-stone-500 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApartments.map((apt) => (
            <div
              key={apt.id}
              className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="relative h-48 w-full bg-stone-200">
                  <Image
                    src={
                      apt.images[0] ||
                      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'
                    }
                    alt={apt.name}
                    fill
                    className="object-cover"
                    sizes="400px"
                  />
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-stone-950/75 text-white text-xs font-medium">
                      {apt.neighborhood}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleApartmentActive(apt.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs ${
                        apt.isActive
                          ? 'bg-emerald-500 text-white border-emerald-400'
                          : 'bg-stone-800 text-stone-200 border-stone-700'
                      }`}
                    >
                      {apt.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-stone-900">
                      {apt.name}
                    </h3>
                    <span className="text-sm font-bold text-brand-800 shrink-0">
                      {formatNaira(apt.pricePerNight)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                    <span className="truncate">{apt.location}</span>
                  </p>
                  <div className="flex items-center gap-4 text-xs text-stone-600 pt-1">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-stone-400" />
                      {apt.maxGuests} Guests
                    </span>
                    <span className="flex items-center gap-1">
                      <BedDouble className="w-3.5 h-3.5 text-stone-400" />
                      {apt.bedrooms} Bed • {apt.bathrooms} Bath
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleApartmentActive(apt.id)}
                  className="text-xs font-semibold text-stone-600 hover:text-stone-900"
                >
                  {apt.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/calendar?apartmentId=${apt.id}`}
                    className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-700 hover:bg-stone-100"
                  >
                    Calendar
                  </Link>
                  <Link
                    href={`/admin/apartments/${apt.id}/edit`}
                    className="px-3 py-1.5 rounded-lg bg-brand-800 text-white text-xs font-semibold hover:bg-brand-900"
                  >
                    Edit Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(apartmentToDelete)}
        title={`Delete "${apartmentToDelete?.name}"?`}
        description="This action will remove the apartment listing from the demo data. If you only want to hide it from the public website temporarily, consider deactivating it instead."
        confirmLabel="Delete Apartment"
        variant="danger"
        onConfirm={() => {
          if (apartmentToDelete) {
            deleteApartment(apartmentToDelete.id);
          }
          setApartmentToDelete(null);
        }}
        onCancel={() => setApartmentToDelete(null)}
      />
    </div>
  );
}
