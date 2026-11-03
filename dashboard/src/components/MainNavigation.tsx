'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  MessageSquareHeart, 
  Heart, 
  Sparkles, 
  History, 
  Settings 
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  exact: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  activeColor: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    exact: true,
    icon: Home,
    iconColor: 'text-[#466743]',
    activeColor: 'text-[#2a4527]',
  },
  {
    label: 'Love Mail',
    href: '/love-mail',
    exact: false,
    icon: MessageSquareHeart,
    iconColor: 'text-rose-500',
    activeColor: 'text-rose-700',
  },
  {
    label: 'Memories',
    href: '/memories',
    exact: false,
    icon: Heart,
    iconColor: 'text-amber-500',
    activeColor: 'text-amber-700',
  },
  {
    label: 'Quick Notes',
    href: '/notes',
    exact: false,
    icon: Sparkles,
    iconColor: 'text-purple-500',
    activeColor: 'text-purple-700',
  },
  {
    label: 'Timeline',
    href: '/timeline',
    exact: false,
    icon: History,
    iconColor: 'text-blue-500',
    activeColor: 'text-blue-700',
  },
  {
    label: 'Settings',
    href: '/settings',
    exact: false,
    icon: Settings,
    iconColor: 'text-zinc-600',
    activeColor: 'text-zinc-900',
  },
];

function checkIsActive(pathname: string | null, href: string, exact: boolean): boolean {
  // Normalize safe path: default to '/' if null or empty
  const raw = (pathname && typeof pathname === 'string' && pathname.trim()) ? pathname.trim() : '/';
  const clean = raw.length > 1 && raw.endsWith('/') ? raw.slice(0, -1) : raw;

  if (exact) {
    return clean === href;
  }
  return clean.startsWith(href);
}

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav 
      aria-label="Menu Navigasi Utama" 
      className="hidden md:flex items-center gap-1.5 bg-[#ede9df] p-1.5 rounded-2xl border border-[#ded7c4] shadow-xs"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = checkIsActive(pathname, item.href, item.exact);
        const IconComp = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs transition-all duration-150 select-none ${
              isActive
                ? 'bg-white text-[#192b18] font-bold shadow-sm border border-[#c5d5c3] ring-2 ring-[#466743]/15'
                : 'text-[#5d6b5e] hover:text-[#1e241f] hover:bg-white/60 font-medium'
            }`}
          >
            {/* Active Green Indicator Dot */}
            {isActive && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#466743] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#466743]"></span>
              </span>
            )}

            <IconComp 
              className={`w-4 h-4 transition-transform ${isActive ? `${item.iconColor} scale-110 stroke-[2.25]` : item.iconColor}`} 
            />
            
            <span className={isActive ? item.activeColor : ''}>
              {item.label}
            </span>

            {/* Subtle bottom indicator line for active state */}
            {isActive && (
              <span 
                className="absolute -bottom-[2px] left-3 right-3 h-[2px] bg-[#466743] rounded-full" 
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav 
      aria-label="Navigasi Mobile" 
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#ffffff]/95 backdrop-blur-md border-t border-[#eae4d5] px-2 py-1.5 flex justify-around items-center shadow-lg"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = checkIsActive(pathname, item.href, item.exact);
        const IconComp = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${
              isActive
                ? 'bg-[#eef4ea] text-[#1b2b1a] font-bold shadow-2xs border border-[#cbdbca]'
                : 'text-[#6e7d6f] hover:text-[#1e241f]'
            }`}
          >
            <div className="relative">
              <IconComp 
                className={`w-4 h-4 ${isActive ? `${item.iconColor} stroke-[2.25]` : 'text-[#6e7d6f]'}`} 
              />
              {isActive && (
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#466743]" />
              )}
            </div>

            <span className={`text-[9px] ${isActive ? 'font-bold text-[#1b2b1a]' : 'font-medium'}`}>
              {item.label === 'Quick Notes' ? 'Notes' : item.label === 'Love Mail' ? 'Mail' : item.label}
            </span>

            {isActive && (
              <span className="w-4 h-0.5 rounded-full bg-[#466743]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
