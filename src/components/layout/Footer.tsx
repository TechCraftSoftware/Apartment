'use client';

import React from 'react';
import Link from 'next/link';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  Instagram,
  Linkedin,
  Globe,
  KeyRound,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';

export function Footer() {
  const { realtorConfig } = useBookingContext();

  return (
    <footer
      id="contact"
      className="bg-brand-950 text-stone-300 border-t border-brand-900"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1: Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-700 text-white flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-lg font-bold text-white leading-none">
                  {realtorConfig.businessName}
                </span>
                <span className="block text-[11px] uppercase tracking-widest text-brand-300 mt-1">
                  {realtorConfig.domain}
                </span>
              </div>
            </div>
            <p className="text-sm text-stone-400 leading-relaxed">
              {realtorConfig.tagline}
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a
                href="#contact"
                aria-label="Instagram"
                className="w-9 h-9 rounded-lg bg-brand-900 hover:bg-brand-800 flex items-center justify-center text-stone-300 hover:text-white transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#contact"
                aria-label="LinkedIn"
                className="w-9 h-9 rounded-lg bg-brand-900 hover:bg-brand-800 flex items-center justify-center text-stone-300 hover:text-white transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="#contact"
                aria-label="Website"
                className="w-9 h-9 rounded-lg bg-brand-900 hover:bg-brand-800 flex items-center justify-center text-stone-300 hover:text-white transition-colors"
              >
                <Globe className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
              Explore Residences
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/availability"
                  className="text-brand-300 hover:text-white font-medium transition-colors"
                >
                  Public Availability Calendar
                </Link>
              </li>
              <li>
                <Link
                  href="/my-booking"
                  className="text-brand-300 hover:text-white font-medium transition-colors inline-flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>My Booking (Code Access)</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/apartments"
                  className="text-stone-400 hover:text-white transition-colors"
                >
                  All Serviced Apartments
                </Link>
              </li>
              <li>
                <Link
                  href="/apartments/apt-1"
                  className="text-stone-400 hover:text-white transition-colors"
                >
                  The Aurelia Lagoon Penthouse (Ikoyi)
                </Link>
              </li>
              <li>
                <Link
                  href="/apartments/apt-2"
                  className="text-stone-400 hover:text-white transition-colors"
                >
                  Victoria Crest Oceanfront Loft (VI)
                </Link>
              </li>
              <li>
                <Link
                  href="/apartments/apt-3"
                  className="text-stone-400 hover:text-white transition-colors"
                >
                  Maitama Diplomatic Garden Suite (Abuja)
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Reservation Policies */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
              Booking & Stay Policy
            </h3>
            <ul className="space-y-2.5 text-sm text-stone-400">
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                <span>
                  Standard Check-in: {realtorConfig.defaultCheckInTime} • Check-out:{' '}
                  {realtorConfig.defaultCheckOutTime}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                <span>{realtorConfig.cancellationPolicySummary}</span>
              </li>
              <li className="pt-2">
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1.5 text-brand-300 hover:text-white text-xs font-semibold underline underline-offset-4"
                >
                  Open Realtor Administration Dashboard →
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact Concierge */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
              Concierge & Reservations Desk
            </h3>
            <ul className="space-y-3 text-sm text-stone-400">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-brand-400 shrink-0 mt-1" />
                <span>{realtorConfig.officeAddress}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-brand-400 shrink-0" />
                <span>{realtorConfig.contactPhone}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-brand-400 shrink-0" />
                <span>{realtorConfig.contactEmail}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-brand-900/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <p>
            © {new Date().getFullYear()} {realtorConfig.businessName}. All rights
            reserved.
          </p>
          <p className="text-stone-400">
            Single-Client Realtor Platform • Paystack Test Mode & Code-Based Booking Access
          </p>
        </div>
      </div>
    </footer>
  );
}
