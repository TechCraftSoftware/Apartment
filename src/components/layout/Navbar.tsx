'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Menu,
  X,
  ShieldCheck,
  RotateCcw,
  CalendarSearch,
  KeyRound,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { resetDemoData, realtorConfig } = useBookingContext();

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/apartments', label: 'Apartments' },
    { href: '/availability', label: 'Availability Calendar' },
    { href: '/my-booking', label: 'My Booking' },
  ];

  const brandShort =
    realtorConfig.businessName.split('&')[0]?.trim() || 'Verdant Stays';

  return (
    <header className="print:hidden sticky top-0 z-40 bg-sand-50/95 backdrop-blur-md border-b border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 group focus:outline-none"
        >
          <div className="w-10 h-10 rounded-xl bg-brand-800 text-white flex items-center justify-center shadow-xs group-hover:bg-brand-900 transition-colors">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-lg font-bold tracking-tight text-stone-900 leading-none">
              {brandShort}
            </span>
            <span className="block text-[11px] font-medium uppercase tracking-widest text-brand-700 mt-1">
              {realtorConfig.domain || 'Executive Residences'}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav
          className="hidden lg:flex items-center gap-6"
          aria-label="Main Navigation"
        >
          {navLinks.map((link) => {
            const isActive =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href) && !link.href.includes('#');

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-brand-800 font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-2.5">
          <button
            type="button"
            onClick={resetDemoData}
            title="Restore initial sample apartments, bookings, verification codes, and calendar blocks"
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo
          </button>

          <Link
            href="/my-booking"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-800 hover:border-brand-700 hover:text-brand-800 transition-colors shadow-2xs"
          >
            <KeyRound className="w-3.5 h-3.5 text-brand-700" />
            <span>My Booking</span>
          </Link>

          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-800 hover:border-brand-700 hover:text-brand-800 transition-colors shadow-2xs"
          >
            <ShieldCheck className="w-4 h-4 text-brand-700" />
            <span>Realtor Admin</span>
          </Link>

          <Link
            href="/availability"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-800 text-white text-sm font-medium hover:bg-brand-900 transition-colors shadow-xs"
          >
            <CalendarSearch className="w-4 h-4" />
            <span>Check Availability</span>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="lg:hidden p-2.5 rounded-xl text-stone-700 hover:bg-stone-200/60"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-stone-200 px-4 pt-3 pb-6 space-y-3">
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl text-base font-medium text-stone-800 hover:bg-stone-100"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="pt-3 border-t border-stone-200 flex flex-col gap-2.5">
            <Link
              href="/availability"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-800 text-white text-sm font-medium"
            >
              <CalendarSearch className="w-4 h-4" />
              Check Availability Calendar
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/my-booking"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-800"
              >
                <KeyRound className="w-4 h-4 text-brand-700" />
                My Booking
              </Link>
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-800"
              >
                <ShieldCheck className="w-4 h-4 text-brand-700" />
                Realtor Admin
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
