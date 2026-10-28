'use client';

import React, { Suspense, useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  Check,
  Ban,
  Trash2,
  RotateCcw,
  Users,
  Mail,
  Phone,
  Info,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { AvailabilityBlock, Booking } from '@/types';
import { getDayAvailabilityStatus } from '@/lib/availability';
import {
  addDays,
  calculateNights,
  formatDateYMD,
  formatDisplayDate,
  formatNaira,
  formatShortDate,
  getTodayStr,
  parseDateYMD,
} from '@/lib/utils';
import { AvailabilityBlockDialog } from '@/components/admin/AvailabilityBlockDialog';
import { BookingStatusBadge } from '@/components/ui/BookingStatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState } from '@/components/ui/LoadingState';

type CalendarViewMode = 'month' | 'week' | 'day';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function AdminCalendarContent() {
  const searchParams = useSearchParams();
  const {
    apartments,
    bookings,
    blocks,
    createAvailabilityBlock,
    removeAvailabilityBlock,
    setDateRangeAvailable,
    updateBookingStatus,
  } = useBookingContext();

  const todayStr = getTodayStr();

  // Apartment filter: 'all' or specific apartment.id
  const [selectedApartmentId, setSelectedApartmentId] = useState<string>(
    searchParams.get('apartmentId') || apartments[0]?.id || 'all'
  );
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [anchorDateStr, setAnchorDateStr] = useState<string>(todayStr);

  // Interactive date range selection on the calendar
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'error' | 'success' | 'info';
    message: string;
  } | null>(null);

  // Modals / Drawers
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [inspectedBooking, setInspectedBooking] = useState<Booking | null>(
    null
  );
  const [inspectedBlock, setInspectedBlock] =
    useState<AvailabilityBlock | null>(null);
  const [confirmCancelBooking, setConfirmCancelBooking] =
    useState<Booking | null>(null);

  useEffect(() => {
    const paramApt = searchParams.get('apartmentId');
    if (paramApt) {
      setSelectedApartmentId(paramApt);
    }
  }, [searchParams]);

  // Keep inspectedBooking fresh when bookings state updates
  useEffect(() => {
    if (inspectedBooking) {
      const updated = bookings.find((b) => b.id === inspectedBooking.id);
      setInspectedBooking(updated || null);
    }
  }, [bookings, inspectedBooking]);

  const anchorDate = useMemo(
    () => parseDateYMD(anchorDateStr),
    [anchorDateStr]
  );

  const selectedApartment = useMemo(
    () => apartments.find((a) => a.id === selectedApartmentId),
    [apartments, selectedApartmentId]
  );

  // Period navigation
  const handleNavigatePeriod = (direction: -1 | 1) => {
    if (viewMode === 'month') {
      const next = new Date(
        anchorDate.getFullYear(),
        anchorDate.getMonth() + direction,
        1
      );
      setAnchorDateStr(formatDateYMD(next));
    } else if (viewMode === 'week') {
      setAnchorDateStr(addDays(anchorDateStr, direction * 7));
    } else {
      setAnchorDateStr(addDays(anchorDateStr, direction));
    }
  };

  const periodLabel = useMemo(() => {
    if (viewMode === 'month') {
      return anchorDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    }
    if (viewMode === 'week') {
      const endStr = addDays(anchorDateStr, 6);
      return `${formatDisplayDate(anchorDateStr)} – ${formatDisplayDate(endStr)}`;
    }
    return formatDisplayDate(anchorDateStr, true);
  }, [viewMode, anchorDate, anchorDateStr]);

  // Handle clicking a date cell in single-apartment mode
  const handleCalendarCellClick = (
    aptId: string,
    dateStr: string,
    info: ReturnType<typeof getDayAvailabilityStatus>
  ) => {
    setActionFeedback(null);

    // If user clicked a cell with a reservation, also open the reservation inspector
    if (info.booking) {
      setInspectedBooking(info.booking);
      setInspectedBlock(null);
    } else if (info.block) {
      setInspectedBlock(info.block);
      setInspectedBooking(null);
    }

    // If in 'all' apartments view, switch or set the apartment for range selection
    if (selectedApartmentId === 'all') {
      setSelectedApartmentId(aptId);
    }

    // Range selection logic (start inclusive, end exclusive: clicking a single day selects [dateStr, dateStr + 1 day))
    if (!rangeStart || (rangeStart && rangeEnd && rangeEnd !== addDays(rangeStart, 1)) || dateStr < rangeStart) {
      setRangeStart(dateStr);
      setRangeEnd(addDays(dateStr, 1));
    } else if (dateStr === rangeStart) {
      setRangeStart('');
      setRangeEnd('');
    } else {
      // Extend range to include clicked date (so exclusive endDate is clickedDate + 1 day)
      setRangeEnd(addDays(dateStr, 1));
    }
  };

  // Mark selected range available (unblock administrative blocks, but protect reservations!)
  const handleMarkSelectedRangeAvailable = () => {
    setActionFeedback(null);
    const targetAptId =
      selectedApartmentId === 'all' ? apartments[0]?.id : selectedApartmentId;
    if (!targetAptId || !rangeStart || !rangeEnd) {
      setActionFeedback({
        type: 'error',
        message: 'Please select an apartment and a date range on the calendar first.',
      });
      return;
    }

    const res = setDateRangeAvailable(targetAptId, rangeStart, rangeEnd);
    if (!res.success) {
      setActionFeedback({
        type: 'error',
        message:
          res.error ||
          'Cannot mark these dates as available due to an active reservation.',
      });
      return;
    }

    setActionFeedback({
      type: 'success',
      message:
        res.removedCount > 0
          ? `Cleared ${res.removedCount} administrative block(s) for ${formatDisplayDate(
              rangeStart
            )} – ${formatDisplayDate(rangeEnd)}. Dates are now available.`
          : `Selected range (${formatDisplayDate(rangeStart)} – ${formatDisplayDate(
              rangeEnd
            )}) is already available.`,
    });
    setRangeStart('');
    setRangeEnd('');
  };

  const getApartmentName = (id: string) =>
    apartments.find((a) => a.id === id)?.name || 'Residence';

  // Render Month View for a single apartment (or all apartments summary)
  const renderMonthView = () => {
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // If 'all' apartments is selected in Month view, render a multi-apartment monthly timeline matrix!
    if (selectedApartmentId === 'all') {
      const daysArray = Array.from({ length: daysInMonth }, (_, i) =>
        formatDateYMD(new Date(year, month, i + 1))
      );

      return (
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className="flex items-center justify-between mb-3 text-xs text-stone-500">
              <span>
                Showing all <strong>{apartments.length}</strong> apartments for{' '}
                <strong>{periodLabel}</strong>. Click any cell to inspect a
                booking/block or select an apartment.
              </span>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 border-y border-stone-200">
                  <th className="py-2.5 px-3 text-left font-bold text-stone-700 w-52 sticky left-0 bg-stone-50 z-10 border-r border-stone-200">
                    Apartment
                  </th>
                  {daysArray.map((dStr) => {
                    const dObj = parseDateYMD(dStr);
                    const isToday = dStr === todayStr;
                    return (
                      <th
                        key={dStr}
                        className={`py-2 px-1 text-center font-semibold min-w-[30px] border-r border-stone-100 ${
                          isToday
                            ? 'bg-brand-800 text-white'
                            : 'text-stone-600'
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
                {apartments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-stone-50/60">
                    <td className="py-2.5 px-3 font-semibold text-stone-900 sticky left-0 bg-white z-10 border-r border-stone-200">
                      <button
                        type="button"
                        onClick={() => setSelectedApartmentId(apt.id)}
                        className="text-left hover:text-brand-800 truncate block max-w-[190px]"
                        title={`Switch to single-calendar view for ${apt.name}`}
                      >
                        {apt.name}
                      </button>
                      <span className="text-[10px] text-stone-400 font-normal">
                        {apt.neighborhood}
                      </span>
                    </td>
                    {daysArray.map((dStr) => {
                      const info = getDayAvailabilityStatus(
                        apt.id,
                        dStr,
                        bookings,
                        blocks
                      );

                      let bgClass =
                        'bg-white hover:bg-emerald-50 text-stone-400';
                      let label = '';
                      if (info.status === 'confirmed') {
                        bgClass =
                          'bg-emerald-600 hover:bg-emerald-700 text-white font-bold';
                        label = 'C';
                      } else if (info.status === 'pending') {
                        bgClass =
                          'bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold';
                        label = 'P';
                      } else if (info.status === 'blocked') {
                        bgClass =
                          'bg-stone-300 hover:bg-stone-400 text-stone-800 font-bold';
                        label = 'B';
                      }

                      return (
                        <td
                          key={dStr}
                          onClick={() =>
                            handleCalendarCellClick(apt.id, dStr, info)
                          }
                          title={`${apt.name} • ${formatDisplayDate(dStr)}: ${
                            info.status === 'confirmed'
                              ? `Confirmed (${info.booking?.guestName})`
                              : info.status === 'pending'
                              ? `Pending (${info.booking?.guestName})`
                              : info.status === 'blocked'
                              ? `Blocked (${info.block?.reason})`
                              : 'Available'
                          }`}
                          className={`h-10 text-center border-r border-stone-100 cursor-pointer transition-colors text-[10px] ${bgClass}`}
                        >
                          {label}
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
    }

    // Single Apartment Month Grid
    const targetApt = selectedApartment || apartments[0];
    const cells: React.ReactNode[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(
        <div
          key={`empty-${i}`}
          className="min-h-[52px] sm:min-h-[104px] rounded-lg sm:rounded-xl bg-stone-50/60 border border-stone-100"
        />
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDateYMD(new Date(year, month, day));
      const info = getDayAvailabilityStatus(
        targetApt.id,
        dateStr,
        bookings,
        blocks
      );

      const isSelected =
        Boolean(rangeStart && rangeEnd) &&
        dateStr >= rangeStart &&
        dateStr < rangeEnd;
      const isToday = dateStr === todayStr;

      let cardStyle =
        'bg-white border-stone-200 hover:border-brand-600 text-stone-900';
      if (isSelected) {
        cardStyle =
          'bg-brand-50 border-brand-800 ring-2 ring-brand-800/30 text-brand-950';
      } else if (info.status === 'confirmed') {
        cardStyle =
          'bg-emerald-50/90 border-emerald-300 hover:border-emerald-500 text-emerald-950';
      } else if (info.status === 'pending') {
        cardStyle =
          'bg-amber-50/90 border-amber-300 hover:border-amber-500 text-amber-950';
      } else if (info.status === 'blocked') {
        cardStyle =
          'bg-stone-200/75 border-stone-300 hover:border-stone-400 text-stone-800';
      }

      cells.push(
        <div
          key={dateStr}
          onClick={() => handleCalendarCellClick(targetApt.id, dateStr, info)}
          className={`min-h-[52px] sm:min-h-[104px] rounded-lg sm:rounded-xl border p-1 sm:p-2.5 flex flex-col justify-between transition-all cursor-pointer select-none ${cardStyle}`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold ${
                isToday
                  ? 'w-6 h-6 rounded-full bg-brand-800 text-white flex items-center justify-center'
                  : ''
              }`}
            >
              {day}
            </span>
            {isSelected && (
              <span className="hidden sm:inline text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-800 text-white">
                Selected
              </span>
            )}
          </div>

          {/* Phones show the colour-coded day only; details appear from sm up. */}
          <div className="mt-2 hidden sm:block">
            {info.status === 'confirmed' && info.booking && (
              <div className="p-1.5 rounded-lg bg-emerald-600 text-white text-[11px] leading-tight shadow-2xs">
                <div className="font-bold truncate">
                  {info.booking.guestName}
                </div>
                <div className="text-[10px] text-emerald-100 truncate">
                  {info.booking.reference} • Confirmed
                </div>
              </div>
            )}

            {info.status === 'pending' && info.booking && (
              <div className="p-1.5 rounded-lg bg-amber-500 text-stone-950 text-[11px] leading-tight shadow-2xs">
                <div className="font-bold truncate">
                  {info.booking.guestName}
                </div>
                <div className="text-[10px] text-amber-950 font-medium truncate">
                  {info.booking.reference} • Pending
                </div>
              </div>
            )}

            {info.status === 'blocked' && info.block && (
              <div className="p-1.5 rounded-lg bg-stone-700 text-white text-[11px] leading-tight">
                <div className="font-semibold flex items-center gap-1 truncate">
                  <Lock className="w-2.5 h-2.5 shrink-0" />
                  <span>Blocked</span>
                </div>
                <div className="text-[10px] text-stone-300 truncate">
                  {info.block.reason}
                </div>
              </div>
            )}

            {info.status === 'available' && (
              <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Available</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] sm:text-xs font-bold uppercase sm:tracking-wider text-stone-500 py-1"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {cells}
        </div>
      </div>
    );
  };

  // Render Week View (7 days across either selected apartment or all apartments)
  const renderWeekView = () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      addDays(anchorDateStr, i)
    );
    const listApartments =
      selectedApartmentId === 'all'
        ? apartments
        : apartments.filter((a) => a.id === selectedApartmentId);

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left min-w-[760px]">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-stone-600 w-56">
                Apartment
              </th>
              {days.map((dStr) => {
                const dObj = parseDateYMD(dStr);
                const isToday = dStr === todayStr;
                return (
                  <th
                    key={dStr}
                    className={`py-3 px-3 text-xs font-bold text-center border-l border-stone-200 ${
                      isToday ? 'bg-brand-50 text-brand-900' : 'text-stone-700'
                    }`}
                  >
                    <div className="text-[10px] uppercase text-stone-500">
                      {WEEKDAYS[dObj.getDay()]}
                    </div>
                    <div>{formatShortDate(dStr)}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 text-xs">
            {listApartments.map((apt) => (
              <tr key={apt.id}>
                <td className="py-3.5 px-4 font-bold text-stone-900 bg-white">
                  <div>{apt.name}</div>
                  <div className="text-[11px] font-normal text-stone-500">
                    {formatNaira(apt.pricePerNight)} / night
                  </div>
                </td>
                {days.map((dStr) => {
                  const info = getDayAvailabilityStatus(
                    apt.id,
                    dStr,
                    bookings,
                    blocks
                  );
                  const isSelected =
                    selectedApartmentId === apt.id &&
                    Boolean(rangeStart && rangeEnd) &&
                    dStr >= rangeStart &&
                    dStr < rangeEnd;

                  return (
                    <td
                      key={dStr}
                      onClick={() =>
                        handleCalendarCellClick(apt.id, dStr, info)
                      }
                      className={`p-2 border-l border-stone-200 cursor-pointer align-top transition-colors ${
                        isSelected
                          ? 'bg-brand-100 ring-2 ring-inset ring-brand-800'
                          : 'hover:bg-stone-50'
                      }`}
                    >
                      {info.status === 'confirmed' && info.booking && (
                        <div className="p-2 rounded-lg bg-emerald-600 text-white">
                          <div className="font-bold truncate">
                            {info.booking.guestName}
                          </div>
                          <div className="text-[10px] text-emerald-100">
                            Confirmed
                          </div>
                        </div>
                      )}
                      {info.status === 'pending' && info.booking && (
                        <div className="p-2 rounded-lg bg-amber-400 text-stone-950">
                          <div className="font-bold truncate">
                            {info.booking.guestName}
                          </div>
                          <div className="text-[10px] font-medium">Pending</div>
                        </div>
                      )}
                      {info.status === 'blocked' && info.block && (
                        <div className="p-2 rounded-lg bg-stone-700 text-white">
                          <div className="font-semibold">Blocked</div>
                          <div className="text-[10px] text-stone-300 truncate">
                            {info.block.reason}
                          </div>
                        </div>
                      )}
                      {info.status === 'available' && (
                        <div className="p-2 text-emerald-700 font-medium text-center">
                          Available
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render Day View (detailed operational breakdown for `anchorDateStr`)
  const renderDayView = () => {
    const listApartments =
      selectedApartmentId === 'all'
        ? apartments
        : apartments.filter((a) => a.id === selectedApartmentId);

    return (
      <div className="space-y-3">
        {listApartments.map((apt) => {
          const info = getDayAvailabilityStatus(
            apt.id,
            anchorDateStr,
            bookings,
            blocks
          );

          return (
            <div
              key={apt.id}
              className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-900">
                    {apt.name}
                  </h3>
                  <span className="text-xs text-stone-500">
                    ({apt.neighborhood})
                  </span>
                </div>
                <p className="text-xs text-stone-600 mt-0.5">
                  Rate: {formatNaira(apt.pricePerNight)} / night • Max{' '}
                  {apt.maxGuests} guests
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {info.status === 'confirmed' && info.booking && (
                  <button
                    type="button"
                    onClick={() => setInspectedBooking(info.booking!)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
                  >
                    <span>
                      Confirmed: {info.booking.guestName} ({info.booking.reference})
                    </span>
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}

                {info.status === 'pending' && info.booking && (
                  <button
                    type="button"
                    onClick={() => setInspectedBooking(info.booking!)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 text-stone-950 text-xs font-bold"
                  >
                    <span>
                      Pending Request: {info.booking.guestName} (
                      {info.booking.reference})
                    </span>
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}

                {info.status === 'blocked' && info.block && (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-stone-200 text-stone-800 text-xs font-semibold">
                      Blocked: {info.block.reason}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAvailabilityBlock(info.block!.id)}
                      className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold"
                    >
                      Unblock
                    </button>
                  </div>
                )}

                {info.status === 'available' && (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                      Available for Night of {formatDisplayDate(anchorDateStr)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedApartmentId(apt.id);
                        setRangeStart(anchorDateStr);
                        setRangeEnd(addDays(anchorDateStr, 1));
                        setBlockDialogOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold"
                    >
                      Block Night
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Filtered blocks for the Active Blocks management section below the calendar
  const filteredBlocks = useMemo(() => {
    const list =
      selectedApartmentId === 'all'
        ? blocks
        : blocks.filter((b) => b.apartmentId === selectedApartmentId);
    return [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [blocks, selectedApartmentId]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
            Admin Availability & Block Calendar
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Inspect reservations across Month, Week, or Day views, block dates
            for maintenance, or release administrative blocks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setBlockDialogOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>Block Dates</span>
          </button>

          {rangeStart && rangeEnd && (
            <button
              type="button"
              onClick={handleMarkSelectedRangeAvailable}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              <Unlock className="w-4 h-4 text-emerald-700" />
              <span>Set Selected Range Available</span>
            </button>
          )}
        </div>
      </div>

      {/* Controls Bar: Apartment Selector, View Switcher, Period Navigator */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Apartment Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label
            htmlFor="calendar-apt-select"
            className="text-xs font-bold uppercase tracking-wider text-stone-500 shrink-0"
          >
            Apartment:
          </label>
          <select
            id="calendar-apt-select"
            value={selectedApartmentId}
            onChange={(e) => {
              setSelectedApartmentId(e.target.value);
              setRangeStart('');
              setRangeEnd('');
            }}
            className="rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm font-semibold text-stone-900 focus:border-brand-700 focus:outline-none"
          >
            <option value="all">
              All Apartments (Timeline / Portfolio Matrix)
            </option>
            {apartments.map((apt) => (
              <option key={apt.id} value={apt.id}>
                {apt.name} ({apt.neighborhood})
              </option>
            ))}
          </select>
        </div>

        {/* Period Navigator */}
        <div className="flex items-center justify-between sm:justify-center gap-3">
          <div className="flex items-center rounded-xl border border-stone-200 bg-stone-50 p-0.5">
            <button
              type="button"
              onClick={() => handleNavigatePeriod(-1)}
              aria-label="Previous period"
              className="p-2 rounded-lg text-stone-700 hover:bg-white hover:shadow-2xs transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setAnchorDateStr(todayStr)}
              className="px-3 py-1 text-xs font-semibold text-stone-700 hover:text-stone-900"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleNavigatePeriod(1)}
              aria-label="Next period"
              className="p-2 rounded-lg text-stone-700 hover:bg-white hover:shadow-2xs transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-sm sm:text-base font-bold text-stone-900 min-w-[160px] text-center">
            {periodLabel}
          </span>
        </div>

        {/* View Mode Switcher (Month, Week, Day) */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 self-start lg:self-auto">
          {(['month', 'week', 'day'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                viewMode === mode
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Range Interactive Action Bar */}
      {rangeStart && rangeEnd && selectedApartmentId !== 'all' && (
        <div className="p-4 rounded-2xl bg-brand-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-brand-300 shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Selected Date Range:</span>{' '}
              <span>
                {formatDisplayDate(rangeStart)} → {formatDisplayDate(rangeEnd)}{' '}
                ({calculateNights(rangeStart, rangeEnd)}{' '}
                {calculateNights(rangeStart, rangeEnd) === 1
                  ? 'night'
                  : 'nights'}{' '}
                on <strong>{getApartmentName(selectedApartmentId)}</strong>)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBlockDialogOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-brand-950 hover:bg-sand-100 text-xs font-bold transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Block Selected Dates</span>
            </button>

            <button
              type="button"
              onClick={handleMarkSelectedRangeAvailable}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Set Range Available</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRangeStart('');
                setRangeEnd('');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs text-brand-200 hover:text-white"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* Action / Validation Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-start justify-between gap-3 ${
            actionFeedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {actionFeedback.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-stone-400 hover:text-stone-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Calendar Canvas */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs space-y-5">
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}

        {/* Legend & Operational Policy Note */}
        <div className="pt-4 border-t border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-700">
            <span className="font-bold uppercase tracking-wider text-stone-400 text-[11px]">
              Legend:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md border border-stone-300 bg-white inline-flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </span>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-amber-400 inline-block" />
              <span>Pending Reservation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-emerald-600 inline-block" />
              <span>Confirmed Reservation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-stone-600 inline-block" />
              <span>Blocked / Unavailable</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-brand-100 border-2 border-brand-800 inline-block" />
              <span>Selected Date Range</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <Info className="w-4 h-4 text-brand-700 shrink-0" />
            <span>
              Confirmed reservations are protected and cannot be overwritten by
              maintenance blocks.
            </span>
          </div>
        </div>
      </div>

      {/* Inspector Panel when a Reservation or Block is clicked on the Calendar */}
      {(inspectedBooking || inspectedBlock) && (
        <div className="bg-white rounded-2xl border-2 border-brand-700 p-6 shadow-lg space-y-4">
          <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-3.5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                {inspectedBooking
                  ? 'Selected Calendar Reservation'
                  : 'Selected Administrative Date Block'}
              </span>
              <h2 className="text-lg font-bold text-stone-900 mt-0.5">
                {inspectedBooking
                  ? `${inspectedBooking.guestName} — ${inspectedBooking.reference}`
                  : `Maintenance / Owner Block — ${getApartmentName(
                      inspectedBlock?.apartmentId || ''
                    )}`}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setInspectedBooking(null);
                setInspectedBlock(null);
              }}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {inspectedBooking && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase text-stone-400">
                  Guest & Contact
                </p>
                <p className="font-bold text-stone-900">
                  {inspectedBooking.guestName}
                </p>
                <p className="text-xs text-stone-600 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-brand-700" />
                  {inspectedBooking.guestEmail}
                </p>
                <p className="text-xs text-stone-600 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-brand-700" />
                  {inspectedBooking.guestPhone}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase text-stone-400">
                  Stay Details
                </p>
                <p className="font-semibold text-stone-900">
                  {getApartmentName(inspectedBooking.apartmentId)}
                </p>
                <p className="text-xs text-stone-700">
                  {formatDisplayDate(inspectedBooking.checkIn)} →{' '}
                  {formatDisplayDate(inspectedBooking.checkOut)} (
                  {calculateNights(
                    inspectedBooking.checkIn,
                    inspectedBooking.checkOut
                  )}{' '}
                  nights)
                </p>
                <p className="text-xs text-stone-600 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {inspectedBooking.guestCount} Guests •{' '}
                  <strong>{formatNaira(inspectedBooking.totalAmount)}</strong>
                </p>
              </div>

              <div className="flex flex-col justify-between items-start md:items-end gap-3">
                <BookingStatusBadge status={inspectedBooking.status} />

                <div className="flex flex-wrap items-center gap-2">
                  {inspectedBooking.status === 'Pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          updateBookingStatus(inspectedBooking.id, 'Confirmed')
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateBookingStatus(inspectedBooking.id, 'Rejected')
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </>
                  )}

                  {inspectedBooking.status === 'Confirmed' && (
                    <button
                      type="button"
                      onClick={() => setConfirmCancelBooking(inspectedBooking)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Cancel Reservation
                    </button>
                  )}

                  <Link
                    href={`/admin/bookings/${inspectedBooking.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-xs font-semibold"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Full Booking Page
                  </Link>
                </div>
              </div>
            </div>
          )}

          {inspectedBlock && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-stone-700">
                  <strong>Blocked Dates:</strong>{' '}
                  {formatDisplayDate(inspectedBlock.startDate)} →{' '}
                  {formatDisplayDate(inspectedBlock.endDate)} (
                  {calculateNights(
                    inspectedBlock.startDate,
                    inspectedBlock.endDate
                  )}{' '}
                  nights)
                </p>
                <p className="text-stone-600 text-xs">
                  <strong>Reason:</strong> {inspectedBlock.reason}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  removeAvailabilityBlock(inspectedBlock.id);
                  setInspectedBlock(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold self-start sm:self-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Block & Make Available
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active Administrative Blocks Table */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Active Administrative Date Blocks ({filteredBlocks.length})
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Dates blocked for maintenance, deep cleaning, or owner use.
              Removing a block immediately re-opens those dates on the public
              website.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBlockDialogOpen(true)}
            className="text-xs font-semibold text-brand-800 hover:underline"
          >
            + Add Date Block
          </button>
        </div>

        {filteredBlocks.length === 0 ? (
          <p className="text-xs text-stone-500 py-4">
            No administrative date blocks currently set for this filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  <th className="py-2.5 px-3">Apartment</th>
                  <th className="py-2.5 px-3">Start Date (Inclusive)</th>
                  <th className="py-2.5 px-3">End Date (Exclusive)</th>
                  <th className="py-2.5 px-3">Nights</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredBlocks.map((blk) => (
                  <tr key={blk.id} className="hover:bg-stone-50/70">
                    <td className="py-3 px-3 font-semibold text-stone-900">
                      {getApartmentName(blk.apartmentId)}
                    </td>
                    <td className="py-3 px-3 text-stone-700">
                      {formatDisplayDate(blk.startDate)}
                    </td>
                    <td className="py-3 px-3 text-stone-700">
                      {formatDisplayDate(blk.endDate)}
                    </td>
                    <td className="py-3 px-3 text-xs text-stone-500">
                      {calculateNights(blk.startDate, blk.endDate)} nights
                    </td>
                    <td className="py-3 px-3 text-stone-700">{blk.reason}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeAvailabilityBlock(blk.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 hover:border-red-200 hover:bg-red-50 text-xs font-semibold text-stone-700 hover:text-red-700 transition-colors"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Remove Block</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Block Dates Dialog */}
      <AvailabilityBlockDialog
        isOpen={blockDialogOpen}
        apartments={apartments}
        initialApartmentId={selectedApartmentId}
        initialStartDate={rangeStart || anchorDateStr}
        initialEndDate={rangeEnd || addDays(rangeStart || anchorDateStr, 2)}
        onClose={() => setBlockDialogOpen(false)}
        onCreateBlock={(aptId, start, end, reason) => {
          const res = createAvailabilityBlock(aptId, start, end, reason);
          if (res.success) {
            setRangeStart('');
            setRangeEnd('');
            setActionFeedback({
              type: 'success',
              message: `Blocked ${formatDisplayDate(start)} – ${formatDisplayDate(
                end
              )} for ${getApartmentName(aptId)} (${reason}).`,
            });
          }
          return res;
        }}
      />

      {/* Cancel Confirmed Booking Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(confirmCancelBooking)}
        title={`Cancel Confirmed Reservation (${confirmCancelBooking?.reference})?`}
        description={`Cancelling ${confirmCancelBooking?.guestName}'s reservation will immediately release the dates (${formatDisplayDate(
          confirmCancelBooking?.checkIn || ''
        )} – ${formatDisplayDate(
          confirmCancelBooking?.checkOut || ''
        )}) on both the admin and public availability calendars.`}
        confirmLabel="Yes, Cancel Reservation"
        variant="danger"
        showNoteInput
        onConfirm={(note) => {
          if (confirmCancelBooking) {
            updateBookingStatus(confirmCancelBooking.id, 'Cancelled', note);
          }
          setConfirmCancelBooking(null);
        }}
        onCancel={() => setConfirmCancelBooking(null)}
      />
    </div>
  );
}

export default function AdminCalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20">
          <LoadingState label="Loading availability calendar..." />
        </div>
      }
    >
      <AdminCalendarContent />
    </Suspense>
  );
}
