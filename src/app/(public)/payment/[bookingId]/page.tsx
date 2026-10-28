'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  CreditCard,
  ShieldCheck,
  Lock,
  Building2,
  Calendar,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Landmark,
  Smartphone,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import {
  getStoredBookingAccessToken,
  useGuestBooking,
} from '@/lib/bookingAccessClient';
import { getPaymentLimits } from '@/lib/payments';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from '@/components/ui/BookingStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  calculateNights,
  formatDisplayDate,
  formatNaira,
} from '@/lib/utils';

interface InitializedPaymentState {
  reference: string;
  accessCode: string;
  authorizationUrl: string;
  mode: 'LIVE_TEST_API' | 'SIMULATED_TEST_MODE';
  amount: number;
  amountKobo: number;
  paymentType: string;
}

export default function PaymentInitiationPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    bookings,
    apartments,
    realtorConfig,
    refreshPlatformState,
    isHydrated,
  } = useBookingContext();

  const bookingId = params?.bookingId || '';
  // Guests load only the booking their access session unlocks; signed-in
  // admins can fall back to the records they already hold.
  const { booking: guestBooking, isLoading: isGuestBookingLoading } =
    useGuestBooking(bookingId);
  const booking =
    guestBooking ||
    bookings.find(
      (b) =>
        b.id === bookingId ||
        b.reference === bookingId ||
        b.bookingReference === bookingId
    );

  // Pay the whole outstanding balance, or a part payment of a chosen amount.
  const [payOption, setPayOption] = useState<'full' | 'part'>('full');
  const [partAmount, setPartAmount] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<
    'card' | 'bank_transfer' | 'ussd'
  >('card');
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initializedPayment, setInitializedPayment] =
    useState<InitializedPaymentState | null>(null);

  if (!isHydrated || isGuestBookingLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20">
        <LoadingState />
      </div>
    );
  }

  // Simulated Paystack checkout for a new booking: the booking record is only
  // created after the payment is verified, so we only have a checkout id here.
  const simulatedCheckoutReference =
    searchParams.get('checkout') === 'simulated' ? searchParams.get('reference') : null;

  if (!booking && simulatedCheckoutReference) {
    const goToCallback = (outcome: 'success' | 'failed') =>
      router.push(
        `/payment/callback?reference=${encodeURIComponent(
          simulatedCheckoutReference
        )}&checkoutId=${encodeURIComponent(bookingId)}&outcome=${outcome}&channel=card`
      );

    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl border border-stone-200/90 shadow-md p-6 sm:p-8 space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
            <CreditCard className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <span className="inline-block px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold uppercase tracking-wider">
              Simulated Paystack Checkout (Test Mode)
            </span>
            <h1 className="font-serif text-2xl font-bold text-stone-900">
              Complete Your Payment
            </h1>
            <p className="text-xs text-stone-600">
              Reference{' '}
              <code className="font-mono font-semibold">{simulatedCheckoutReference}</code>
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => goToCallback('success')}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simulate Successful Payment</span>
            </button>
            <button
              type="button"
              onClick={() => goToCallback('failed')}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              <span>Simulate Declined Payment</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20">
        <EmptyState
          title="Booking Not Found for Payment"
          description="We could not load this booking in this browser session. Verify your booking on My Booking first, then return to pay."
          actionLabel="Go to My Booking"
          onAction={() => router.push('/my-booking')}
        />
      </div>
    );
  }

  const apartment = apartments.find((a) => a.id === booking.apartmentId);
  const nights = calculateNights(booking.checkIn, booking.checkOut);
  const ref = booking.bookingReference || booking.reference;
  const totalAmount = booking.totalPrice || booking.totalAmount;
  const amountPaid = booking.amountPaid ?? 0;
  const remainingBalance = Math.max(0, totalAmount - amountPaid);
  const paymentLimits = getPaymentLimits({
    totalPrice: totalAmount,
    amountAlreadyPaid: amountPaid,
    depositPercentage: realtorConfig.depositPercentage,
  });
  const partAmountNumber = Math.round(Number(partAmount) || 0);
  const isPartAmountValid =
    partAmountNumber >= paymentLimits.minAmount &&
    partAmountNumber <= paymentLimits.maxAmount;

  const activeChargeAmount = payOption === 'part' ? partAmountNumber : remainingBalance;
  const activeChargeKobo = Math.round(activeChargeAmount * 100);

  const handleInitializePaystack = async () => {
    setInitError(null);
    if (payOption === 'part' && !isPartAmountValid) {
      setInitError(
        `Enter an amount between ${formatNaira(paymentLimits.minAmount)} and ${formatNaira(paymentLimits.maxAmount)}.`
      );
      return;
    }
    setIsInitializing(true);

    try {
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-booking-access-token': getStoredBookingAccessToken() || '',
        },
        body: JSON.stringify({
          bookingId: booking.id,
          paymentAmount: payOption === 'part' ? partAmountNumber : undefined,
          callbackBaseUrl:
            typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setInitError(
          data.error || 'Could not initialize Paystack transaction.'
        );
        setIsInitializing(false);
        return;
      }

      await refreshPlatformState();

      setInitializedPayment({
        reference: data.reference,
        accessCode: data.accessCode,
        authorizationUrl: data.authorizationUrl,
        mode: data.mode,
        amount: data.payment.amount,
        amountKobo: data.payment.amountKobo,
        paymentType: data.payment.paymentType,
      });
    } catch {
      setInitError('Network error while initializing Paystack checkout.');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleCompleteTestCheckout = (outcome: 'success' | 'failed') => {
    if (!initializedPayment) return;
    router.push(
      `/payment/callback?reference=${encodeURIComponent(
        initializedPayment.reference
      )}&bookingId=${encodeURIComponent(
        booking.id
      )}&outcome=${outcome}&channel=${selectedChannel}`
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
      {/* Header Banner */}
      <div className="bg-brand-950 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Paystack Test Mode Integration (NGN / Kobo)</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold">
            Complete Payment for Booking {ref}
          </h1>
          <p className="text-xs sm:text-sm text-stone-300">
            Transactions are initialized on the server and verified via
            idempotent callback before updating booking payment status.
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
          <BookingStatusBadge status={booking.status} />
          <PaymentStatusBadge status={booking.paymentStatus || 'Unpaid'} />
        </div>
      </div>

      {initError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-sm text-red-900">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="font-semibold">{initError}</span>
        </div>
      )}

      {booking.paymentStatus === 'Paid' ? (
        <div className="bg-white rounded-3xl border border-emerald-200 p-8 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-stone-900">
            This Booking Is Already Paid in Full
          </h2>
          <p className="text-sm text-stone-600 max-w-md mx-auto">
            We have verified full payment of {formatNaira(totalAmount)} for
            booking <strong>{ref}</strong>.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href={`/booking-confirmation/${booking.id}`}
              className="px-5 py-2.5 rounded-xl bg-brand-800 text-white text-xs font-semibold"
            >
              View Booking Confirmation
            </Link>
            <Link
              href="/my-booking"
              className="px-5 py-2.5 rounded-xl border border-stone-300 text-stone-800 text-xs font-semibold"
            >
              Go to /my-booking
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left 3 Columns: Payment Option & Paystack Initialization / Checkout */}
          <div className="lg:col-span-3 space-y-6">
            {!initializedPayment ? (
              <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 shadow-xs space-y-6">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Step 1 of 2 • Server-Side Transaction Initialization
                  </span>
                  <h2 className="text-xl font-bold text-stone-900">
                    Select Payment Option
                  </h2>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="block text-stone-500">Total</span>
                    <span className="block font-bold text-stone-900">{formatNaira(totalAmount)}</span>
                  </div>
                  <div>
                    <span className="block text-stone-500">Paid so far</span>
                    <span className="block font-bold text-emerald-800">{formatNaira(amountPaid)}</span>
                  </div>
                  <div>
                    <span className="block text-stone-500">Balance</span>
                    <span className="block font-bold text-stone-900">{formatNaira(remainingBalance)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayOption('full')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      payOption === 'full'
                        ? 'border-brand-800 bg-brand-50/60 ring-2 ring-brand-800/20'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
                      {amountPaid > 0 ? 'Pay Remaining Balance' : 'Pay in Full'}
                    </span>
                    <span className="text-lg font-bold text-stone-900 mt-1 block">
                      {formatNaira(remainingBalance)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPayOption('part');
                      if (!partAmount) setPartAmount(String(paymentLimits.minAmount));
                    }}
                    disabled={paymentLimits.minAmount >= paymentLimits.maxAmount}
                    className={`p-4 rounded-2xl border text-left transition-all disabled:opacity-50 ${
                      payOption === 'part'
                        ? 'border-brand-800 bg-brand-50/60 ring-2 ring-brand-800/20'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
                      Part Payment
                    </span>
                    <span className="text-lg font-bold text-stone-900 mt-1 block">
                      From {formatNaira(paymentLimits.minAmount)}
                    </span>
                    <span className="text-[11px] text-stone-500 mt-0.5 block">
                      Pay the rest later from My Booking
                    </span>
                  </button>
                </div>

                {payOption === 'part' && (
                  <div>
                    <label
                      htmlFor="partAmount"
                      className="block text-xs font-semibold text-stone-700 mb-1.5"
                    >
                      Amount to pay now (₦)
                    </label>
                    <input
                      id="partAmount"
                      type="number"
                      inputMode="numeric"
                      min={paymentLimits.minAmount}
                      max={paymentLimits.maxAmount}
                      step={1}
                      value={partAmount}
                      onChange={(e) => setPartAmount(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                    />
                    <p
                      className={`text-xs mt-1.5 ${isPartAmountValid ? 'text-stone-500' : 'text-red-600'}`}
                    >
                      Between {formatNaira(paymentLimits.minAmount)} and{' '}
                      {formatNaira(paymentLimits.maxAmount)}. Balance after this payment:{' '}
                      {formatNaira(Math.max(0, remainingBalance - partAmountNumber))}.
                    </p>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2 text-xs text-stone-600">
                  <div className="flex items-center justify-between">
                    <span>Paystack Currency</span>
                    <span className="font-mono font-bold text-stone-900">
                      NGN (Nigerian Naira)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Amount Sent to Paystack (in Kobo)</span>
                    <span className="font-mono font-bold text-stone-900">
                      {activeChargeKobo.toLocaleString()} kobo
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Customer Email</span>
                    <span className="font-medium text-stone-900">
                      {booking.guestEmail}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isInitializing}
                  onClick={handleInitializePaystack}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {isInitializing
                      ? 'Initializing Paystack Transaction...'
                      : `Initialize Paystack Checkout (${formatNaira(activeChargeAmount)})`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Step 2: Interactive Paystack Test Checkout Widget */
              <div className="bg-white rounded-3xl border-2 border-emerald-600 p-6 sm:p-8 shadow-md space-y-6">
                <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900">
                      {initializedPayment.mode === 'LIVE_TEST_API'
                        ? 'Paystack Live Test API (sk_test_)'
                        : 'Paystack Simulated Test Checkout'}
                    </span>
                    <h2 className="text-xl font-bold text-stone-900 mt-1.5">
                      Paystack Test Payment Gateway
                    </h2>
                    <p className="text-xs text-stone-500 font-mono mt-0.5">
                      Ref: {initializedPayment.reference} • Access Code:{' '}
                      {initializedPayment.accessCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-stone-500 block">
                      Payable Now
                    </span>
                    <span className="text-xl font-bold text-emerald-700">
                      {formatNaira(initializedPayment.amount)}
                    </span>
                    <span className="block text-[10px] font-mono text-stone-400">
                      ({initializedPayment.amountKobo.toLocaleString()} kobo)
                    </span>
                  </div>
                </div>

                {/* Test Channel Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                    Select Paystack Test Channel
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedChannel('card')}
                      className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 ${
                        selectedChannel === 'card'
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                          : 'border-stone-200 text-stone-600'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Test Card (408408...)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChannel('bank_transfer')}
                      className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 ${
                        selectedChannel === 'bank_transfer'
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                          : 'border-stone-200 text-stone-600'
                      }`}
                    >
                      <Landmark className="w-4 h-4" />
                      <span>Test Bank Transfer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChannel('ussd')}
                      className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 ${
                        selectedChannel === 'ussd'
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                          : 'border-stone-200 text-stone-600'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Test USSD (*737#)</span>
                    </button>
                  </div>
                </div>

                {initializedPayment.mode === 'LIVE_TEST_API' &&
                  initializedPayment.authorizationUrl.startsWith('http') && (
                    <a
                      href={initializedPayment.authorizationUrl}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-brand-900 hover:bg-brand-950 text-white text-xs font-bold"
                    >
                      <span>Open Hosted Paystack Test Checkout URL</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  )}

                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleCompleteTestCheckout('success')}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Authorize Successful Test Payment (
                      {formatNaira(initializedPayment.amount)})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCompleteTestCheckout('failed')}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 text-xs font-semibold transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Simulate Declined / Failed Payment Callback</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right 2 Columns: Booking Summary */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-3xl border border-stone-200/90 p-6 shadow-xs space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-800 text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                    Booking Summary
                  </span>
                  <h3 className="text-base font-bold text-stone-900">
                    {apartment?.name || 'Serviced Residence'}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {apartment?.location}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs border-t border-stone-200 pt-4">
                <div className="flex items-center justify-between text-stone-600">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand-700" />
                    Check-In
                  </span>
                  <span className="font-semibold text-stone-900">
                    {formatDisplayDate(booking.checkIn)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-stone-600">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand-700" />
                    Check-Out
                  </span>
                  <span className="font-semibold text-stone-900">
                    {formatDisplayDate(booking.checkOut)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-stone-600">
                  <span>Duration</span>
                  <span className="font-semibold text-stone-900">
                    {nights} {nights === 1 ? 'Night' : 'Nights'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs border-t border-stone-200 pt-4">
                <div className="flex items-center justify-between text-stone-600">
                  <span>Total Reservation Price</span>
                  <span className="font-bold text-stone-900">
                    {formatNaira(totalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Already Paid</span>
                  <span className="font-semibold">{formatNaira(amountPaid)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-brand-900 pt-2 border-t border-stone-200">
                  <span>Selected Charge</span>
                  <span>{formatNaira(activeChargeAmount)}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-sand-50 border border-stone-200/80 text-[11px] text-stone-600 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-700 shrink-0 mt-0.5" />
                <span>
                  Payment status is only updated after server-side verification
                  at <code>/api/payments/verify</code>.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
