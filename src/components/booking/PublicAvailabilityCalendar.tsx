'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Building2,
  Calendar as CalendarIcon,
  ArrowRight,
  ExternalLink,
  Info,
} from 'lucide-react';
import { Apartment, PublicBookedInterval } from '@/types';
import {
  calculateBookingTotal,
  checkPublicApartmentAvailability,
  getPublicDayStatus,
} from '@/lib/availability';
import {
  calculateNights,
  formatDateYMD,
  formatDisplayDate,
  formatNaira,
  getTodayStr,
  parseDateYMD,
} from '@/lib/utils';
import { GuestSelector } from './GuestSelector';
import { EmptyState } from '@/components/ui/EmptyState';

export interface PublicAvailabilityCalendarProps {
  /**
   * Active public apartments.
   */
  apartments: Apartment[];
  /**
   * Sanitized public intervals containing ONLY { apartmentId, startDate, endDate, status: 'booked' | 'unavailable' }.
   * Never contains guest names, contact info, references, internal IDs, or block reasons.
   */
  occupiedIntervals: PublicBookedInterval[];
  /**
   * Currently selected apartment ID, or 'all' for the multi-apartment availability overview.
   */
  selectedApartmentId: string;
  onSelectApartment?: (apartmentId: string) => void;
  checkIn: string;
  checkOut: string;
  onSelectRange: (checkIn: string, checkOut: string) => void;
  guests?: number;
  onGuestsChange?: (guests: number) => void;
  showApartmentSelector?: boolean;
  showBookingActions?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function PublicAvailabilityCalendar({
  apartments,
  occupiedIntervals,
  selectedApartmentId,
  onSelectApartment,
  checkIn,
  checkOut,
  onSelectRange,
  guests = 2,
  onGuestsChange,
  showApartmentSelector = false,
  showBookingActions = false,
}: PublicAvailabilityCalendarProps) {
  const router = useRouter();
  const todayStr = getTodayStr();

  const activeApartments = useMemo(
    () => apartments.filter((a) => a.isActive),
    [apartments]
  );

  const selectedApartment = useMemo(
    () => activeApartments.find((a) => a.id === selectedApartmentId) || null,
    [activeApartments, selectedApartmentId]
  );

  const [baseMonth, setBaseMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const secondMonth = useMemo(() => {
    return new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1);
  }, [baseMonth]);

  if (activeApartments.length === 0) {
    return (
      <EmptyState
        title="No Active Apartments Available"
        description="There are currently no active apartment listings available to display on the public calendar."
      />
    );
  }

  const handlePrevMonth = () => {
    setBaseMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setBaseMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const handleDateClick = (dateStr: string) => {
    setFeedbackError(null);

    if (!selectedApartment) {
      setFeedbackError(
        'Please select an apartment above before choosing your check-in and check-out dates.'
      );
      return;
    }

    if (dateStr < todayStr) {
      setFeedbackError(
        'Past dates cannot be selected. Please choose a date starting from today.'
      );
      return;
    }

    const dayStatus = getPublicDayStatus(
      selectedApartment.id,
      dateStr,
      occupiedIntervals,
      true
    );

    // Case 1: Starting a new date selection (no checkIn yet, or both checkIn and checkOut already set, or clicked date <= checkIn)
    if (!checkIn || (checkIn && checkOut) || dateStr <= checkIn) {
      if (dayStatus === 'booked') {
        setFeedbackError(
          `${formatDisplayDate(
            dateStr
          )} is already Booked and cannot be selected as a check-in date.`
        );
        return;
      }
      if (dayStatus === 'unavailable') {
        setFeedbackError(
          `${formatDisplayDate(
            dateStr
          )} is Unavailable and cannot be selected as a check-in date.`
        );
        return;
      }
      onSelectRange(dateStr, '');
      return;
    }

    // Case 2: Selecting a check-out date (checkIn is set, checkOut is empty, and dateStr > checkIn)
    // Check-in is inclusive and check-out is exclusive, so a guest may check out on the start date of a Booked/Unavailable period provided [checkIn, dateStr) is completely open.
    const check = checkPublicApartmentAvailability(
      selectedApartment.id,
      checkIn,
      dateStr,
      occupiedIntervals,
      selectedApartment
    );

    if (!check.isAvailable) {
      setFeedbackError(
        check.reason ||
          'The selected stay range includes dates that are Booked or Unavailable. Please choose an open range.'
      );
      return;
    }

    onSelectRange(checkIn, dateStr);
  };

  // Validate currently selected range
  const rangeAvailability =
    selectedApartment && checkIn && checkOut
      ? checkPublicApartmentAvailability(
          selectedApartment.id,
          checkIn,
          checkOut,
          occupiedIntervals,
          selectedApartment
        )
      : null;

  const nights = calculateNights(checkIn, checkOut);
  const { totalAmount } = selectedApartment
    ? calculateBookingTotal(selectedApartment.pricePerNight, checkIn, checkOut)
    : { totalAmount: 0 };

  const renderSingleApartmentMonth = (monthDate: Date, apt: Apartment) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthTitle = monthDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const cells: React.ReactNode[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(<div key={`empty-${i}`} className="h-14" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      const dateStr = formatDateYMD(cellDate);
      const status = getPublicDayStatus(
        apt.id,
        dateStr,
        occupiedIntervals,
        true
      );

      const isCheckIn = checkIn === dateStr;
      const isCheckOut = checkOut === dateStr;
      const isInSelectedRange =
        Boolean(checkIn && checkOut) && dateStr > checkIn && dateStr < checkOut;

      // Can this occupied day act as an exclusive check-out date?
      const canActAsCheckout =
        Boolean(checkIn && !checkOut && dateStr > checkIn) &&
        status !== 'past';

      let cellClasses =
        'relative h-14 w-full rounded-xl text-xs font-medium flex flex-col items-center justify-center transition-all select-none px-1 ';
      let statusLabelText = 'Available';

      if (isCheckIn) {
        cellClasses +=
          'bg-brand-800 text-white font-bold shadow-xs ring-2 ring-brand-800/30 z-10 cursor-pointer';
        statusLabelText = 'Check-In';
      } else if (isCheckOut) {
        cellClasses +=
          'bg-brand-800 text-white font-bold shadow-xs ring-2 ring-brand-800/30 z-10 cursor-pointer';
        statusLabelText = 'Check-Out';
      } else if (isInSelectedRange) {
        cellClasses +=
          'bg-brand-100 text-brand-950 font-semibold border border-brand-300 hover:bg-brand-200 cursor-pointer';
        statusLabelText = 'Selected';
      } else if (status === 'past') {
        cellClasses += 'text-stone-300 bg-stone-50/70 cursor-not-allowed';
        statusLabelText = 'Past';
      } else if (status === 'booked') {
        cellClasses += canActAsCheckout
          ? 'bg-rose-50 text-rose-800 border border-rose-200 hover:border-brand-700 cursor-pointer'
          : 'bg-rose-50/90 text-rose-800 border border-rose-200/90 cursor-not-allowed';
        statusLabelText = 'Booked';
      } else if (status === 'unavailable') {
        cellClasses += canActAsCheckout
          ? 'bg-stone-200/80 text-stone-700 border border-stone-300 hover:border-brand-700 cursor-pointer'
          : 'bg-stone-200/75 text-stone-600 border border-stone-300/80 cursor-not-allowed';
        statusLabelText = 'Unavailable';
      } else {
        cellClasses +=
          'bg-white text-stone-900 border border-stone-200/90 hover:border-brand-700 hover:bg-brand-50/50 cursor-pointer';
        statusLabelText = 'Available';
      }

      const ariaDescription = `${formatDisplayDate(dateStr)}: ${statusLabelText}`;

      cells.push(
        <button
          key={dateStr}
          type="button"
          aria-label={ariaDescription}
          title={ariaDescription}
          onClick={() => handleDateClick(dateStr)}
          className={cellClasses}
        >
          <span
            className={`text-xs ${
              (status === 'booked' || status === 'unavailable') &&
              !isCheckIn &&
              !isCheckOut
                ? 'line-through opacity-80'
                : 'font-semibold'
            }`}
          >
            {day}
          </span>
          <span
            className={`text-[9px] leading-none mt-1 truncate max-w-full ${
              isCheckIn || isCheckOut
                ? 'text-brand-100 font-bold uppercase'
                : isInSelectedRange
                ? 'text-brand-800 font-semibold'
                : status === 'booked'
                ? 'text-rose-700 font-semibold'
                : status === 'unavailable'
                ? 'text-stone-600 font-medium'
                : status === 'past'
                ? 'text-stone-300'
                : 'text-emerald-700 font-medium'
            }`}
          >
            {statusLabelText}
          </span>
        </button>
      );
    }

    return (
      <div className="flex-1 min-w-0">
        <div className="text-center font-bold text-stone-900 text-sm mb-3">
          {monthTitle}
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-[11px] font-semibold uppercase tracking-wider text-stone-400 py-1"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">{cells}</div>
      </div>
    );
  };

  // Multi-apartment overview matrix when selectedApartmentId === 'all'
  const renderAllApartmentsOverview = () => {
    const year = baseMonth.getFullYear();
    const month = baseMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthTitle = baseMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const daysArray = Array.from({ length: daysInMonth }, (_, i) =>
      formatDateYMD(new Date(year, month, i + 1))
    );

    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-brand-50/80 border border-brand-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-brand-950">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-brand-700 shrink-0" />
            <span>
              <strong>All Apartments Overview ({monthTitle}):</strong> Select
              any apartment row or click an available date cell below to pick
              your check-in and check-out dates for that residence.
            </span>
          </div>
        </div>

        <div className="overflow-x-auto border border-stone-200 rounded-2xl">
          <table className="w-full border-collapse text-xs min-w-[920px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="py-3 px-4 text-left font-bold text-stone-800 w-60 sticky left-0 bg-stone-50 z-10 border-r border-stone-200">
                  Residence ({monthTitle})
                </th>
                {daysArray.map((dStr) => {
                  const dObj = parseDateYMD(dStr);
                  const isToday = dStr === todayStr;
                  return (
                    <th
                      key={dStr}
                      className={`py-2 px-1 text-center font-semibold min-w-[32px] border-r border-stone-100 ${
                        isToday ? 'bg-brand-800 text-white' : 'text-stone-600'
                      }`}
                    >
                      <div className="text-[9px] uppercase opacity-75">
                        {WEEKDAYS[dObj.getDay()].slice(0, 1)}
                      </div>
                      <div>{dObj.getDate()}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {activeApartments.map((apt) => (
                <tr key={apt.id} className="hover:bg-stone-50/70">
                  <td className="py-3 px-4 sticky left-0 bg-white z-10 border-r border-stone-200">
                    <button
                      type="button"
                      onClick={() => onSelectApartment?.(apt.id)}
                      className="text-left font-bold text-stone-900 hover:text-brand-800 block truncate max-w-[210px]"
                    >
                      {apt.name}
                    </button>
                    <div className="text-[11px] text-stone-500 flex items-center justify-between mt-0.5">
                      <span>{apt.neighborhood}</span>
                      <span className="font-semibold text-brand-800">
                        {formatNaira(apt.pricePerNight)}
                      </span>
                    </div>
                  </td>
                  {daysArray.map((dStr) => {
                    const status = getPublicDayStatus(
                      apt.id,
                      dStr,
                      occupiedIntervals,
                      true
                    );

                    let cellStyle =
                      'bg-white hover:bg-emerald-50 text-emerald-700 cursor-pointer';
                    let shortCode = '✓';
                    let statusTitle = 'Available';

                    if (status === 'booked') {
                      cellStyle =
                        'bg-rose-100 text-rose-800 font-semibold cursor-not-allowed';
                      shortCode = 'B';
                      statusTitle = 'Booked';
                    } else if (status === 'unavailable') {
                      cellStyle =
                        'bg-stone-200 text-stone-600 font-medium cursor-not-allowed';
                      shortCode = 'U';
                      statusTitle = 'Unavailable';
                    } else if (status === 'past') {
                      cellStyle =
                        'bg-stone-50 text-stone-300 cursor-not-allowed';
                      shortCode = '–';
                      statusTitle = 'Past Date';
                    }

                    return (
                      <td
                        key={dStr}
                        title={`${apt.name} • ${formatDisplayDate(
                          dStr
                        )}: ${statusTitle}`}
                        onClick={() => {
                          if (onSelectApartment) {
                            onSelectApartment(apt.id);
                          }
                          if (status === 'available') {
                            setFeedbackError(null);
                            onSelectRange(dStr, '');
                          }
                        }}
                        className={`h-11 text-center border-r border-stone-100 text-[10px] transition-colors ${cellStyle}`}
                      >
                        {shortCode}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const handleProceedToBooking = () => {
    if (!selectedApartment || !checkIn || !checkOut || !rangeAvailability?.isAvailable) {
      return;
    }
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      guests: String(guests),
    });
    router.push(`/booking/${selectedApartment.id}?${params.toString()}`);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      {/* Top Apartment Selector Bar (when enabled) */}
      {showApartmentSelector && (
        <div className="pb-5 border-b border-stone-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <label
                htmlFor="public-calendar-apartment-select"
                className="block text-xs font-bold uppercase tracking-wider text-brand-700 mb-1"
              >
                Select Apartment to Check Availability
              </label>
              <p className="text-xs text-stone-500">
                Choose a specific residence to select your check-in and
                check-out dates, or view the multi-apartment overview.
              </p>
            </div>

            <div className="w-full md:w-80">
              <select
                id="public-calendar-apartment-select"
                value={selectedApartmentId}
                onChange={(e) => {
                  setFeedbackError(null);
                  onSelectApartment?.(e.target.value);
                }}
                className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              >
                <option value="all">
                  All Apartments (Availability Overview)
                </option>
                {activeApartments.map((apt) => (
                  <option key={apt.id} value={apt.id}>
                    {apt.name} — {formatNaira(apt.pricePerNight)}/night
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Apartment Selector Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFeedbackError(null);
                onSelectApartment?.('all');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                selectedApartmentId === 'all'
                  ? 'bg-brand-800 text-white border-brand-800 shadow-2xs'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              All Apartments Overview
            </button>
            {activeApartments.map((apt) => {
              const active = selectedApartmentId === apt.id;
              return (
                <button
                  key={apt.id}
                  type="button"
                  onClick={() => {
                    setFeedbackError(null);
                    onSelectApartment?.(apt.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    active
                      ? 'bg-brand-800 text-white border-brand-800 shadow-2xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:border-brand-600'
                  }`}
                >
                  {apt.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar Header & Month Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-brand-700 shrink-0" />
            <span>
              {selectedApartment
                ? `${selectedApartment.name} — Availability Calendar`
                : 'Portfolio Availability Overview'}
            </span>
          </h3>
          <p className="text-xs text-stone-600 mt-1">
            {!selectedApartment
              ? 'Select an apartment above or click an available date in the matrix to begin selecting your stay.'
              : !checkIn
              ? 'Step 1: Click an Available date on the calendar for your Check-In.'
              : !checkOut
              ? `Check-In selected: ${formatDisplayDate(
                  checkIn
                )} — Step 2: Click your Check-Out date.`
              : `Selected Stay: ${formatDisplayDate(
                  checkIn
                )} → ${formatDisplayDate(checkOut)} (${nights} ${
                  nights === 1 ? 'night' : 'nights'
                })`}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {(checkIn || checkOut) && (
            <button
              type="button"
              onClick={() => {
                setFeedbackError(null);
                onSelectRange('', '');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Dates
            </button>
          )}
          <div className="flex items-center rounded-xl border border-stone-200 bg-stone-50 p-0.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="p-1.5 rounded-lg text-stone-700 hover:bg-white hover:shadow-2xs transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setBaseMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
              className="px-2.5 py-1 text-xs font-semibold text-stone-700 hover:text-stone-900"
            >
              Current Month
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="p-1.5 rounded-lg text-stone-700 hover:bg-white hover:shadow-2xs transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Feedback / Validation Messages */}
      {feedbackError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{feedbackError}</span>
        </div>
      )}

      {selectedApartment &&
        checkIn &&
        checkOut &&
        rangeAvailability &&
        !rangeAvailability.isAvailable &&
        !feedbackError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{rangeAvailability.reason}</span>
          </div>
        )}

      {selectedApartment &&
        checkIn &&
        checkOut &&
        rangeAvailability?.isAvailable &&
        !feedbackError && (
          <div className="flex items-center justify-between flex-wrap gap-3 p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-950 text-xs font-medium">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>{selectedApartment.name}</strong> is available from{' '}
                <strong>{formatDisplayDate(checkIn)}</strong> to{' '}
                <strong>{formatDisplayDate(checkOut)}</strong> ({nights}{' '}
                {nights === 1 ? 'night' : 'nights'}).
              </span>
            </div>
            <span className="font-bold text-emerald-900">
              Estimated Total: {formatNaira(totalAmount)}
            </span>
          </div>
        )}

      {/* Calendar Body: Either Single Apartment Dual-Month Grid OR All Apartments Overview */}
      {selectedApartment ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {renderSingleApartmentMonth(baseMonth, selectedApartment)}
          {renderSingleApartmentMonth(secondMonth, selectedApartment)}
        </div>
      ) : (
        renderAllApartmentsOverview()
      )}

      {/* Color & Label Legend + Guest Privacy Notice */}
      <div className="pt-4 border-t border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div
          aria-label="Calendar Status Legend"
          className="flex flex-wrap items-center gap-4 text-xs text-stone-700"
        >
          <span className="font-bold uppercase tracking-wider text-stone-400 text-[11px]">
            Status Legend:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md border border-stone-300 bg-white text-emerald-700 font-semibold text-[11px]">
              Available
            </span>
            <span className="text-stone-600">Open for booking</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-brand-800 text-white font-bold text-[11px]">
              Selected
            </span>
            <span className="text-stone-600">Your intended stay</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 font-semibold text-[11px]">
              Booked
            </span>
            <span className="text-stone-600">Occupied by reservation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-stone-200 border border-stone-300 text-stone-700 font-medium text-[11px]">
              Unavailable
            </span>
            <span className="text-stone-600">Administrative block</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
          <ShieldCheck className="w-4 h-4 text-brand-700 shrink-0" />
          <span>
            Guest Privacy Protected: Only neutral availability statuses are
            shown publicly.
          </span>
        </div>
      </div>

      {/* Selected Stay Summary & Action Bar (when showBookingActions is true and an apartment is selected) */}
      {showBookingActions && selectedApartment && (
        <div className="p-5 rounded-2xl bg-sand-50 border border-stone-200/90 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                {selectedApartment.neighborhood}
              </span>
              <span className="text-stone-300">•</span>
              <span className="text-xs text-stone-600">
                Min stay: {selectedApartment.availabilityRules.minNights}{' '}
                {selectedApartment.availabilityRules.minNights === 1
                  ? 'night'
                  : 'nights'}{' '}
                (Check-out exclusive)
              </span>
            </div>
            <h4 className="text-base font-bold text-stone-900">
              {selectedApartment.name} —{' '}
              <span className="text-brand-800">
                {formatNaira(selectedApartment.pricePerNight)}/night
              </span>
            </h4>
            <p className="text-xs text-stone-600">
              {checkIn && checkOut && rangeAvailability?.isAvailable ? (
                <>
                  Check-In: <strong>{formatDisplayDate(checkIn)}</strong> →
                  Check-Out: <strong>{formatDisplayDate(checkOut)}</strong> (
                  {nights} {nights === 1 ? 'night' : 'nights'} • Est. Total:{' '}
                  <strong>{formatNaira(totalAmount)}</strong>)
                </>
              ) : (
                <span className="inline-flex items-center gap-1 text-stone-500">
                  <Info className="w-3.5 h-3.5 text-brand-700" />
                  Select available check-in and check-out dates on the calendar
                  above to proceed with a booking request.
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {onGuestsChange && (
              <div className="w-full sm:w-44">
                <GuestSelector
                  value={guests}
                  maxGuests={selectedApartment.maxGuests}
                  minGuests={1}
                  onChange={onGuestsChange}
                  label=""
                  compact
                />
              </div>
            )}

            <Link
              href={`/apartments/${selectedApartment.id}${
                checkIn && checkOut
                  ? `?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`
                  : ''
              }`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-800 transition-colors"
            >
              <span>Apartment Details</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <button
              type="button"
              disabled={
                !checkIn || !checkOut || !rangeAvailability?.isAvailable
              }
              onClick={handleProceedToBooking}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-800 hover:bg-brand-900 disabled:bg-stone-300 disabled:text-stone-500 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed shadow-2xs"
            >
              <span>Proceed to Booking Form</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
