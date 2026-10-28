'use client';

import React, { useState, useEffect } from 'react';
import { Lock, X, AlertCircle, Calendar } from 'lucide-react';
import { Apartment } from '@/types';
import { addDays, getTodayStr } from '@/lib/utils';

interface AvailabilityBlockDialogProps {
  isOpen: boolean;
  apartments: Apartment[];
  initialApartmentId?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  onClose: () => void;
  onCreateBlock: (
    apartmentId: string,
    startDate: string,
    endDate: string,
    reason: string
  ) => { success: boolean; error?: string };
}

const PRESET_REASONS = [
  'Scheduled HVAC & plumbing maintenance',
  'Deep cleaning & upholstery sanitization',
  'Owner personal stay',
  'Seasonal interior refresh & inspection',
];

export function AvailabilityBlockDialog({
  isOpen,
  apartments,
  initialApartmentId,
  initialStartDate,
  initialEndDate,
  onClose,
  onCreateBlock,
}: AvailabilityBlockDialogProps) {
  const today = getTodayStr();
  const [apartmentId, setApartmentId] = useState(
    initialApartmentId || apartments[0]?.id || ''
  );
  const [startDate, setStartDate] = useState(initialStartDate || today);
  const [endDate, setEndDate] = useState(
    initialEndDate || addDays(initialStartDate || today, 2)
  );
  const [reason, setReason] = useState(PRESET_REASONS[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialApartmentId && initialApartmentId !== 'all') {
        setApartmentId(initialApartmentId);
      } else if (!apartmentId && apartments[0]) {
        setApartmentId(apartments[0].id);
      }
      if (initialStartDate) {
        setStartDate(initialStartDate);
        setEndDate(
          initialEndDate && initialEndDate > initialStartDate
            ? initialEndDate
            : addDays(initialStartDate, 2)
        );
      }
    }
  }, [
    isOpen,
    initialApartmentId,
    initialStartDate,
    initialEndDate,
    apartments,
    apartmentId,
  ]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = onCreateBlock(apartmentId, startDate, endDate, reason);
    if (!result.success) {
      setError(result.error || 'Could not block the selected dates.');
      return;
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-dialog-title"
    >
      <div className="bg-white rounded-2xl border border-stone-200 max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="block-dialog-title"
                className="text-lg font-bold text-stone-900"
              >
                Block Apartment Dates
              </h3>
              <p className="text-xs text-stone-500">
                Mark dates unavailable for maintenance, deep cleaning, or owner use.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Select Apartment *
            </label>
            <select
              value={apartmentId}
              onChange={(e) => setApartmentId(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-medium text-stone-900 focus:border-brand-700 focus:outline-none"
            >
              {apartments.map((apt) => (
                <option key={apt.id} value={apt.id}>
                  {apt.name} ({apt.neighborhood})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                Start Date (Inclusive) *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-brand-700 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setStartDate(nextStart);
                    if (endDate <= nextStart) {
                      setEndDate(addDays(nextStart, 1));
                    }
                  }}
                  className="w-full rounded-xl border border-stone-300 pl-10 pr-3 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                End Date (Exclusive) *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-brand-700 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  min={startDate ? addDays(startDate, 1) : undefined}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 pl-10 pr-3 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Reason for Blocking *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason (e.g., HVAC maintenance, Owner stay)..."
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESET_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                    reason === preset
                      ? 'bg-brand-50 border-brand-600 text-brand-900 font-medium'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-sm font-semibold transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>Save Date Block</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
