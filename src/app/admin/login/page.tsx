'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  Lock,
  Mail,
  KeyRound,
  ArrowLeft,
  ShieldAlert,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { LoadingState } from '@/components/ui/LoadingState';

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdminAuthenticated, loginAdmin } = useBookingContext();

  const redirectPath = searchParams.get('redirect') || '/admin';

  const [email, setEmail] = useState('admin@staydemo.com');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdminAuthenticated) {
      router.replace(redirectPath);
    }
  }, [isAdminAuthenticated, redirectPath, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = loginAdmin(email, password);
    if (!res.success) {
      setError(res.error || 'Invalid credentials.');
      return;
    }

    router.push(redirectPath);
  };

  const handleFillDemo = () => {
    setEmail('admin@staydemo.com');
    setPassword('Admin123!');
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-brand-950 relative overflow-hidden">
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-brand-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Public Website</span>
          </Link>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-300">
            Staff Portal
          </span>
        </div>

        <div className="bg-white rounded-3xl border border-stone-200 p-7 sm:p-9 shadow-2xl space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-brand-800 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900">
                Verdant Stays Admin
              </h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Sign in to manage apartments, availability & bookings
              </p>
            </div>
          </div>

          {/* Demo Credentials Box */}
          <div className="p-4 rounded-2xl bg-sand-100 border border-stone-200/90 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-700" />
                Demo Administrator Credentials
              </span>
              <button
                type="button"
                onClick={handleFillDemo}
                className="text-[11px] font-semibold text-brand-800 hover:underline"
              >
                Fill Credentials
              </button>
            </div>
            <div className="text-xs text-stone-600 font-mono space-y-0.5">
              <div>
                Email: <strong className="text-stone-900">admin@staydemo.com</strong>
              </div>
              <div>
                Password: <strong className="text-stone-900">Admin123!</strong>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
              >
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 pl-10 pr-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 pl-10 pr-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Sign In to Admin Console</span>
            </button>
          </form>

          {/* Security Disclosure */}
          <div className="pt-4 border-t border-stone-100 flex items-start gap-2.5 text-[11px] text-stone-500 leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
            <span>
              <strong>Prototype Notice:</strong> This login screen uses a
              client-side simulated session stored in LocalStorage for
              demonstration purposes. Production deployments must enforce
              authentication and authorization on the server.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-brand-950">
          <LoadingState label="Loading login screen..." />
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
