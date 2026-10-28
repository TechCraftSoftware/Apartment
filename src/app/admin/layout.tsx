'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useBookingContext } from '@/context/BookingContext';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { LoadingState } from '@/components/ui/LoadingState';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isHydrated, isAdminAuthenticated } = useBookingContext();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isHydrated && !isAdminAuthenticated && !isLoginPage) {
      router.replace(
        `/admin/login?redirect=${encodeURIComponent(pathname || '/admin')}`
      );
    }
  }, [isHydrated, isAdminAuthenticated, isLoginPage, pathname, router]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <LoadingState label="Initializing Operations Console..." />
      </div>
    );
  }

  if (isLoginPage) {
    return <div className="min-h-screen bg-stone-100">{children}</div>;
  }

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <LoadingState label="Redirecting to Administrator Login..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-stone-100/80 text-stone-900">
      <AdminSidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
