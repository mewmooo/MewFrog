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
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    exact: true,
    icon: Home,
    iconColor: 'text-[#5a8257]',
  },
  {
    label: 'Love Mail',
    href: '/love-mail',
    exact: false,
    icon: MessageSquareHeart,
    iconColor: 'text-rose-500',
  },
  {
    label: 'Memories',
    href: '/memories',
    exact: false,
    icon: Heart,
    iconColor: 'text-amber-600',
  },
  {
    label: 'Quick Notes',
    href: '/notes',
    exact: false,
    icon: Sparkles,
    iconColor: 'text-purple-600',
  },
  {
    label: 'Timeline',
    href: '/timeline',
    exact: false,
    icon: History,
    iconColor: 'text-blue-600',
  },
  {
    label: 'Settings',
    href: '/settings',
    exact: false,
    icon: Settings,
    iconColor: 'text-[#5e6b5f]',
  },
];

function checkIsActive(pathname: string | null, href: string, exact: boolean): boolean {
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
    <nav className="hidden md:flex items-center gap-1 bg-[#f6f3eb] p-1 rounded-xl border border-[#eae4d5]">
      {NAV_ITEMS.map((item) => {
        const isActive = checkIsActive(pathname, item.href, item.exact);
        const IconComp = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all select-none ${
              isActive
                ? 'bg-white text-[#1e241f] font-semibold shadow-xs border border-[#cbdbca]'
                : 'text-[#6b756a] hover:text-[#1e241f] hover:bg-white/50 font-normal border border-transparent'
            }`}
          >
            <IconComp className={`w-3.5 h-3.5 ${item.iconColor} shrink-0`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#ffffff]/95 backdrop-blur-md border-t border-[#eae4d5] px-3 py-2 flex justify-around items-center">
      {NAV_ITEMS.map((item) => {
        const isActive = checkIsActive(pathname, item.href, item.exact);
        const IconComp = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 text-[10px] transition-colors select-none ${
              isActive
                ? 'text-[#273826] font-bold'
                : 'text-[#7d8c7e] hover:text-[#1e241f] font-medium'
            }`}
          >
            <IconComp className={`w-4 h-4 ${isActive ? item.iconColor : 'text-[#8b998c]'}`} />
            <span>
              {item.label === 'Quick Notes' ? 'Notes' : item.label === 'Love Mail' ? 'Mail' : item.label}
            </span>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#466743] mt-0.5" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
