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
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
  ReceiptStatusBadge,
} from '@/components/ui/BookingStatusBadge';
import { formatDisplayDate, formatNaira } from '@/lib/utils';
import type { CustomerBookingVerifiedView } from '@/types';

const SESSION_TOKEN_STORAGE_KEY = 'verdant_booking_access_session_token_v1';

function MyBookingContent() {
  const searchParams = useSearchParams();
  const {
    realtorConfig,
    bookings,
    devVerificationCodes,
    refreshPlatformState,
    addToast,
  } = useBookingContext();

  const [activeTab, setActiveTab] = useState<'verify' | 'request-fresh'>('verify');
  const [verificationCode, setVerificationCode] = useState('');
  const [bookingReference, setBookingReference] = useState('');
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
      setBookingReference(qRef.toUpperCase());
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
        body: JSON.stringify({
          verificationCode: verificationCode.trim(),
          bookingReference: bookingReference.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setVerifyError(
          data.error ||
            'Unable to verify booking access. Please check your verification code or request a fresh code.'
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
      addToast({
        type: 'success',
        title: 'Booking Access Verified',
        message: `Viewing reservation ${data.booking.bookingReference}. One-time code has been marked as used.`,
      });
    } catch {
      setVerifyError('Network error while verifying booking code.');
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
        setVerifyError(data.error || 'Could not request fresh code.');
      } else {
        setFreshResultMessage(data.message);
        if (data.devModeCodePreview) {
          setFreshDevCodePreview(data.devModeCodePreview);
          setBookingReference(freshRef.trim().toUpperCase());
          setVerificationCode(data.devModeCodePreview);
        }
        await refreshPlatformState();
      }
    } catch {
      setVerifyError('Network error while requesting a fresh verification code.');
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
        <div className="bg-brand-950 text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Customer Booking Session (Passwordless Access)</span>
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

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => sessionToken && loadSessionBooking(sessionToken)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-brand-900 hover:bg-brand-800 border border-brand-700 text-xs font-semibold text-stone-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Status</span>
            </button>
            <button
              type="button"
              onClick={handleEndBookingSession}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-white transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Verify Another Booking</span>
            </button>
          </div>
        </div>

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

            <div className="flex flex-wrap items-center gap-3">
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
                    Pay {formatNaira(verifiedBooking.balanceAmount)} with Paystack
                    (Test Mode)
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
                <span className="font-bold text-amber-900 block">Next Steps & Approval Status</span>
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

  // Default Unauthenticated View: Enter Verification Code OR Request Fresh Code
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-100 text-brand-900 text-xs font-semibold">
          <Lock className="w-3.5 h-3.5 text-brand-700" />
          <span>Passwordless Customer Booking Access</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900">
          Access Your Booking with a Verification Code
        </h1>
        <p className="text-sm text-stone-600 leading-relaxed">
          No customer account password is required. Enter the one-time 6-digit
          verification code sent to your email or phone number when you booked
          with <strong>{realtorConfig.businessName}</strong>.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-md overflow-hidden">
        {/* Tabs */}
        <div className="grid grid-cols-2 border-b border-stone-200 bg-stone-50">
          <button
            type="button"
            onClick={() => {
              setActiveTab('verify');
              setVerifyError(null);
            }}
            className={`py-4 px-6 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'verify'
                ? 'bg-white text-brand-900 border-b-2 border-brand-800'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Enter Verification Code</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('request-fresh');
              setVerifyError(null);
            }}
            className={`py-4 px-6 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'request-fresh'
                ? 'bg-white text-brand-900 border-b-2 border-brand-800'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Code Expired? Request Fresh Code</span>
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {verifyError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start justify-between gap-3 text-xs sm:text-sm text-red-900">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{verifyError}</p>
                  {(verifyErrorCode === 'EXPIRED_CODE' ||
                    verifyErrorCode === 'USED_CODE') && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('request-fresh')}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-red-800 underline"
                    >
                      Click here to request a fresh verification code →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'verify' ? (
            <form onSubmit={handleVerifySubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="verificationCode"
                    className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2"
                  >
                    6-Digit Verification Code *
                  </label>
                  <input
                    id="verificationCode"
                    type="text"
                    required
                    placeholder="e.g. 842101"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-300 font-mono text-lg tracking-widest text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                  />
                  <span className="text-[11px] text-stone-500 mt-1 block">
                    One-time code sent via email/SMS. Expires after{' '}
                    {realtorConfig.verificationCodeExpiryMinutes} minutes.
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="bookingReference"
                    className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2"
                  >
                    Booking Reference (Optional)
                  </label>
                  <input
                    id="bookingReference"
                    type="text"
                    placeholder="e.g. BK-2026-8421"
                    value={bookingReference}
                    onChange={(e) =>
                      setBookingReference(e.target.value.toUpperCase())
                    }
                    className="w-full px-4 py-3 rounded-xl border border-stone-300 font-mono text-base uppercase text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                  />
                  <span className="text-[11px] text-stone-500 mt-1 block">
                    Note: Booking reference alone cannot unlock a booking without
                    a valid verification code.
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-sm font-semibold transition-colors shadow-xs disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                <span>
                  {isVerifying
                    ? 'Verifying Code...'
                    : 'Verify Code & Access My Booking'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleRequestFreshCode} className="space-y-5">
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                If your one-time verification code has expired or was already
                used, enter your <strong>Booking Reference</strong> and the{' '}
                <strong>Email Address or Phone Number</strong> used when making
                the booking. We will invalidate any previous code and issue a
                fresh one.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="freshRef"
                    className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2"
                  >
                    Booking Reference *
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
                    Registered Email or Phone *
                  </label>
                  <input
                    id="freshContact"
                    type="text"
                    required
                    placeholder="e.g. chidi.nwosu@lagosventures.ng"
                    value={freshContact}
                    onChange={(e) => setFreshContact(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isRequestingFresh}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-sm font-semibold transition-colors shadow-xs disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>
                  {isRequestingFresh
                    ? 'Sending Fresh Code...'
                    : 'Send Fresh Verification Code'}
                </span>
              </button>

              {freshResultMessage && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-emerald-950">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <p>{freshResultMessage}</p>
                  </div>

                  {freshDevCodePreview && (
                    <div className="p-3.5 rounded-xl bg-white border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                          Development Mode Outbox Preview
                        </span>
                        <span className="text-xs text-stone-700">
                          Fresh One-Time Code:{' '}
                          <strong className="font-mono text-base text-stone-950">
                            {freshDevCodePreview}
                          </strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('verify')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Use Code Now →</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Evaluator / Development Quick-Test Helper Box */}
      <div className="bg-amber-50/70 rounded-3xl border border-amber-200/90 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-amber-950">
                Development / Evaluator Mode: Sample Booking Verification Codes
              </h2>
              <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
                In production, verification codes are delivered privately via
                email/SMS and stored only as SHA-256 hashes in the database. For
                evaluation, click any booking below to pre-fill its active
                verification code or test requesting a fresh code:
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {bookings.slice(0, 6).map((bk) => {
            const ref = bk.bookingReference || bk.reference;
            const code = devVerificationCodes[ref.toUpperCase()];
            return (
              <div
                key={bk.id}
                className="p-3.5 rounded-2xl bg-white border border-amber-200/90 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-stone-900">
                      {ref}
                    </span>
                    <BookingStatusBadge status={bk.status} size="sm" />
                    <PaymentStatusBadge
                      status={bk.paymentStatus || 'Unpaid'}
                      size="sm"
                    />
                  </div>
                  <p className="text-stone-600">
                    {bk.guestName} • {bk.guestEmail}
                  </p>
                  <p className="text-[11px] text-amber-900 font-mono">
                    Dev Code: <strong>{code || 'Request Fresh Code'}</strong>
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  {code && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('verify');
                        setBookingReference(ref);
                        setVerificationCode(code);
                        setVerifyError(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold"
                    >
                      Fill Code
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('request-fresh');
                      setFreshRef(ref);
                      setFreshContact(bk.guestEmail);
                      setVerifyError(null);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-700 font-medium"
                  >
                    Fresh Code
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
