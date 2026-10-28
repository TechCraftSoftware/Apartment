'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  Clock,
  CalendarCheck,
  KeyRound,
  LogIn,
  LogOut,
  PlusCircle,
  CalendarRange,
  ClipboardList,
  ArrowRight,
  Calendar,
  CreditCard,
  Settings,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { StatCard } from '@/components/ui/StatCard';
import { BookingTable } from '@/components/admin/BookingTable';
import { getDayAvailabilityStatus } from '@/lib/availability';
import {
  addDays,
  formatDisplayDate,
  formatNaira,
  getTodayStr,
} from '@/lib/utils';

export default function AdminDashboardPage() {
  const {
    realtorConfig,
    apartments,
    bookings,
    blocks,
    payments,
    properties,
  } = useBookingContext();
  const today = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(today);

  // Derived metrics from the single shared data source
  const totalApartments = apartments.length;
  const activeListings = apartments.filter((a) => a.isActive).length;
  const pendingRequests = bookings.filter((b) => b.status === 'Pending');
  const confirmedUpcoming = bookings.filter(
    (b) => b.status === 'Confirmed' && b.checkOut > selectedDate
  );
  const verifiedRevenue = useMemo(
    () =>
      payments
        .filter((p) => p.status === 'Success')
        .reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );

  // Apartments currently occupied on `selectedDate` (Confirmed booking where checkIn <= selectedDate < checkOut)
  const occupiedOnSelectedDate = useMemo(() => {
    return apartments.filter((apt) => {
      return bookings.some(
        (b) =>
          b.apartmentId === apt.id &&
          b.status === 'Confirmed' &&
          selectedDate >= b.checkIn &&
          selectedDate < b.checkOut
      );
    });
  }, [apartments, bookings, selectedDate]);

  // Upcoming check-ins starting from selectedDate within the next 14 days
  const upcomingCheckIns = useMemo(() => {
    const windowEnd = addDays(selectedDate, 14);
    return bookings
      .filter(
        (b) =>
          (b.status === 'Confirmed' || b.status === 'Pending') &&
          b.checkIn >= selectedDate &&
          b.checkIn <= windowEnd
      )
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  }, [bookings, selectedDate]);

  // Upcoming check-outs starting from selectedDate within the next 14 days
  const upcomingCheckOuts = useMemo(() => {
    const windowEnd = addDays(selectedDate, 14);
    return bookings
      .filter(
        (b) =>
          b.status === 'Confirmed' &&
          b.checkOut >= selectedDate &&
          b.checkOut <= windowEnd
      )
      .sort((a, b) => a.checkOut.localeCompare(b.checkOut));
  }, [bookings, selectedDate]);

  // Recent bookings sorted by createdAt descending
  const recentBookings = useMemo(() => {
    return [...bookings]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6);
  }, [bookings]);

  const getApartmentName = (id: string) =>
    apartments.find((a) => a.id === id)?.name || 'Residence';

  return (
    <div className="space-y-8">
      {/* Page Heading & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
            Realtor Operations & Availability Overview
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Real-time occupancy, Paystack test payments, and reservation
            management for <strong>{realtorConfig.businessName}</strong>.
          </p>
        </div>

        {/* Date Selector & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-2xs">
            <Calendar className="w-4 h-4 text-brand-700 shrink-0" />
            <label
              htmlFor="dashboard-occupancy-date"
              className="text-xs font-semibold text-stone-600"
            >
              Inspect Date:
            </label>
            <input
              id="dashboard-occupancy-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value || today)}
              className="text-xs font-bold text-stone-900 focus:outline-none"
            />
          </div>

          <Link
            href="/admin/apartments/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-xs font-semibold transition-colors shadow-2xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Apartment</span>
          </Link>

          <Link
            href="/admin/calendar"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold transition-colors"
          >
            <CalendarRange className="w-4 h-4 text-brand-700" />
            <span>Manage Calendar</span>
          </Link>

          <Link
            href="/admin/bookings"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold transition-colors"
          >
            <ClipboardList className="w-4 h-4 text-brand-700" />
            <span>View All Bookings</span>
          </Link>
        </div>
      </div>

      {/* Single-Client Realtor & Paystack Test Mode Status Banner */}
      <div className="rounded-2xl border border-emerald-300 bg-white p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-2xs">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900">
              Client: {realtorConfig.businessName} ({realtorConfig.domain})
            </span>
            <span className="text-xs text-stone-600 font-medium">
              Policy: <strong>{realtorConfig.paymentPolicy}</strong> (
              {realtorConfig.depositPercentage}% Deposit) • {properties.length}{' '}
              Properties • {activeListings} Active Units • Verified Revenue:{' '}
              <strong>{formatNaira(verifiedRevenue)}</strong>
            </span>
          </div>
          <p className="text-xs text-stone-600">
            Customers book without login and view their booking with the
            reusable access code emailed to them, on <code>/my-booking</code>. Payments run
            in Paystack Test Mode (NGN / kobo).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/admin/payments"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-800 hover:border-brand-700"
          >
            <CreditCard className="w-3.5 h-3.5 text-brand-700" />
            <span>Paystack Ledger</span>
          </Link>
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Realtor Policy Settings →</span>
          </Link>
        </div>
      </div>

      {/* 6 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total Apartments"
          value={totalApartments}
          sublabel={`${activeListings} active • ${
            totalApartments - activeListings
          } inactive`}
          icon={Building2}
          tone="stone"
        />
        <StatCard
          label="Active Listings"
          value={activeListings}
          sublabel="Visible & bookable on public site"
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Pending Booking Requests"
          value={pendingRequests.length}
          sublabel="Awaiting payment or admin approval"
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Confirmed Upcoming Bookings"
          value={confirmedUpcoming.length}
          sublabel="Active & future confirmed stays"
          icon={CalendarCheck}
          tone="brand"
        />
        <StatCard
          label="Apartments Occupied"
          value={`${occupiedOnSelectedDate.length} / ${activeListings}`}
          sublabel={`On ${formatDisplayDate(selectedDate)}`}
          icon={KeyRound}
          tone="blue"
        />
        <StatCard
          label="Upcoming Check-Ins"
          value={upcomingCheckIns.length}
          sublabel="Scheduled in next 14 days"
          icon={LogIn}
          tone="brand"
        />
      </div>

      {/* Middle Row: Apartment Availability Summary + Upcoming Check-Ins & Check-Outs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Apartment Availability Summary for Selected Date */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3.5">
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Apartment Availability Summary
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Live status across all residences for{' '}
                <strong>{formatDisplayDate(selectedDate, true)}</strong>
              </p>
            </div>
            <Link
              href="/admin/calendar"
              className="text-xs font-semibold text-brand-800 hover:underline inline-flex items-center gap-1"
            >
              <span>Full Calendar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-stone-100">
            {apartments.map((apt) => {
              const dayInfo = getDayAvailabilityStatus(
                apt.id,
                selectedDate,
                bookings,
                blocks
              );

              return (
                <div
                  key={apt.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/apartments/${apt.id}/edit`}
                        className="text-sm font-semibold text-stone-900 hover:text-brand-800 truncate"
                      >
                        {apt.name}
                      </Link>
                      {!apt.isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-semibold uppercase">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500">
                      {apt.neighborhood} • {formatNaira(apt.pricePerNight)}/night
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {dayInfo.status === 'confirmed' && dayInfo.booking && (
                      <Link
                        href={`/admin/bookings/${dayInfo.booking.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        Occupied: {dayInfo.booking.guestName}
                      </Link>
                    )}

                    {dayInfo.status === 'pending' && dayInfo.booking && (
                      <Link
                        href={`/admin/bookings/${dayInfo.booking.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                        Pending Hold: {dayInfo.booking.guestName}
                      </Link>
                    )}

                    {dayInfo.status === 'blocked' && dayInfo.block && (
                      <Link
                        href={`/admin/calendar?apartmentId=${apt.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-stone-300 text-stone-700 text-xs font-medium hover:bg-stone-200 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                        Blocked ({dayInfo.block.reason.slice(0, 22)}...)
                      </Link>
                    )}

                    {dayInfo.status === 'available' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-50 border border-stone-200 text-stone-700 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Available
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Check-Ins and Check-Outs */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-5">
          <div className="border-b border-stone-100 pb-3.5">
            <h2 className="text-base font-bold text-stone-900">
              Upcoming Check-Ins & Check-Outs
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Arrivals and departures scheduled over the next 14 days
            </p>
          </div>

          <div className="space-y-4">
            {/* Arrivals */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-2.5">
                <LogIn className="w-3.5 h-3.5" />
                <span>Upcoming Check-Ins ({upcomingCheckIns.length})</span>
              </h3>
              {upcomingCheckIns.length === 0 ? (
                <p className="text-xs text-stone-500 py-2">
                  No check-ins scheduled in this window.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingCheckIns.slice(0, 4).map((bk) => (
                    <Link
                      key={bk.id}
                      href={`/admin/bookings/${bk.id}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200/70 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-stone-900 truncate">
                          {bk.guestName}{' '}
                          <span className="font-normal text-stone-500">
                            ({bk.reference})
                          </span>
                        </p>
                        <p className="text-[11px] text-stone-600 truncate">
                          {getApartmentName(bk.apartmentId)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-semibold text-brand-800 block">
                          {formatDisplayDate(bk.checkIn)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            bk.status === 'Confirmed'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {bk.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Departures */}
            <div className="pt-3 border-t border-stone-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5 mb-2.5">
                <LogOut className="w-3.5 h-3.5" />
                <span>Upcoming Check-Outs ({upcomingCheckOuts.length})</span>
              </h3>
              {upcomingCheckOuts.length === 0 ? (
                <p className="text-xs text-stone-500 py-2">
                  No confirmed check-outs in this window.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingCheckOuts.slice(0, 3).map((bk) => (
                    <Link
                      key={bk.id}
                      href={`/admin/bookings/${bk.id}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200/70 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-stone-900 truncate">
                          {bk.guestName}
                        </p>
                        <p className="text-[11px] text-stone-600 truncate">
                          {getApartmentName(bk.apartmentId)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-semibold text-stone-800 block">
                          {formatDisplayDate(bk.checkOut)}
                        </span>
                        <span className="text-[10px] text-stone-500">
                          By {realtorConfig.defaultCheckOutTime}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bookings Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              Recent Booking Requests & Reservations
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Approve pending requests or inspect reservation details directly.
            </p>
          </div>
          <Link
            href="/admin/bookings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-800 hover:underline"
          >
            <span>Manage All {bookings.length} Bookings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <BookingTable bookings={recentBookings} apartments={apartments} />
      </div>
    </div>
  );
}
