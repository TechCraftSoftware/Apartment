'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { formatNaira } from '@/lib/utils';

export default function AdminPaymentsPage() {
  const { payments, bookings } = useBookingContext();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const metrics = useMemo(() => {
    const successful = payments.filter((p) => p.status === 'Success');
    const pending = payments.filter(
      (p) =>
        p.status === 'Initiated' ||
        p.status === 'Pending' ||
        p.status === 'AwaitingVerification'
    );
    const failed = payments.filter((p) => p.status === 'Failed');
    const totalRevenue = successful.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalRevenue,
      successfulCount: successful.length,
      pendingCount: pending.length,
      failedCount: failed.length,
    };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.reference.toLowerCase().includes(q) ||
          p.bookingReference.toLowerCase().includes(q) ||
          (p.channel || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [payments, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Paystack Test Mode Ledger (NGN / Kobo)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
            Payment Transactions
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Audit server-verified Paystack test transactions, deposits, and full
            reservation payments.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Verified Revenue
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900 mt-2">
            {formatNaira(metrics.totalRevenue)}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            From {metrics.successfulCount} verified transactions
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Successful
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">
            {metrics.successfulCount}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            Idempotently verified on server
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Initiated / Pending
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">
            {metrics.pendingCount}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            Awaiting checkout callback
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Failed / Declined
            </span>
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-700 mt-2">
            {metrics.failedCount}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            Guest can retry payment anytime
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'SUCCESS', 'INITIATED', 'FAILED', 'REFUNDED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Paystack or Booking ref..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200/80 bg-stone-50/70 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                <th className="py-3.5 px-4">Paystack Reference</th>
                <th className="py-3.5 px-4">Booking Ref</th>
                <th className="py-3.5 px-4">Guest</th>
                <th className="py-3.5 px-4">Amount (NGN / Kobo)</th>
                <th className="py-3.5 px-4">Payment Type</th>
                <th className="py-3.5 px-4">Channel & Mode</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/60 text-sm">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-stone-500 text-xs"
                  >
                    No payment transactions match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((pay) => {
                  const booking = bookings.find((b) => b.id === pay.bookingId);
                  return (
                    <tr
                      key={pay.id}
                      className="hover:bg-stone-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-stone-900">
                        {pay.reference}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-brand-800 font-semibold">
                        <Link
                          href={`/admin/bookings/${pay.bookingId}`}
                          className="hover:underline"
                        >
                          {pay.bookingReference}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-stone-700">
                        {booking ? (
                          <div>
                            <div className="font-semibold text-stone-900">
                              {booking.guestName}
                            </div>
                            <div className="text-stone-500">
                              {booking.guestEmail}
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-stone-900">
                          {formatNaira(pay.amount)}
                        </div>
                        <div className="text-[11px] text-stone-400 font-mono">
                          {pay.amountKobo.toLocaleString()} kobo
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-stone-700">
                        {pay.paymentType === 'Deposit'
                          ? 'Deposit Payment'
                          : 'Full Payment'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-stone-600">
                        <div className="font-medium capitalize">
                          {pay.channel || 'card'}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {pay.mode}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                            pay.status === 'Success'
                              ? 'bg-emerald-100 text-emerald-800'
                              : pay.status === 'Failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pay.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/admin/bookings/${pay.bookingId}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-xs font-semibold text-stone-700"
                        >
                          <span>Booking</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
