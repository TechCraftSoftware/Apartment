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
import { describePayment } from '@/lib/payments';
import type { PaymentRecord } from '@/server/db/schema';

type LedgerFilter = 'ALL' | 'RECEIVED' | 'REVIEW' | 'INCOMPLETE' | 'FAILED';

const FILTER_LABELS: Record<LedgerFilter, string> = {
  ALL: 'All',
  RECEIVED: 'Received',
  REVIEW: 'Awaiting review',
  INCOMPLETE: 'Not completed',
  FAILED: 'Failed / rejected',
};

function ledgerBucket(p: PaymentRecord): Exclude<LedgerFilter, 'ALL'> {
  if (p.receiptVerificationStatus === 'PendingReview') return 'REVIEW';
  if (p.status === 'Success') return 'RECEIVED';
  if (p.status === 'Failed' || p.status === 'Rejected') return 'FAILED';
  return 'INCOMPLETE';
}

export default function AdminPaymentsPage() {
  const { payments, bookings } = useBookingContext();
  const [statusFilter, setStatusFilter] = useState<LedgerFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const metrics = useMemo(() => {
    const successful = payments.filter((p) => ledgerBucket(p) === 'RECEIVED');
    const awaitingReview = payments.filter((p) => ledgerBucket(p) === 'REVIEW');
    const totalRevenue = successful.reduce((sum, p) => sum + p.amount, 0);
    // Money still owed on live bookings that have at least one payment.
    const outstanding = bookings
      .filter(
        (b) =>
          (b.amountPaid || 0) > 0 &&
          !['Cancelled', 'Rejected', 'Expired'].includes(b.status)
      )
      .reduce(
        (sum, b) =>
          sum + (b.balanceAmount ?? Math.max(0, b.totalPrice - (b.amountPaid || 0))),
        0
      );

    return {
      totalRevenue,
      successfulCount: successful.length,
      reviewCount: awaitingReview.length,
      reviewAmount: awaitingReview.reduce((sum, p) => sum + p.amount, 0),
      outstanding,
    };
  }, [payments, bookings]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== 'ALL' && ledgerBucket(p) !== statusFilter) return false;
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
            <span>Payments Ledger (NGN)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
            Payment Transactions
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Card payments, bank transfers and payments recorded by admin, including
            part payments.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Money Received
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
              Payments Received
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">
            {metrics.successfulCount}
          </p>
          <p className="text-xs text-stone-500 mt-1">Card, transfer and recorded payments</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Awaiting Review
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">
            {metrics.reviewCount}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            Transfer receipts worth {formatNaira(metrics.reviewAmount)}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Outstanding Balances
            </span>
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-700 mt-2">
            {formatNaira(metrics.outstanding)}
          </p>
          <p className="text-xs text-stone-500 mt-1">Still owed on part-paid bookings</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(FILTER_LABELS) as LedgerFilter[]).map((st) => (
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
              {FILTER_LABELS[st]}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search payment or booking ref..."
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
                <th className="py-3.5 px-4">Reference</th>
                <th className="py-3.5 px-4">Booking Ref</th>
                <th className="py-3.5 px-4">Guest</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Payment Type</th>
                <th className="py-3.5 px-4">Method</th>
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
                        <div className="text-[11px] text-stone-400">
                          {new Date(pay.paidAt || pay.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-stone-700">
                        {describePayment(pay).typeLabel}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-stone-600">
                        <div className="font-medium">
                          {describePayment(pay).methodLabel}
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
                          {FILTER_LABELS[ledgerBucket(pay)]}
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
