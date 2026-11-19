'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserNav from '@/components/UserNav';
import FrogIcon from '@/components/FrogIcon';
import ThemeToggle from '@/components/ThemeToggle';
import { DesktopNavigation, MobileNavigation } from '@/components/MainNavigation';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';

/**
 * Membungkus seluruh halaman dengan header, navigasi, dan banner PWA.
 *
 * Halaman /login sengaja dirender tanpa chrome: pengguna belum punya sesi,
 * sehingga setiap tautan navigasi hanya akan memantul kembali ke login.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login';

  if (isAuthPage) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--border-subtle)] px-4 lg:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-[var(--olive-subtle)] border border-[var(--border-chip)] flex items-center justify-center p-1 shadow-xs group-hover:scale-105 transition-transform overflow-hidden">
              <FrogIcon className="w-7 h-7" alt="MewBot Logo" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-[var(--olive-deep)]">MewBot</span>
                <span className="text-[10px] font-semibold bg-[var(--olive-subtle)] text-[var(--olive-primary)] px-1.5 py-0.5 rounded-full border border-[var(--border-chip)]">
                  Companion
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">Private Dashboard • ESP32-C3</p>
            </div>
          </Link>

          <DesktopNavigation />

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[var(--text-muted)] hidden sm:inline">WIB (UTC+7)</span>
            <ThemeToggle />
            <UserNav />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
        {children}
      </main>

      <PwaInstallPrompt />
      <MobileNavigation />
    </>
  );
}
