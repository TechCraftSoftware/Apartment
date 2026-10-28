'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Mail,
  Phone,
  MessageSquare,
  Send,
  CreditCard,
  Landmark,
  Upload,
  FileText,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  X,
  HelpCircle,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { BookingSummary } from '@/components/booking/BookingSummary';
import { DateRangePicker } from '@/components/booking/DateRangePicker';
import { GuestSelector } from '@/components/booking/GuestSelector';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { checkPublicApartmentAvailability } from '@/lib/availability';
import {
  addDays,
  calculateNights,
  formatDisplayDate,
  formatNaira,
  getTodayStr,
} from '@/lib/utils';
import { PaymentMethod } from '@/types';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function BookingFormContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    apartments,
    realtorConfig,
    publicOccupiedIntervals,
    createBookingCheckoutAttempt,
    uploadTransferReceipt,
    submitBankTransferCheckout,
    refreshPlatformState,
    isHydrated,
  } = useBookingContext();

  const apartmentId = params?.id || '';
  const apartment = apartments.find((a) => a.id === apartmentId);

  const today = getTodayStr();
  const [checkIn, setCheckIn] = useState(
    searchParams.get('checkIn') || addDays(today, 14)
  );
  const [checkOut, setCheckOut] = useState(
    searchParams.get('checkOut') || addDays(today, 17)
  );
  const [guestCount, setGuestCount] = useState<number>(
    Number(searchParams.get('guests')) || 2
  );

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  // Payment Method Selection
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BankTransfer');

  // Bank Transfer Receipt State
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState(false);

  // Submission States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conflictResolutionNotice, setConflictResolutionNotice] = useState<{
    receiptKey: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (apartment && guestCount > apartment.maxGuests) {
      setGuestCount(apartment.maxGuests);
    }
  }, [apartment, guestCount]);

  if (!isHydrated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20">
        <LoadingState />
      </div>
    );
  }

  if (!apartment || !apartment.isActive) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20">
        <EmptyState
          title="Apartment Unavailable for Booking"
          description="This apartment listing is either inactive or could not be found."
          actionLabel="Browse Available Apartments"
          onAction={() => router.push('/apartments')}
        />
      </div>
    );
  }

  const liveAvailability = checkPublicApartmentAvailability(
    apartment.id,
    checkIn,
    checkOut,
    publicOccupiedIntervals,
    apartment
  );

  const nights = calculateNights(checkIn, checkOut);
  const totalDue =
    nights * apartment.pricePerNight +
    (apartment.cleaningFee || 0) +
    (apartment.serviceFee || 0) +
    (apartment.cautionDeposit || 0);

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!guestName.trim() || guestName.trim().length < 2) {
      nextErrors.guestName = 'Please enter your full name.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!guestEmail.trim() || !emailRegex.test(guestEmail.trim())) {
      nextErrors.guestEmail = 'Please enter a valid email address.';
    }

    if (!guestPhone.trim() || guestPhone.trim().length < 7) {
      nextErrors.guestPhone = 'Please enter a valid contact phone number.';
    }

    if (guestCount < 1 || guestCount > apartment.maxGuests) {
      nextErrors.guestCount = `Guest count must be between 1 and ${apartment.maxGuests}.`;
    }

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      nextErrors.dates = 'Please select valid check-in and check-out dates.';
    }

    if (paymentMethod === 'BankTransfer' && !receiptFile) {
      nextErrors.receipt = 'Please upload your proof-of-payment bank transfer receipt (PNG, JPG, WEBP, or PDF up to 5 MB).';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setReceiptError(null);
    if (!file) {
      setReceiptFile(null);
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setReceiptError(
        'Invalid file type. Please upload an image (PNG, JPG, WEBP) or a PDF document.'
      );
      setReceiptFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setReceiptError(
        `File size exceeds 5 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a smaller file.`
      );
      setReceiptFile(null);
      return;
    }

    setReceiptFile(file);
    if (errors.receipt) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.receipt;
        return copy;
      });
    }
  };

  const copyAccountNumber = () => {
    const acc = realtorConfig.bankTransferAccountNumber || '1018942201';
    navigator.clipboard.writeText(acc);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  const handlePaystackCheckout = async () => {
    setSubmitError(null);
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmissionStep('Creating checkout attempt...');

    try {
      const attemptRes = await createBookingCheckoutAttempt({
        apartmentId: apartment.id,
        guestName,
        guestEmail,
        guestPhone,
        checkIn,
        checkOut,
        guestCount,
        specialRequests,
        paymentMethod: 'Paystack',
      });

      if (!attemptRes.success || !attemptRes.checkoutAttemptId) {
        setSubmitError(
          attemptRes.error ||
            'Unable to initiate checkout. Another reservation may have claimed these dates.'
        );
        setIsSubmitting(false);
        setSubmissionStep(null);
        return;
      }

      setSubmissionStep('Redirecting to Paystack test payment...');

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const payInitRes = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutAttemptId: attemptRes.checkoutAttemptId,
          callbackBaseUrl: origin,
        }),
      });

      const payData = await payInitRes.json();
      if (!payInitRes.ok || !payData.authorizationUrl) {
        setSubmitError(payData.error || 'Failed to initialize Paystack gateway.');
        setIsSubmitting(false);
        setSubmissionStep(null);
        return;
      }

      window.location.href = payData.authorizationUrl;
    } catch {
      setSubmitError('Network error initializing online checkout.');
      setIsSubmitting(false);
      setSubmissionStep(null);
    }
  };

  const handleBankTransferCheckout = async () => {
    setSubmitError(null);
    setConflictResolutionNotice(null);
    if (!validateForm()) return;

    if (!receiptFile) {
      setErrors((prev) => ({
        ...prev,
        receipt: 'Please upload your proof-of-payment receipt before submitting.',
      }));
      return;
    }

    setIsSubmitting(true);
    setSubmissionStep('1/3 Creating checkout attempt...');

    try {
      // 1. Create checkout attempt
      const attemptRes = await createBookingCheckoutAttempt({
        apartmentId: apartment.id,
        guestName,
        guestEmail,
        guestPhone,
        checkIn,
        checkOut,
        guestCount,
        specialRequests,
        paymentMethod: 'BankTransfer',
      });

      if (!attemptRes.success || !attemptRes.checkoutAttemptId) {
        setSubmitError(
          attemptRes.error ||
            'Selected dates are no longer available. Please select different dates.'
        );
        setIsSubmitting(false);
        setSubmissionStep(null);
        return;
      }

      const checkoutAttemptId = attemptRes.checkoutAttemptId;

      // 2. Upload receipt file securely
      setSubmissionStep('2/3 Uploading proof of payment receipt...');
      const uploadRes = await uploadTransferReceipt(checkoutAttemptId, receiptFile);

      if (!uploadRes.success || !uploadRes.receiptKey) {
        setSubmitError(uploadRes.error || 'Failed to securely upload receipt file.');
        setIsSubmitting(false);
        setSubmissionStep(null);
        return;
      }

      const receiptKey = uploadRes.receiptKey;

      // 3. Finalize bank transfer submission
      setSubmissionStep('3/3 Finalizing booking submission & issuing access code...');
      const submitRes = await submitBankTransferCheckout(checkoutAttemptId, receiptKey);

      if (!submitRes.success) {
        if (submitRes.conflictResolution) {
          setConflictResolutionNotice({
            receiptKey: submitRes.conflictResolution.receiptKey,
            message: submitRes.conflictResolution.message,
          });
        } else {
          setSubmitError(submitRes.error || 'Failed to complete bank transfer booking.');
        }
        setIsSubmitting(false);
        setSubmissionStep(null);
        return;
      }

      await refreshPlatformState();

      if (submitRes.booking?.id) {
        router.push(`/booking-confirmation/${submitRes.booking.id}`);
      } else {
        router.push('/my-booking');
      }
    } catch {
      setSubmitError('An unexpected network error occurred while submitting your booking.');
      setIsSubmitting(false);
      setSubmissionStep(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === 'Paystack') {
      handlePaystackCheckout();
    } else {
      handleBankTransferCheckout();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Back Link */}
      <div>
        <Link
          href={`/apartments/${apartment.id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guestCount}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-brand-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {apartment.name} & Availability Calendar</span>
        </Link>

        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mt-3">
          Book Your Stay at {apartment.name}
        </h1>
        <p className="text-sm text-stone-600 mt-1 max-w-2xl">
          Choose your dates, provide guest contact details, and complete your reservation with
          online payment or bank transfer. Every reservation is verified and approved by our desk.
        </p>
      </div>

      {conflictResolutionNotice && (
        <div className="p-6 rounded-3xl bg-amber-50 border border-amber-300 text-amber-950 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-base text-amber-900">
                Availability Conflict — Receipt Preserved for Concierge Assistance
              </h3>
              <p className="text-sm text-amber-800 mt-1 leading-relaxed">
                {conflictResolutionNotice.message}
              </p>
              <div className="mt-3 p-3 bg-white/80 rounded-xl border border-amber-200 text-xs">
                <span className="font-semibold text-stone-700">Receipt Storage Key: </span>
                <code className="font-mono font-bold text-amber-900">
                  {conflictResolutionNotice.receiptKey}
                </code>
              </div>
              <div className="mt-4 flex gap-3">
                <Link
                  href="/apartments"
                  className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold transition-colors"
                >
                  Browse Other Available Units
                </Link>
                <Link
                  href="/my-booking"
                  className="px-4 py-2 rounded-xl border border-amber-400 bg-white text-amber-900 text-xs font-semibold hover:bg-amber-100/50"
                >
                  Go to /my-booking Access
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Booking Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-7 space-y-6"
        >
          {submitError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Booking Request Notice</p>
                <p className="text-xs text-red-800 mt-1 leading-relaxed">
                  {submitError}
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Stay Dates & Guests */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3.5">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-800 text-white text-xs flex items-center justify-center font-mono">
                  1
                </span>
                <span>Select Dates & Guests</span>
              </h2>
              {liveAvailability.isAvailable ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Dates Available
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Dates Unavailable
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-8">
                <DateRangePicker
                  checkIn={checkIn}
                  checkOut={checkOut}
                  onCheckInChange={setCheckIn}
                  onCheckOutChange={setCheckOut}
                  minDate={today}
                />
              </div>
              <div className="sm:col-span-4">
                <GuestSelector
                  value={guestCount}
                  maxGuests={apartment.maxGuests}
                  minGuests={1}
                  onChange={setGuestCount}
                  label={`Guests (Max ${apartment.maxGuests})`}
                />
              </div>
            </div>

            {!liveAvailability.isAvailable && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Requested dates cannot be booked:</p>
                  <p className="mt-0.5">{liveAvailability.reason}</p>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Guest Contact Details */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-5">
            <div className="border-b border-stone-100 pb-3.5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-brand-800 text-white text-xs flex items-center justify-center font-mono">
                    2
                  </span>
                  <span>Guest Contact Information</span>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  No login required. Your customer account will be created automatically, and your
                  secure 6-digit booking-access code will be issued to view your reservation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setGuestName('Zainab Balogun');
                  setGuestEmail('zainab.balogun@corporate.ng');
                  setGuestPhone('+234 803 740 1122');
                  setSpecialRequests(
                    'Arriving around 3:30 PM. Would appreciate extra towels and quiet unit.'
                  );
                  setErrors({});
                }}
                className="text-xs font-semibold text-brand-700 hover:text-brand-900 underline underline-offset-4 cursor-pointer"
              >
                Auto-fill Sample Guest
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="guest-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
                >
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="guest-name"
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g., Zainab Balogun"
                    className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 ${
                      errors.guestName
                        ? 'border-red-400 focus:ring-red-200'
                        : 'border-stone-300 focus:border-brand-700 focus:ring-brand-700/20'
                    }`}
                  />
                </div>
                {errors.guestName && (
                  <p className="text-xs text-red-600 mt-1">{errors.guestName}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="guest-email"
                    className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
                  >
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="guest-email"
                      type="email"
                      required
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="name@example.com"
                      className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 ${
                        errors.guestEmail
                          ? 'border-red-400 focus:ring-red-200'
                          : 'border-stone-300 focus:border-brand-700 focus:ring-brand-700/20'
                      }`}
                    />
                  </div>
                  {errors.guestEmail && (
                    <p className="text-xs text-red-600 mt-1">{errors.guestEmail}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="guest-phone"
                    className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
                  >
                    Phone Number (WhatsApp / Mobile) *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="guest-phone"
                      type="tel"
                      required
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="+234 803 000 0000"
                      className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 ${
                        errors.guestPhone
                          ? 'border-red-400 focus:ring-red-200'
                          : 'border-stone-300 focus:border-brand-700 focus:ring-brand-700/20'
                      }`}
                    />
                  </div>
                  {errors.guestPhone && (
                    <p className="text-xs text-red-600 mt-1">{errors.guestPhone}</p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="special-requests"
                  className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
                >
                  Special Requests (Optional)
                </label>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-stone-400 absolute left-3.5 top-3 pointer-events-none" />
                  <textarea
                    id="special-requests"
                    rows={3}
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="Let us know your estimated arrival time, airport transfer needs, or dietary preferences..."
                    className="w-full rounded-xl border border-stone-300 pl-10 pr-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Payment Method Selection */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-5">
            <div className="border-b border-stone-100 pb-3.5">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-800 text-white text-xs flex items-center justify-center font-mono">
                  3
                </span>
                <span>Select Payment Method</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Choose how you would like to pay for your reservation. Every booking requires
                manual admin approval regardless of payment method.
              </p>
            </div>

            {/* Payment Method Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: Bank Transfer */}
              <div
                onClick={() => setPaymentMethod('BankTransfer')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                  paymentMethod === 'BankTransfer'
                    ? 'border-brand-800 bg-sand-50/70 shadow-xs'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        paymentMethod === 'BankTransfer'
                          ? 'bg-brand-800 text-white'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-stone-900">Bank Transfer</h3>
                      <p className="text-xs text-stone-500">Direct transfer with receipt</p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'BankTransfer'}
                    onChange={() => setPaymentMethod('BankTransfer')}
                    className="mt-1 text-brand-800 focus:ring-brand-800"
                  />
                </div>
                <div className="mt-3 pt-3 border-t border-stone-100 text-[11px] text-stone-600 space-y-1">
                  <p className="font-medium text-stone-800">
                    • Pay to official bank account
                  </p>
                  <p>• Upload transfer receipt (PNG, JPG, PDF)</p>
                  <p>• Admin reviews receipt before confirming</p>
                </div>
              </div>

              {/* Option B: Paystack Online */}
              <div
                onClick={() => setPaymentMethod('Paystack')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                  paymentMethod === 'Paystack'
                    ? 'border-brand-800 bg-sand-50/70 shadow-xs'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        paymentMethod === 'Paystack'
                          ? 'bg-brand-800 text-white'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-stone-900">Pay Online</h3>
                      <p className="text-xs text-stone-500">Paystack Test Gateway</p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'Paystack'}
                    onChange={() => setPaymentMethod('Paystack')}
                    className="mt-1 text-brand-800 focus:ring-brand-800"
                  />
                </div>
                <div className="mt-3 pt-3 border-t border-stone-100 text-[11px] text-stone-600 space-y-1">
                  <p className="font-medium text-stone-800">
                    • Card, Bank Transfer, USSD
                  </p>
                  <p>• Instant automated payment verification</p>
                  <p>• Booking remains Pending until Admin approves</p>
                </div>
              </div>
            </div>

            {/* Conditional Flow: Bank Transfer Details & Upload */}
            {paymentMethod === 'BankTransfer' && (
              <div className="space-y-4 pt-2">
                {/* Bank Account Details Card */}
                <div className="p-5 rounded-2xl bg-sand-100/80 border border-brand-200/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-900 flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-brand-800" />
                      Realtor Bank Account Details
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-800 text-white">
                      Amount: {formatNaira(totalDue)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                    <div className="p-3 bg-white rounded-xl border border-stone-200">
                      <span className="text-stone-500 block text-[10px] uppercase font-bold">
                        Beneficiary Name
                      </span>
                      <span className="font-bold text-stone-900 block truncate">
                        {realtorConfig.bankTransferBeneficiaryName ||
                          'Verdant Stays Hospitality Ltd'}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-stone-200">
                      <span className="text-stone-500 block text-[10px] uppercase font-bold">
                        Bank Name
                      </span>
                      <span className="font-bold text-stone-900 block truncate">
                        {realtorConfig.bankTransferBankName || 'Zenith Bank PLC'}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-stone-200 flex items-center justify-between">
                      <div>
                        <span className="text-stone-500 block text-[10px] uppercase font-bold">
                          Account Number
                        </span>
                        <span className="font-mono font-bold text-stone-900 block text-sm">
                          {realtorConfig.bankTransferAccountNumber || '1018942201'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={copyAccountNumber}
                        className="p-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-700 transition-colors cursor-pointer"
                        title="Copy account number"
                      >
                        {copiedAccount ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-600 italic">
                    <strong>Instructions: </strong>
                    {realtorConfig.bankTransferInstructions ||
                      'Please use your Full Name or Phone Number as the transfer narrative.'}
                  </p>
                </div>

                {/* Upload Receipt Section */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                    Proof of Payment (Transfer Receipt) *
                  </label>
                  <p className="text-xs text-stone-500">
                    Upload your debit slip or mobile banking receipt (PNG, JPG, WEBP, or PDF, up to 5 MB).
                  </p>

                  <div
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                      receiptFile
                        ? 'border-emerald-400 bg-emerald-50/40'
                        : errors.receipt || receiptError
                          ? 'border-red-400 bg-red-50/40'
                          : 'border-stone-300 hover:border-brand-700 bg-stone-50/60'
                    }`}
                  >
                    {receiptFile ? (
                      <div className="flex items-center justify-between gap-4 max-w-md mx-auto">
                        <div className="flex items-center gap-3 text-left truncate">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-stone-900 truncate">
                              {receiptFile.name}
                            </p>
                            <p className="text-[11px] text-stone-500">
                              {(receiptFile.size / 1024).toFixed(1)} KB •{' '}
                              {receiptFile.type || 'File'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReceiptFile(null)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-white transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block space-y-2">
                        <Upload className="w-8 h-8 text-stone-400 mx-auto" />
                        <div>
                          <span className="text-xs font-bold text-brand-800 hover:underline">
                            Click to browse receipt file
                          </span>
                          <span className="text-xs text-stone-500 block mt-0.5">
                            PNG, JPG, WEBP, or PDF (max 5 MB)
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {(receiptError || errors.receipt) && (
                    <p className="text-xs text-red-600 flex items-center gap-1.5 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{receiptError || errors.receipt}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Conditional Flow: Paystack Notice */}
            {paymentMethod === 'Paystack' && (
              <div className="p-4 rounded-2xl bg-sand-50 border border-stone-200/90 text-xs text-stone-700 space-y-2">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-brand-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-stone-900">
                      Automated Paystack Test Gateway
                    </p>
                    <p className="mt-0.5 leading-relaxed">
                      You will be redirected to the Paystack payment gateway simulator. After payment
                      verification, your reservation is placed in <strong>Pending Approval</strong>{' '}
                      status and your booking-access code is issued. An administrator will review and
                      approve your booking.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 4: Submission Action */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-start gap-3 text-xs text-stone-600 leading-relaxed">
              <Clock className="w-5 h-5 text-brand-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-stone-900">
                  Manual Admin Approval Policy
                </p>
                <p className="mt-0.5">
                  A successful payment or uploaded transfer receipt does not automatically confirm
                  your booking. Your booking status will be <strong>Pending Approval</strong> until
                  our administrator verifies payment details and confirms the reservation.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !liveAvailability.isAvailable}
              className="w-full py-4 px-6 rounded-xl bg-brand-800 hover:bg-brand-900 disabled:bg-stone-300 disabled:text-stone-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{submissionStep || 'Processing your request...'}</span>
                </>
              ) : paymentMethod === 'Paystack' ? (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Proceed to Paystack Test Payment ({formatNaira(totalDue)})</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Transfer & Booking Request ({formatNaira(totalDue)})</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Right Column: Booking Summary */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
          <BookingSummary
            apartment={apartment}
            checkIn={checkIn}
            checkOut={checkOut}
            guestCount={guestCount}
          />

          <div className="p-4 rounded-2xl bg-sand-50/80 border border-stone-200/80 text-xs text-stone-600 space-y-2">
            <h4 className="font-bold text-stone-900 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-brand-800" />
              Need Assistance?
            </h4>
            <p>
              Have special booking requirements or need concierge support before making payment?
            </p>
            <div className="pt-1 flex flex-col gap-1 text-[11px] font-medium text-stone-700">
              <span>• Phone / WhatsApp: {realtorConfig.contactPhone || '+234 803 123 4567'}</span>
              <span>• Support Email: {realtorConfig.contactEmail || 'bookings@verdantstays.ng'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-20">
          <LoadingState />
        </div>
      }
    >
      <BookingFormContent />
    </Suspense>
  );
}
