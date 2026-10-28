'use client';

import React, { Suspense, useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  RotateCcw,
  ShieldCheck,
  Filter,
  PlusCircle,
  X,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { BookingSource, BookingStatus, PaymentStatus } from '@/types';
import { BookingTable } from '@/components/admin/BookingTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { doDateRangesOverlap } from '@/lib/availability';
import { addDays, formatNaira, getTodayStr } from '@/lib/utils';

function AdminBookingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { bookings, apartments, createExternalBooking } = useBookingContext();

  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'All'>(
    (searchParams.get('status') as BookingStatus) || 'All'
  );
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    PaymentStatus | 'All'
  >((searchParams.get('paymentStatus') as PaymentStatus) || 'All');
  const [apartmentFilter, setApartmentFilter] = useState<string>(
    searchParams.get('apartmentId') || 'all'
  );
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // External Booking Modal State
  const [isExternalModalOpen, setIsExternalModalOpen] = useState(false);
  const [extAptId, setExtAptId] = useState(apartments[0]?.id || 'apt-1');
  const [extSource, setExtSource] = useState<BookingSource>('WHATSAPP');
  const [extGuestName, setExtGuestName] = useState('');
  const [extGuestEmail, setExtGuestEmail] = useState('');
  const [extGuestPhone, setExtGuestPhone] = useState('');
  const [extCheckIn, setExtCheckIn] = useState(() => addDays(getTodayStr(), 5));
  const [extCheckOut, setExtCheckOut] = useState(() =>
    addDays(getTodayStr(), 8)
  );
  const [extGuests, setExtGuests] = useState(2);
  const [extPaymentStatus, setExtPaymentStatus] =
    useState<PaymentStatus>('Paid');
  const [extAmountReceived, setExtAmountReceived] = useState('');
  const [extNotes, setExtNotes] = useState('');
  const [extError, setExtError] = useState<string | null>(null);
  const [isSubmittingExt, setIsSubmittingExt] = useState(false);

  useEffect(() => {
    const paramStatus = searchParams.get('status') as BookingStatus | null;
    const paramApt = searchParams.get('apartmentId');
    if (paramStatus) setStatusFilter(paramStatus);
    if (paramApt) setApartmentFilter(paramApt);
  }, [searchParams]);

  const resetFilters = () => {
    setStatusFilter('All');
    setPaymentStatusFilter('All');
    setApartmentFilter('all');
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
    router.replace('/admin/bookings');
  };

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((bk) => {
        if (statusFilter !== 'All') {
          if (statusFilter === 'Pending') {
            if (bk.status !== 'Pending' && bk.status !== 'PendingApproval') return false;
          } else if (bk.status !== statusFilter) {
            return false;
          }
        }
        if (
          paymentStatusFilter !== 'All' &&
          (bk.paymentStatus || 'Unpaid') !== paymentStatusFilter
        )
          return false;
        if (apartmentFilter !== 'all' && bk.apartmentId !== apartmentFilter)
          return false;

        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase().trim();
          const ref = (bk.bookingReference || bk.reference).toLowerCase();
          const matchRef = ref.includes(q);
          const matchName = bk.guestName.toLowerCase().includes(q);
          const matchEmail = bk.guestEmail.toLowerCase().includes(q);
          const matchPhone = bk.guestPhone.toLowerCase().includes(q);
          if (!matchRef && !matchName && !matchEmail && !matchPhone) {
            return false;
          }
        }

        if (dateFrom && dateTo && dateTo > dateFrom) {
          if (!doDateRangesOverlap(dateFrom, dateTo, bk.checkIn, bk.checkOut)) {
            return false;
          }
        } else if (dateFrom) {
          if (bk.checkOut <= dateFrom) return false;
        } else if (dateTo) {
          if (bk.checkIn >= dateTo) return false;
        }

        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [
    bookings,
    statusFilter,
    paymentStatusFilter,
    apartmentFilter,
    searchQuery,
    dateFrom,
    dateTo,
  ]);

  const counts = useMemo(() => {
    return {
      All: bookings.length,
      Pending: bookings.filter(
        (b) => b.status === 'Pending' || b.status === 'PendingApproval'
      ).length,
      Confirmed: bookings.filter((b) => b.status === 'Confirmed').length,
      Cancelled: bookings.filter((b) => b.status === 'Cancelled').length,
      Rejected: bookings.filter((b) => b.status === 'Rejected').length,
    };
  }, [bookings]);

  const handleCreateExternalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExtError(null);
    setIsSubmittingExt(true);

    const apt = apartments.find((a) => a.id === extAptId);
    const nights = Math.max(
      1,
      Math.round(
        (new Date(extCheckOut).getTime() - new Date(extCheckIn).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const estimatedTotal = apt
      ? nights * apt.pricePerNight + (apt.cleaningFee || 0) + (apt.serviceFee || 0)
      : 0;

    const amountPaid =
      extPaymentStatus === 'Paid'
        ? estimatedTotal
        : extPaymentStatus === 'Partially Paid'
          ? Math.max(0, Math.round(Number(extAmountReceived) || 0))
          : 0;
    if (extPaymentStatus === 'Partially Paid' && (amountPaid <= 0 || amountPaid >= estimatedTotal)) {
      setExtError(
        `Enter the amount received (more than ₦0 and less than the ${formatNaira(estimatedTotal)} total).`
      );
      setIsSubmittingExt(false);
      return;
    }

    const res = await createExternalBooking({
      apartmentId: extAptId,
      guestName: extGuestName,
      guestEmail: extGuestEmail,
      guestPhone: extGuestPhone,
      checkIn: extCheckIn,
      checkOut: extCheckOut,
      guestCount: extGuests,
      source: extSource,
      initialStatus: 'Confirmed',
      initialPaymentStatus: extPaymentStatus,
      amountPaid,
      specialRequests: extNotes,
      adminNotes: `Recorded by Realtor Admin via ${extSource}`,
    });

    setIsSubmittingExt(false);

    if (!res.success) {
      setExtError(res.error || 'Could not record external booking.');
      return;
    }

    setIsExternalModalOpen(false);
    setExtGuestName('');
    setExtGuestEmail('');
    setExtGuestPhone('');
    setExtNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
            Reservations & Booking Management
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Review online bookings, filter by booking or payment status, and
            record external reservations from WhatsApp, Instagram, or phone.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExternalModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Record External Booking (WhatsApp / Walk-In)</span>
        </button>
      </div>

      {/* Policy Banner */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950">
        <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
        <span>
          <strong>Unified Availability & Customer Verification Policy:</strong>{' '}
          Pending & Confirmed bookings (including external WhatsApp/phone
          bookings) lock public calendar dates and issue a SHA-256 verification
          code for <code>/my-booking</code>.
        </span>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          ['All', 'Pending', 'Confirmed', 'Cancelled', 'Rejected'] as const
        ).map((st) => {
          const isActive = statusFilter === st;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                isActive
                  ? 'bg-brand-800 text-white border-brand-800 shadow-2xs'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
              }`}
            >
              <span>{st}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {counts[st]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-brand-700" />
            Filter by Customer, Apartment, Payment Status, or Stay Dates
          </span>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-brand-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Customer or Reference
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ref, name, email, phone..."
                className="w-full rounded-xl border border-stone-300 pl-9 pr-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Payment Status */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Payment Status
            </label>
            <select
              value={paymentStatusFilter}
              onChange={(e) =>
                setPaymentStatusFilter(e.target.value as PaymentStatus | 'All')
              }
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            >
              <option value="All">All Payment Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Pending">Pending Verification</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          {/* Apartment */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Apartment Unit
            </label>
            <select
              value={apartmentFilter}
              onChange={(e) => setApartmentFilter(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            >
              <option value="all">All Apartments</option>
              {apartments.map((apt) => (
                <option key={apt.id} value={apt.id}>
                  {apt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stay From */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Stay Overlapping From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
          </div>

          {/* Stay To */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Stay Overlapping Until
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          title="No Matching Bookings Found"
          description="No reservations match your selected booking status, payment status, apartment, or date range filters."
          actionLabel="Reset Booking Filters"
          onAction={resetFilters}
        />
      ) : (
        <BookingTable bookings={filteredBookings} apartments={apartments} />
      )}

      {/* External Booking Modal */}
      {isExternalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-stone-200 max-w-xl w-full p-6 sm:p-8 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                  Offline & Direct Concierge Channel
                </span>
                <h2 className="text-xl font-bold text-stone-900 mt-0.5">
                  Record External Booking
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Creates a Customer record, blocks public calendar dates, and
                  issues a customer verification code.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExternalModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {extError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
                {extError}
              </div>
            )}

            <form onSubmit={handleCreateExternalSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Apartment Unit *
                  </label>
                  <select
                    value={extAptId}
                    onChange={(e) => setExtAptId(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-xs sm:text-sm"
                  >
                    {apartments.map((apt) => (
                      <option key={apt.id} value={apt.id}>
                        {apt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Booking Channel Source *
                  </label>
                  <select
                    value={extSource}
                    onChange={(e) =>
                      setExtSource(e.target.value as BookingSource)
                    }
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-xs sm:text-sm"
                  >
                    <option value="WHATSAPP">WhatsApp Concierge</option>
                    <option value="INSTAGRAM">Instagram Direct</option>
                    <option value="PHONE">Phone Desk</option>
                    <option value="WALK_IN">Walk-In Guest</option>
                    <option value="AGENT">Partner Agent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Customer Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={extGuestName}
                    onChange={(e) => setExtGuestName(e.target.value)}
                    placeholder="e.g. Damilola Ojo"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Customer Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={extGuestEmail}
                    onChange={(e) => setExtGuestEmail(e.target.value)}
                    placeholder="damilola@example.com"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Customer Phone *
                  </label>
                  <input
                    type="text"
                    required
                    value={extGuestPhone}
                    onChange={(e) => setExtGuestPhone(e.target.value)}
                    placeholder="+234 803 000 1122"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Check-In *
                  </label>
                  <input
                    type="date"
                    required
                    value={extCheckIn}
                    onChange={(e) => setExtCheckIn(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Check-Out *
                  </label>
                  <input
                    type="date"
                    required
                    value={extCheckOut}
                    onChange={(e) => setExtCheckOut(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Guests
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={extGuests}
                    onChange={(e) => setExtGuests(Number(e.target.value) || 1)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={extPaymentStatus}
                    onChange={(e) =>
                      setExtPaymentStatus(e.target.value as PaymentStatus)
                    }
                    className="w-full rounded-xl border border-stone-300 px-2.5 py-2 text-xs"
                  >
                    <option value="Paid">Paid in Full</option>
                    <option value="Partially Paid">Part Payment Received</option>
                    <option value="Unpaid">Unpaid (Pay Later)</option>
                  </select>
                  {extPaymentStatus === 'Partially Paid' && (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={extAmountReceived}
                      onChange={(e) => setExtAmountReceived(e.target.value)}
                      placeholder="Amount received (₦)"
                      className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Notes / Special Requests
                </label>
                <input
                  type="text"
                  value={extNotes}
                  onChange={(e) => setExtNotes(e.target.value)}
                  placeholder="e.g. Direct bank transfer confirmed via WhatsApp concierge"
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsExternalModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExt}
                  className="px-5 py-2.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmittingExt
                    ? 'Recording...'
                    : 'Save & Block Calendar Dates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminBookingsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20">
          <LoadingState label="Loading bookings..." />
        </div>
      }
    >
      <AdminBookingsContent />
    </Suspense>
  );
}
