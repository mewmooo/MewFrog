import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { Heart, Home, Clock, Sparkles, History, Settings, MessageSquareHeart } from 'lucide-react';
import UserNav from '@/components/UserNav';

export const metadata: Metadata = {
  title: 'MewBot • Connected Companion Dashboard',
  description: 'Private dashboard for MewBot Frog Pet, Love Mail, and device management',
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
              <div className="w-9 h-9 rounded-xl bg-[#eef4ea] border border-[#cbdbca] flex items-center justify-center text-xl shadow-xs group-hover:scale-105 transition-transform">
                🐸
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

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 bg-[#f6f3eb] p-1 rounded-xl border border-[#eae4d5]">
              <Link
                href="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#1e241f] hover:bg-[#ffffff] hover:shadow-xs transition-all"
              >
                <Home className="w-3.5 h-3.5 text-[#5a8257]" />
                <span>Home</span>
              </Link>
              <Link
                href="/love-mail"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#1e241f] hover:bg-[#ffffff] hover:shadow-xs transition-all"
              >
                <MessageSquareHeart className="w-3.5 h-3.5 text-rose-500" />
                <span>Love Mail</span>
              </Link>
              <Link
                href="/memories"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#1e241f] hover:bg-[#ffffff] hover:shadow-xs transition-all"
              >
                <Heart className="w-3.5 h-3.5 text-amber-600" />
                <span>Memories</span>
              </Link>
              <Link
                href="/notes"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#1e241f] hover:bg-[#ffffff] hover:shadow-xs transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Quick Notes</span>
              </Link>
              <Link
                href="/timeline"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#1e241f] hover:bg-[#ffffff] hover:shadow-xs transition-all"
              >
                <History className="w-3.5 h-3.5 text-blue-600" />
                <span>Timeline</span>
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#1e241f] hover:bg-[#ffffff] hover:shadow-xs transition-all"
              >
                <Settings className="w-3.5 h-3.5 text-[#5e6b5f]" />
                <span>Settings</span>
              </Link>
            </nav>

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

        {/* Mobile Bottom Navigation Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#ffffff]/95 backdrop-blur-md border-t border-[#eae4d5] px-3 py-2 flex justify-around">
          <Link href="/" className="flex flex-col items-center gap-0.5 text-[10px] text-[#5e6b5f] hover:text-[#466743]">
            <Home className="w-5 h-5" />
            <span>Home</span>
          </Link>
          <Link href="/love-mail" className="flex flex-col items-center gap-0.5 text-[10px] text-rose-600 font-medium">
            <MessageSquareHeart className="w-5 h-5" />
            <span>Mail</span>
          </Link>
          <Link href="/memories" className="flex flex-col items-center gap-0.5 text-[10px] text-[#5e6b5f] hover:text-[#466743]">
            <Heart className="w-5 h-5" />
            <span>Memories</span>
          </Link>
          <Link href="/notes" className="flex flex-col items-center gap-0.5 text-[10px] text-[#5e6b5f] hover:text-[#466743]">
            <Sparkles className="w-5 h-5" />
            <span>Notes</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center gap-0.5 text-[10px] text-[#5e6b5f] hover:text-[#466743]">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
        </nav>
      </body>
    </html>
  );
}

