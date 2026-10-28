'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  CalendarRange,
  ClipboardList,
  PlusCircle,
  ExternalLink,
  RotateCcw,
  LogOut,
  X,
  CreditCard,
  Sliders,
  KeyRound,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';

interface AdminSidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AdminSidebar({ mobileOpen, onCloseMobile }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    bookings,
    payments,
    realtorConfig,
    logoutAdmin,
    resetDemoData,
    currentAdmin,
    canResetDemo,
  } = useBookingContext();

  const pendingBookingCount = bookings.filter(
    (b) => b.status === 'Pending' || b.status === 'PendingApproval'
  ).length;
  // Transfer receipts waiting for the admin to check them.
  const pendingPaymentCount = payments.filter(
    (p) => p.receiptVerificationStatus === 'PendingReview'
  ).length;

  const navItems = [
    {
      href: '/admin',
      label: 'Dashboard Overview',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: '/admin/apartments',
      label: 'Properties & Units',
      icon: Building2,
      exact: false,
    },
    {
      href: '/admin/calendar',
      label: 'Availability Calendar',
      icon: CalendarRange,
      exact: false,
    },
    {
      href: '/admin/bookings',
      label: 'Bookings & Requests',
      icon: ClipboardList,
      exact: false,
      badge: pendingBookingCount > 0 ? pendingBookingCount : undefined,
    },
    {
      href: '/admin/payments',
      label: 'Payments',
      icon: CreditCard,
      exact: false,
      badge: pendingPaymentCount > 0 ? pendingPaymentCount : undefined,
    },
    {
      href: '/admin/settings',
      label: 'Realtor & Policy Settings',
      icon: Sliders,
      exact: false,
    },
  ];

  const handleLogout = async () => {
    await logoutAdmin();
    router.push('/admin/login');
  };

  const brandShort =
    realtorConfig.businessName.split('&')[0]?.trim() || 'Ajani Apartment';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-brand-950 text-stone-200 w-64 shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-20 px-6 flex items-center justify-between border-b border-brand-900">
        <Link
          href="/admin"
          onClick={onCloseMobile}
          className="flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-brand-700 text-white flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-base font-bold text-white leading-none truncate max-w-[140px]">
              {brandShort}
            </span>
            <span className="block text-[10px] uppercase tracking-widest text-brand-300 mt-1">
              Realtor Admin
            </span>
          </div>
        </Link>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-stone-400 hover:text-white"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-6 space-y-6 overflow-y-auto">
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2">
            Realtor Operations
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-800 text-white shadow-xs'
                    : 'text-stone-300 hover:bg-brand-900 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-400 text-stone-950">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="space-y-1.5 pt-2 border-t border-brand-900">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2 pt-2">
            Quick Shortcuts
          </p>
          <Link
            href="/admin/apartments/new"
            onClick={onCloseMobile}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-brand-200 hover:bg-brand-900 hover:text-white transition-colors"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Add New Apartment</span>
          </Link>
          <Link
            href="/my-booking"
            onClick={onCloseMobile}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-stone-300 hover:bg-brand-900 hover:text-white transition-colors"
          >
            <KeyRound className="w-4 h-4 shrink-0" />
            <span>Customer Code Portal</span>
          </Link>
          <Link
            href="/"
            onClick={onCloseMobile}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-stone-300 hover:bg-brand-900 hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span>View Public Website</span>
          </Link>
        </div>
      </div>

      {/* Footer / Session Controls */}
      <div className="p-4 border-t border-brand-900 space-y-2 bg-brand-950">
        {canResetDemo && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Reset ALL data to the sample demo? Every booking, payment and setting will be replaced.'
                )
              ) {
                resetDemoData();
              }
              onCloseMobile();
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-stone-300 hover:bg-brand-900 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Reset Sample Demo Data</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-rose-300 hover:bg-rose-950/60 hover:text-rose-200 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span>Sign Out{currentAdmin ? ` (${currentAdmin.email})` : ''}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block shrink-0">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 flex">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
