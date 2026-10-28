'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  KeyRound,
  CreditCard,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from '@/components/ui/BookingStatusBadge';
import { formatNaira } from '@/lib/utils';
import type { Booking } from '@/types';
import type { PaymentRecord } from '@/server/db/schema';

interface VerificationResponse {
  ok: boolean;
  idempotentReplay: boolean;
  payment: PaymentRecord;
  booking: Booking;
  message: string;
}

function PaymentCallbackContent() {
  const searchParams = useSearchParams();
  const { refreshPlatformState, addToast } = useBookingContext();

  const reference =
    searchParams.get('reference') || searchParams.get('trxref') || '';
  const bookingId = searchParams.get('bookingId') || '';
  const outcome =
    (searchParams.get('outcome') as 'success' | 'failed' | null) || 'success';
  const channel =
    (searchParams.get('channel') as
      | 'card'
      | 'bank_transfer'
      | 'ussd'
      | null) || 'card';

  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResponse | null>(null);

  const runServerVerification = useCallback(
    async (isManualReplay = false) => {
      if (!reference) {
        setError('Missing Paystack transaction reference in callback URL.');
        setIsVerifying(false);
        return;
      }

      setIsVerifying(true);
      setError(null);

      try {
        const res = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference,
            bookingId: bookingId || undefined,
            simulatedOutcome: outcome,
            simulatedChannel: channel,
          }),
        });
        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.error || 'Server-side payment verification failed.');
          setIsVerifying(false);
          return;
        }

        setResult(data);
        await refreshPlatformState();

        if (isManualReplay) {
          addToast({
            type: 'info',
            title: data.idempotentReplay
              ? 'Idempotent Callback Verified'
              : 'Payment Verified',
            message: data.message,
          });
        }
      } catch {
        setError('Network error during server-side payment verification.');
      } finally {
        setIsVerifying(false);
      }
    },
    [reference, bookingId, outcome, channel, refreshPlatformState, addToast]
  );

  useEffect(() => {
    runServerVerification(false);
  }, [runServerVerification]);

  if (isVerifying && !result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand-800 flex items-center justify-center mx-auto animate-pulse">
          <RefreshCw className="w-7 h-7 animate-spin" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900">
          Verifying Paystack Transaction on Server...
        </h1>
        <p className="text-sm text-stone-600">
          Reference: <code className="font-mono font-bold">{reference}</code>
        </p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20">
        <div className="bg-white rounded-3xl border border-red-200 p-8 text-center space-y-5 shadow-md">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            Payment Verification Error
          </h1>
          <p className="text-sm text-stone-600">
            {error || 'Unable to verify payment.'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            {bookingId && (
              <Link
                href={`/payment/${bookingId}`}
                className="px-5 py-2.5 rounded-xl bg-brand-800 text-white text-xs font-semibold"
              >
                Return to Payment Page
              </Link>
            )}
            <Link
              href="/my-booking"
              className="px-5 py-2.5 rounded-xl border border-stone-300 text-stone-800 text-xs font-semibold"
            >
              Go to /my-booking
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isSuccess = result.payment.status === 'Success';
  const bkRef = result.booking.bookingReference || result.booking.reference;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
      <div className="bg-white rounded-3xl border border-stone-200/90 overflow-hidden shadow-lg">
        {/* Top Banner */}
        <div
          className={`p-6 sm:p-8 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isSuccess ? 'bg-brand-900' : 'bg-red-900'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                isSuccess
                  ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                  : 'bg-red-500/20 border border-red-400/40 text-red-200'
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="w-7 h-7" />
              ) : (
                <XCircle className="w-7 h-7" />
              )}
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-stone-300">
                Server-Side Paystack Callback Verification
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold mt-0.5">
                {isSuccess
                  ? 'Payment Verified Successfully'
                  : 'Payment Transaction Declined / Failed'}
              </h1>
              <p className="text-xs sm:text-sm text-stone-200 mt-1">
                {result.message}
              </p>
            </div>
          </div>

          {result.idempotentReplay && (
            <span className="px-3 py-1 rounded-full bg-amber-400 text-stone-950 text-xs font-bold shrink-0">
              Idempotent Replay Safe ✓
            </span>
          )}
        </div>

        {/* Receipt Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Updated Statuses */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Booking Reference
                </span>
                <span className="font-mono text-sm font-bold text-stone-900">
                  {bkRef}
                </span>
              </div>
              <div className="h-8 w-px bg-stone-200" />
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Booking Status
                </span>
                <BookingStatusBadge status={result.booking.status} />
              </div>
              <div className="h-8 w-px bg-stone-200" />
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Payment Status
                </span>
                <PaymentStatusBadge status={result.booking.paymentStatus} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => runServerVerification(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-800 transition-colors"
              title="Verify that repeated callbacks with the same reference do not duplicate payment records"
            >
              <RefreshCw className="w-3.5 h-3.5 text-brand-700" />
              <span>Re-run Callback (Idempotency Check)</span>
            </button>
          </div>

          {/* Transaction Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-sand-50 border border-stone-200/80 space-y-2">
              <span className="font-bold uppercase tracking-wider text-stone-500 block">
                Paystack Transaction Details
              </span>
              <div className="flex justify-between">
                <span className="text-stone-500">Reference</span>
                <span className="font-mono font-bold text-stone-900">
                  {result.payment.reference}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Gateway Mode</span>
                <span className="font-semibold text-stone-900">
                  {result.payment.mode === 'LIVE_TEST_API'
                    ? 'Paystack Live Test API'
                    : 'Simulated Test Mode'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Channel</span>
                <span className="font-semibold uppercase text-stone-900">
                  {result.payment.channel || 'card'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Gateway Response</span>
                <span className="font-medium text-stone-800">
                  {result.payment.gatewayResponse}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-sand-50 border border-stone-200/80 space-y-2">
              <span className="font-bold uppercase tracking-wider text-stone-500 block">
                Financial Summary
              </span>
              <div className="flex justify-between">
                <span className="text-stone-500">Transaction Amount</span>
                <span className="font-bold text-stone-900">
                  {formatNaira(result.payment.amount)} (
                  {result.payment.amountKobo.toLocaleString()} kobo)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Total Booking Price</span>
                <span className="font-semibold text-stone-900">
                  {formatNaira(result.booking.totalPrice)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Total Amount Paid</span>
                <span>{formatNaira(result.booking.amountPaid || 0)}</span>
              </div>
              <div className="flex justify-between text-stone-900 font-bold">
                <span>Remaining Balance</span>
                <span>{formatNaira(result.booking.balanceAmount ?? 0)}</span>
              </div>
            </div>
          </div>

          {/* Navigation Actions */}
          <div className="pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/booking-confirmation/${result.booking.id}`}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>View Booking Confirmation</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href={`/my-booking?ref=${encodeURIComponent(bkRef)}`}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs sm:text-sm font-semibold transition-colors"
              >
                <KeyRound className="w-4 h-4 text-brand-700" />
                <span>Manage on /my-booking</span>
              </Link>
            </div>

            {!isSuccess && (
              <Link
                href={`/payment/${result.booking.id}`}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold"
              >
                <CreditCard className="w-4 h-4" />
                <span>Retry Payment</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-20 text-center text-sm text-stone-500">
          Verifying payment callback...
        </div>
      }
    >
      <PaymentCallbackContent />
    </Suspense>
  );
}
