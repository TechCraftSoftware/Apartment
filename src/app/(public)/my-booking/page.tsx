'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  KeyRound,
  ShieldCheck,
  Calendar,
  MapPin,
  Users,
  CreditCard,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Building2,
  Phone,
  Mail,
  ArrowRight,
  Ban,
  Sparkles,
  LogOut,
  Clock,
  FileText,
  Printer,
  Copy,
  X,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { BookingPassCard } from '@/components/booking/BookingPassCard';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
  ReceiptStatusBadge,
} from '@/components/ui/BookingStatusBadge';
import { formatDisplayDate, formatNaira } from '@/lib/utils';
import type { CustomerBookingVerifiedView } from '@/types';

import { BOOKING_ACCESS_TOKEN_STORAGE_KEY as SESSION_TOKEN_STORAGE_KEY } from '@/lib/bookingAccessClient';
const SHOW_DEV_HELPERS = process.env.NODE_ENV !== 'production';

function MyBookingContent() {
  const searchParams = useSearchParams();
  const {
    realtorConfig,
    devVerificationCodes,
    refreshPlatformState,
    addToast,
  } = useBookingContext();

  const [activeTab, setActiveTab] = useState<'verify' | 'request-fresh'>('verify');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyErrorCode, setVerifyErrorCode] = useState<string | null>(null);

  // Request Fresh Code form state
  const [freshRef, setFreshRef] = useState('');
  const [freshContact, setFreshContact] = useState('');
  const [isRequestingFresh, setIsRequestingFresh] = useState(false);
  const [freshResultMessage, setFreshResultMessage] = useState<string | null>(
    null
  );
  const [freshDevCodePreview, setFreshDevCodePreview] = useState<string | null>(
    null
  );

  // Verified Session State
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [verifiedBooking, setVerifiedBooking] =
    useState<CustomerBookingVerifiedView | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadSessionBooking = useCallback(async (token: string) => {
    try {
      const res = await fetch(
        `/api/my-booking/session?token=${encodeURIComponent(token)}`,
        {
          headers: { 'x-booking-access-token': token },
          cache: 'no-store',
        }
      );
      if (!res.ok) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
        }
        setSessionToken(null);
        setVerifiedBooking(null);
        return;
      }
      const data = await res.json();
      if (data.ok && data.booking) {
        setSessionToken(token);
        setVerifiedBooking(data.booking);
      }
    } catch {
      // Ignore network error on initial check
    }
  }, []);

  useEffect(() => {
    const qRef = searchParams.get('ref');
    const qCode = searchParams.get('code');
    if (qRef) {
      setFreshRef(qRef.toUpperCase());
    }
    if (qCode) {
      setVerificationCode(qCode);
    }

    if (typeof window !== 'undefined' && !qCode) {
      const savedToken = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
      if (savedToken) {
        loadSessionBooking(savedToken);
      }
    }
  }, [searchParams, loadSessionBooking]);

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    setVerifyErrorCode(null);
    setIsVerifying(true);

    try {
      const res = await fetch('/api/my-booking/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationCode: verificationCode.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setVerifyError(
          data.error ||
            'We could not find a booking for that code. Please check the code in your booking email.'
        );
        setVerifyErrorCode(data.code || null);
        setIsVerifying(false);
        return;
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, data.sessionToken);
      }
      setSessionToken(data.sessionToken);
      setVerifiedBooking(data.booking);
      setVerificationCode('');
    } catch {
      setVerifyError('Network error. Please check your connection and try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRequestFreshCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFreshResultMessage(null);
    setFreshDevCodePreview(null);
    setIsRequestingFresh(true);

    try {
      const res = await fetch('/api/my-booking/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingReference: freshRef.trim(),
          emailOrPhone: freshContact.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error || 'Could not resend your access code.');
      } else {
        setFreshResultMessage(data.message);
        if (data.devModeCodePreview) {
          setFreshDevCodePreview(data.devModeCodePreview);
          setVerificationCode(data.devModeCodePreview);
        }
        await refreshPlatformState();
      }
    } catch {
      setVerifyError('Network error while resending your access code.');
    } finally {
      setIsRequestingFresh(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!sessionToken || !verifiedBooking) return;
    setIsCancelling(true);
    try {
      const res = await fetch('/api/my-booking/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-booking-access-token': sessionToken,
        },
        body: JSON.stringify({
          action: 'CANCEL_BOOKING',
          sessionToken,
          reason: 'Customer cancelled via /my-booking verification portal.',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast({
          type: 'error',
          title: 'Cannot Cancel Booking',
          message: data.error || 'Cancellation failed.',
        });
      } else {
        if (data.booking) {
          setVerifiedBooking(data.booking);
        }
        await refreshPlatformState();
        addToast({
          type: 'info',
          title: 'Booking Cancelled',
          message: data.message,
        });
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Network Error',
        message: 'Could not cancel booking.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePrintBooking = () => {
    if (typeof window !== 'undefined') window.print();
  };

  const handleCopySummary = async () => {
    if (!verifiedBooking) return;
    const b = verifiedBooking;
    const summary = [
      `${b.realtorBusinessName} — Booking ${b.bookingReference}`,
      `Guest: ${b.customerFullName}`,
      `Apartment: ${b.apartmentName}, ${b.apartmentLocation}`,
      `Check-in: ${formatDisplayDate(b.checkIn)} (${b.checkInTime})`,
      `Check-out: ${formatDisplayDate(b.checkOut)} (${b.checkOutTime})`,
      `Guests: ${b.guests} • Nights: ${b.nights}`,
      `Booking status: ${b.status === 'PendingApproval' ? 'Awaiting confirmation' : b.status}`,
      `Payment: ${b.paymentStatus} (${formatNaira(b.amountPaid)} of ${formatNaira(b.totalPrice)})`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      addToast({
        type: 'success',
        title: 'Booking Details Copied',
        message: 'Paste them into a message to share your booking.',
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'Your browser blocked clipboard access. Use Print instead.',
      });
    }
  };

  const handleEndBookingSession = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    }
    setSessionToken(null);
    setVerifiedBooking(null);
    setVerifyError(null);
    setVerifyErrorCode(null);
  };

  // Render Verified Customer Booking View if session is active
  if (verifiedBooking) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        {/* Session Header Bar */}
        <div className="bg-brand-950 text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg print:shadow-none">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{verifiedBooking.realtorBusinessName} • Booking Details</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold">
              Reservation {verifiedBooking.bookingReference}
            </h1>
            <p className="text-xs sm:text-sm text-stone-300">
              Guest: <strong>{verifiedBooking.customerFullName}</strong> (
              {verifiedBooking.customerMaskedEmail} •{' '}
              {verifiedBooking.customerMaskedPhone})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <button
              type="button"
              onClick={handlePrintBooking}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white text-brand-950 hover:bg-stone-100 text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-brand-900 hover:bg-brand-800 border border-brand-700 text-xs font-semibold text-stone-200 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Details</span>
            </button>
            <button
              type="button"
              onClick={() => sessionToken && loadSessionBooking(sessionToken)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-brand-900 hover:bg-brand-800 border border-brand-700 text-xs font-semibold text-stone-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleEndBookingSession}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-white transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Booking pass: code + QR to download or screenshot */}
        <BookingPassCard
          pass={{
            businessName: verifiedBooking.realtorBusinessName,
            bookingReference: verifiedBooking.bookingReference,
            guestName: verifiedBooking.customerFullName,
            apartmentName: verifiedBooking.apartmentName,
            apartmentLocation: verifiedBooking.apartmentLocation,
            checkIn: verifiedBooking.checkIn,
            checkOut: verifiedBooking.checkOut,
            nights: verifiedBooking.nights,
            guests: verifiedBooking.guests,
            bookingStatus: verifiedBooking.status,
            paymentStatus: verifiedBooking.paymentStatus,
            amountPaid: verifiedBooking.amountPaid,
            balanceAmount: verifiedBooking.balanceAmount,
          }}
        />

        {/* Status & Payment Action Banner */}
        <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Booking Status
                </span>
                <BookingStatusBadge status={verifiedBooking.status} />
              </div>
              <div className="h-8 w-px bg-stone-200 hidden sm:block" />
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Payment Status
                </span>
                <PaymentStatusBadge status={verifiedBooking.paymentStatus} />
              </div>
              <div className="h-8 w-px bg-stone-200 hidden sm:block" />
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Payment Method
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-800">
                  {verifiedBooking.paymentMethod === 'BankTransfer'
                    ? 'Bank Transfer'
                    : 'Paystack'}
                </span>
              </div>
              {verifiedBooking.paymentMethod === 'BankTransfer' && (
                <>
                  <div className="h-8 w-px bg-stone-200 hidden sm:block" />
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                      Transfer Receipt
                    </span>
                    <ReceiptStatusBadge
                      status={verifiedBooking.receiptVerificationStatus || 'PendingReview'}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 print:hidden">
              {verifiedBooking.hasUploadedReceipt && verifiedBooking.receiptStorageKey && (
                <a
                  href={`/api/receipts/${verifiedBooking.receiptStorageKey}?token=${encodeURIComponent(sessionToken || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-xs font-semibold text-stone-800 transition-colors shadow-2xs"
                >
                  <FileText className="w-4 h-4 text-brand-800" />
                  <span>View Uploaded Receipt</span>
                </a>
              )}

              {verifiedBooking.canPayNow && (
                <Link
                  href={`/payment/${verifiedBooking.bookingId}`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors shadow-xs"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {verifiedBooking.amountPaid > 0 ? 'Pay Balance' : 'Make Payment'} (
                    {formatNaira(verifiedBooking.balanceAmount)} outstanding)
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}

              {verifiedBooking.canCancelBooking && (
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleCancelBooking}
                  className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>
                    {isCancelling ? 'Cancelling...' : 'Cancel Pending Booking'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Next Steps & Rejection Explanation */}
          {verifiedBooking.nextStepsSummary && (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 flex items-start gap-3">
              <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-900 block">What happens next</span>
                <p className="leading-relaxed">{verifiedBooking.nextStepsSummary}</p>
                {verifiedBooking.rejectionReason && (
                  <p className="text-red-700 font-medium pt-1">
                    Receipt Review Note: {verifiedBooking.rejectionReason}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Main Grid: Apartment + Dates + Pricing */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Apartment Info */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-5 rounded-2xl bg-sand-50 border border-stone-200/80 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
                      {verifiedBooking.unitType}
                    </span>
                    <h2 className="text-xl font-bold text-stone-900 mt-0.5">
                      {verifiedBooking.apartmentName}
                    </h2>
                    <p className="text-xs text-stone-600 flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                      <span>{verifiedBooking.apartmentAddress}</span>
                    </p>
                  </div>
                  <Link
                    href={`/apartments/${verifiedBooking.apartmentId}`}
                    className="text-xs font-semibold text-brand-800 hover:underline shrink-0"
                  >
                    View Residence →
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-stone-200/80 text-sm">
                  <div>
                    <span className="text-xs text-stone-500 block">
                      Check-In ({verifiedBooking.checkInTime})
                    </span>
                    <span className="font-bold text-stone-900 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-700" />
                      {formatDisplayDate(verifiedBooking.checkIn)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500 block">
                      Check-Out ({verifiedBooking.checkOutTime})
                    </span>
                    <span className="font-bold text-stone-900 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-700" />
                      {formatDisplayDate(verifiedBooking.checkOut)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500 block">
                      Duration & Guests
                    </span>
                    <span className="font-bold text-stone-900 flex items-center gap-1.5 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-brand-700" />
                      {verifiedBooking.nights} Nights • {verifiedBooking.guests}{' '}
                      Guests
                    </span>
                  </div>
                </div>
              </div>

              {/* Check-In Instructions & Cancellation Policy */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-brand-700" />
                    <span>Check-In Instructions</span>
                  </h3>
                  <p className="text-xs text-stone-700 leading-relaxed">
                    {verifiedBooking.checkInInstructions}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-700" />
                    <span>Cancellation Policy & Support</span>
                  </h3>
                  <p className="text-xs text-stone-700 leading-relaxed">
                    {verifiedBooking.cancellationPolicySummary}
                  </p>
                  <div className="pt-2 text-xs text-stone-600 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-brand-700" />
                      <span>{verifiedBooking.realtorContactPhone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-brand-700" />
                      <span>{verifiedBooking.realtorContactEmail}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary Box */}
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-4 h-fit">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Financial Breakdown
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-stone-600">
                  <span>
                    {formatNaira(verifiedBooking.nightlyRate)} ×{' '}
                    {verifiedBooking.nights} nights
                  </span>
                  <span className="font-medium text-stone-900">
                    {formatNaira(
                      verifiedBooking.nightlyRate * verifiedBooking.nights
                    )}
                  </span>
                </div>
                {verifiedBooking.cleaningFee > 0 && (
                  <div className="flex items-center justify-between text-stone-600 text-xs">
                    <span>Cleaning Fee</span>
                    <span>{formatNaira(verifiedBooking.cleaningFee)}</span>
                  </div>
                )}
                {verifiedBooking.serviceFee > 0 && (
                  <div className="flex items-center justify-between text-stone-600 text-xs">
                    <span>Service Fee</span>
                    <span>{formatNaira(verifiedBooking.serviceFee)}</span>
                  </div>
                )}
                <div className="pt-2.5 border-t border-stone-200 flex items-baseline justify-between">
                  <span className="font-bold text-stone-900">Total Agreed</span>
                  <span className="text-lg font-bold text-stone-900">
                    {formatNaira(verifiedBooking.totalPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
                  <span>Amount Paid</span>
                  <span>{formatNaira(verifiedBooking.amountPaid)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-brand-900 pt-1 border-t border-stone-200/70">
                  <span>Balance Due</span>
                  <span>{formatNaira(verifiedBooking.balanceAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Transactions History for this Booking */}
          {verifiedBooking.payments.length > 0 && (
            <div className="pt-4 border-t border-stone-200 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Paystack Payment Transactions
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-stone-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-500 uppercase border-b border-stone-200">
                    <tr>
                      <th className="py-2.5 px-4">Reference</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Amount</th>
                      <th className="py-2.5 px-4">Mode</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {verifiedBooking.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 px-4 font-mono font-semibold text-stone-900">
                          {p.reference}
                        </td>
                        <td className="py-2.5 px-4 text-stone-700">
                          {p.paymentType}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-stone-900">
                          {formatNaira(p.amount)}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700">
                            {p.mode === 'LIVE_TEST_API'
                              ? 'Paystack Test API'
                              : 'Simulated Test Mode'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-emerald-700">
                          {p.status}
                        </td>
                        <td className="py-2.5 px-4 text-stone-500">
                          {new Date(p.paidAt || p.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default view: enter the booking access code from the booking email
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand-800 flex items-center justify-center mx-auto">
          <KeyRound className="w-7 h-7" />
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900">
          View My Booking
        </h1>
        <p className="text-sm text-stone-600 leading-relaxed">
          Enter the booking access code we emailed you when you booked with{' '}
          <strong>{realtorConfig.businessName}</strong>.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-md p-6 sm:p-8 space-y-5">
        {verifyError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-900">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{verifyError}</p>
              {(verifyErrorCode === 'EXPIRED_CODE' ||
                verifyErrorCode === 'USED_CODE') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('request-fresh')}
                  className="mt-1.5 text-xs font-bold text-red-800 underline cursor-pointer"
                >
                  Send me a new code →
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'verify' ? (
          <form onSubmit={handleVerifySubmit} className="space-y-5">
            <div>
              <label
                htmlFor="verificationCode"
                className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2"
              >
                Booking Access Code
              </label>
              <input
                id="verificationCode"
                type="text"
                required
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="XXXX-XXXX"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-4 rounded-xl border border-stone-300 font-mono text-2xl text-center tracking-[0.3em] uppercase text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-brand-700"
              />
              <span className="text-xs text-stone-500 mt-2 block text-center">
                You can use this code as many times as you need, before, during and after your stay.
              </span>
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-sm font-semibold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <span>{isVerifying ? 'Checking code...' : 'View My Booking'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-center text-xs text-stone-600">
              Lost your code?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('request-fresh');
                  setVerifyError(null);
                }}
                className="font-semibold text-brand-800 hover:underline cursor-pointer"
              >
                Email it to me again
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRequestFreshCode} className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-stone-900">Resend my access code</h2>
                <p className="text-xs text-stone-600 leading-relaxed mt-1">
                  Enter your booking reference and the email address or phone number
                  you booked with. We&apos;ll email you a new code (your old code will
                  stop working).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('verify');
                  setVerifyError(null);
                }}
                className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
                aria-label="Back to code entry"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="freshRef"
                  className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2"
                >
                  Booking Reference
                </label>
                <input
                  id="freshRef"
                  type="text"
                  required
                  placeholder="e.g. BK-2026-8421"
                  value={freshRef}
                  onChange={(e) => setFreshRef(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 font-mono text-sm uppercase text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                />
              </div>
              <div>
                <label
                  htmlFor="freshContact"
                  className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2"
                >
                  Email or Phone Used for Booking
                </label>
                <input
                  id="freshContact"
                  type="text"
                  required
                  placeholder="you@example.com"
                  value={freshContact}
                  onChange={(e) => setFreshContact(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isRequestingFresh}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-sm font-semibold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>{isRequestingFresh ? 'Sending...' : 'Email My Access Code'}</span>
            </button>

            {freshResultMessage && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                <div className="flex items-start gap-2.5 text-sm text-emerald-950">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <p>{freshResultMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('verify')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Enter My Code</span>
                </button>
                {freshDevCodePreview && (
                  <p className="text-xs text-amber-900 font-mono">
                    Dev outbox (no SMTP configured): <strong>{freshDevCodePreview}</strong>
                  </p>
                )}
              </div>
            )}
          </form>
        )}
      </div>

      {SHOW_DEV_HELPERS && (
        <details className="bg-amber-50/70 rounded-3xl border border-amber-200/90 p-5 text-xs">
          <summary className="flex items-center gap-2 font-bold text-amber-950 cursor-pointer">
            <Sparkles className="w-4 h-4 text-amber-700" />
            Development only: sample booking codes
          </summary>
          <p className="text-amber-900/90 mt-2 leading-relaxed">
            Hidden in production builds. Codes only appear here when no SMTP
            server is configured.
          </p>
          <div className="grid grid-cols-1 gap-2 mt-3">
            {/* Only references + codes known to this browser (seed demo codes and
                bookings made here) — never other guests' details. */}
            {Object.entries(devVerificationCodes).slice(0, 6).map(([ref, code]) => (
              <div
                key={ref}
                className="p-3 rounded-2xl bg-white border border-amber-200/90 flex items-center justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <span className="font-mono font-bold text-stone-900">{ref}</span>
                  <p className="text-amber-900 font-mono">
                    Code: <strong>{code}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('verify');
                    setVerificationCode(code);
                    setVerifyError(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold shrink-0 cursor-pointer"
                >
                  Fill Code
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default function MyBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-20 text-center text-sm text-stone-500">
          Loading booking verification portal...
        </div>
      }
    >
      <MyBookingContent />
    </Suspense>
  );
}
