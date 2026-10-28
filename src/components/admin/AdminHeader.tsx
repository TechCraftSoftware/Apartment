'use client';

import React from 'react';
import Link from 'next/link';
import {
  Menu,
  ExternalLink,
  Bell,
  ShieldAlert,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';

interface AdminHeaderProps {
  onOpenMobileSidebar: () => void;
}

export function AdminHeader({ onOpenMobileSidebar }: AdminHeaderProps) {
  const { bookings } = useBookingContext();
  const pendingCount = bookings.filter((b) => b.status === 'Pending').length;

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-stone-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-stone-700 hover:bg-stone-100"
          aria-label="Open admin navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-stone-500 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200/80">
          <ShieldAlert className="w-3.5 h-3.5 text-brand-700 shrink-0" />
          <span>
            Prototype Simulation Mode • Changes sync immediately with Public Website via LocalStorage
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/admin/bookings?status=Pending"
          className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-medium text-stone-700 transition-colors"
        >
          <Bell className="w-4 h-4 text-brand-700" />
          <span>Pending Requests</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
              pendingCount > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-stone-200 text-stone-600'
            }`}
          >
            {pendingCount}
          </span>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-xs font-semibold transition-colors"
        >
          <span>Customer Site</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </header>
  );
}
