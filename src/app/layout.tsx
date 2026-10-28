import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { BookingProvider } from '@/context/BookingContext';
import { ToastNotification } from '@/components/ui/ToastNotification';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ajani Apartment | Luxury Serviced Apartments & Availability Management',
  description:
    'Discover curated short-stay apartments in Lagos and Abuja, check real-time availability, and manage reservations.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${playfair.variable}`}>
      <body className="font-sans min-h-screen flex flex-col">
        <BookingProvider>
          {children}
          <ToastNotification />
        </BookingProvider>
      </body>
    </html>
  );
}
