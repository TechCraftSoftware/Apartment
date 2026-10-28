'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  CalendarCheck,
  ShieldCheck,
  Sparkles,
  Wifi,
  Zap,
  KeyRound,
  Building2,
  CheckCircle2,
  PhoneCall,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { BookingSearch } from '@/components/booking/BookingSearch';
import { ApartmentCard } from '@/components/apartments/ApartmentCard';
import { LoadingState } from '@/components/ui/LoadingState';

export default function HomePage() {
  const { apartments, isHydrated } = useBookingContext();

  const activeApartments = apartments.filter((a) => a.isActive);
  const featuredApartments = activeApartments
    .filter((a) => a.featured)
    .slice(0, 6);
  const displayedApartments =
    featuredApartments.length > 0
      ? featuredApartments
      : activeApartments.slice(0, 6);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-brand-950 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <Image
            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=80"
            alt="Ajani Apartment"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/85 to-brand-950/50" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 lg:pt-24 lg:pb-32">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-800/80 border border-brand-600/60 text-brand-100 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-brand-300" />
              <span>Victoria Island • Ikoyi • Lekki Phase 1 • Maitama</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.12] text-white">
              Architectural Short-Stay Residences, Curated for Effortless Living.
            </h1>

            <p className="text-base sm:text-lg text-stone-200 max-w-2xl leading-relaxed">
              Discover private serviced apartments with guaranteed 24/7 power,
              enterprise fiber Wi-Fi, and real-time calendar availability. Inspect
              open dates and submit your reservation request in seconds.
            </p>

            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs sm:text-sm text-stone-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Real-Time Availability Calendar</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Instant Date Hold on Request</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Transparent Nightly Pricing in ₦</span>
              </div>
            </div>
          </div>

          {/* Search Panel */}
          <div className="mt-10 max-w-5xl">
            <BookingSearch />
          </div>
        </div>
      </section>

      {/* Hospitality Highlights */}
      <section className="border-b border-stone-200/80 bg-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900">
                  Uninterrupted 24/7 Power
                </h2>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  Dual generators and automatic solar-inverter backup across every
                  residence.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center shrink-0">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900">
                  Dedicated Fiber Wi-Fi
                </h2>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  High-speed unlimited internet engineered for remote executives.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900">
                  Live Conflict-Free Calendar
                </h2>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  Pending and confirmed stays lock dates immediately to prevent
                  double bookings.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900">
                  Smart Self Check-In & Security
                </h2>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  24-hour uniformed estate security and keypad access codes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Apartments Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-700">
              Curated Portfolio
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mt-1">
              Featured Serviced Apartments
            </h2>
            <p className="text-sm text-stone-600 mt-2 max-w-xl">
              Explore our signature residences across Lagos and Abuja. Click any
              apartment to inspect its interactive monthly availability calendar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <Link
              href="/availability"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-sm font-semibold text-white transition-colors shadow-2xs"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Availability Calendar</span>
            </Link>
            <Link
              href="/apartments"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-stone-300 bg-white hover:border-brand-700 text-sm font-semibold text-stone-800 hover:text-brand-800 transition-colors"
            >
              <span>Browse All {activeApartments.length} Listings</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {!isHydrated ? (
          <LoadingState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {displayedApartments.map((apartment) => (
              <ApartmentCard key={apartment.id} apartment={apartment} />
            ))}
          </div>
        )}
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works"
        className="py-20 bg-sand-100 border-y border-stone-200/80"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-700">
              Transparent Reservation Workflow
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mt-1.5">
              How Booking with Ajani Apartment Works
            </h2>
            <p className="text-sm text-stone-600 mt-2.5">
              Our reservation process protects guests from overlapping requests while
              giving our hospitality team time to prepare your residence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Search & Filter by Stay Dates',
                description:
                  'Enter your desired check-in date, check-out date, and guest count to filter apartments available for your entire stay.',
              },
              {
                step: '02',
                title: 'Inspect Live Calendar & Pricing',
                description:
                  'View real-time availability on the apartment page. Booked, pending, and maintenance-blocked nights are clearly marked.',
              },
              {
                step: '03',
                title: 'Submit Booking Request',
                description:
                  'Complete your guest details. No online card payment is taken upfront—your request immediately places a Pending hold on your dates.',
              },
              {
                step: '04',
                title: 'Admin Confirmation & Check-In',
                description:
                  'Our Reservations Desk reviews and approves your request in the Admin Console, locking in your Confirmed reservation.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-800 text-white font-mono text-sm font-bold mb-4">
                    {item.step}
                  </span>
                  <h3 className="text-base font-bold text-stone-900">
                    {item.title}
                  </h3>
                  <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-brand-900 text-white p-8 sm:p-12 lg:p-16 shadow-xl relative overflow-hidden">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand-300">
                <Building2 className="w-4 h-4" />
                Ready for Your Next Stay or Product Walkthrough?
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold leading-tight">
                Experience Seamless Apartment Booking & Operations Management
              </h2>
              <p className="text-sm sm:text-base text-stone-300 max-w-2xl leading-relaxed">
                Browse available residences as a customer, submit a live reservation
                request, and switch to the Administrator Console to approve bookings
                or block maintenance dates on the shared calendar.
              </p>
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3">
              <Link
                href="/apartments"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-brand-950 hover:bg-sand-100 text-sm font-bold transition-colors shadow-sm"
              >
                <span>Explore Available Apartments</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/admin"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-brand-600 bg-brand-800/70 hover:bg-brand-800 text-white text-sm font-semibold transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-brand-300" />
                <span>Launch Admin Dashboard Demo</span>
              </Link>
              <a
                href="#contact"
                className="inline-flex items-center justify-center gap-2 text-xs text-brand-200 hover:text-white pt-1"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Questions? Speak with our Lagos Concierge Desk</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
