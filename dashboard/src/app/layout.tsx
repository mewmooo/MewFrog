import type { Metadata, Viewport } from 'next';
import './globals.css';
import Link from 'next/link';
import UserNav from '@/components/UserNav';
import FrogIcon from '@/components/FrogIcon';
import { DesktopNavigation, MobileNavigation } from '@/components/MainNavigation';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';

export const metadata: Metadata = {
  title: 'MewBot • Connected Companion Dashboard',
  description: 'Private dashboard for MewBot Frog Pet, Love Mail, and device management',
  applicationName: 'MewBot',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MewBot',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#fcfbf7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen flex flex-col bg-[#fcfbf7] text-[#1e241f]">
        {/* Top Header Navbar */}
        <header className="sticky top-0 z-50 bg-[#ffffff]/90 backdrop-blur-md border-b border-[#eae4d5] px-4 lg:px-8 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            {/* Logo & Companion Title */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-[#eef4ea] border border-[#cbdbca] flex items-center justify-center p-1 shadow-xs group-hover:scale-105 transition-transform overflow-hidden">
                <FrogIcon className="w-7 h-7" alt="MewBot Logo" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base tracking-tight text-[#273826]">MewBot</span>
                  <span className="text-[10px] font-semibold bg-[#eef4ea] text-[#466743] px-1.5 py-0.5 rounded-full border border-[#cbdbca]">
                    Companion
                  </span>
                </div>
                <p className="text-[11px] text-[#5e6b5f]">Private Dashboard • ESP32-C3</p>
              </div>
            </Link>

            {/* Desktop Navigation Links with Active Status Indicator */}
            <DesktopNavigation />

            {/* Quick Live Mode Indicator & User Nav */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-[#5e6b5f] hidden sm:inline">WIB (UTC+7)</span>
              <UserNav />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
          {children}
        </main>

        {/* PWA 1-Tap Home Screen Install Banner */}
        <PwaInstallPrompt />

        {/* Mobile Bottom Navigation Bar with Active Status Indicator */}
        <MobileNavigation />
      </body>
    </html>
  );
}
