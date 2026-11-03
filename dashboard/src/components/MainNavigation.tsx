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

const NAV_ITEMS = [
  {
    label: 'Home',
    href: '/',
    exact: true,
    icon: Home,
    iconColor: 'text-[#466743]',
    activeBg: 'bg-[#eef4ea]',
  },
  {
    label: 'Love Mail',
    href: '/love-mail',
    exact: false,
    icon: MessageSquareHeart,
    iconColor: 'text-rose-500',
    activeBg: 'bg-rose-50',
  },
  {
    label: 'Memories',
    href: '/memories',
    exact: false,
    icon: Heart,
    iconColor: 'text-amber-500',
    activeBg: 'bg-amber-50',
  },
  {
    label: 'Quick Notes',
    href: '/notes',
    exact: false,
    icon: Sparkles,
    iconColor: 'text-purple-500',
    activeBg: 'bg-purple-50',
  },
  {
    label: 'Timeline',
    href: '/timeline',
    exact: false,
    icon: History,
    iconColor: 'text-blue-500',
    activeBg: 'bg-blue-50',
  },
  {
    label: 'Settings',
    href: '/settings',
    exact: false,
    icon: Settings,
    iconColor: 'text-[#5e6b5f]',
    activeBg: 'bg-slate-100',
  },
];

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-1 bg-[#f6f3eb] p-1 rounded-xl border border-[#eae4d5] shadow-2xs">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact 
          ? pathname === item.href 
          : pathname.startsWith(item.href);
        const IconComp = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all relative select-none ${
              isActive
                ? 'bg-white text-[#1e241f] font-bold shadow-xs border border-[#cbdbca]'
                : 'text-[#5e6b5f] hover:text-[#1e241f] hover:bg-white/60 font-medium'
            }`}
          >
            <IconComp className={`w-3.5 h-3.5 ${item.iconColor} ${isActive ? 'scale-110' : ''} transition-transform`} />
            <span>{item.label}</span>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#466743] shrink-0 animate-pulse ml-0.5" />
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#ffffff]/95 backdrop-blur-md border-t border-[#eae4d5] px-2 py-1.5 flex justify-around items-center shadow-lg">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact 
          ? pathname === item.href 
          : pathname.startsWith(item.href);
        const IconComp = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${
              isActive
                ? 'text-[#273826] font-bold'
                : 'text-[#7d8c7e] hover:text-[#1e241f]'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${isActive ? `${item.activeBg} border border-[#cbdbca]` : ''}`}>
              <IconComp className={`w-4 h-4 ${isActive ? item.iconColor : 'text-[#7d8c7e]'}`} />
            </div>
            <span className={`text-[9px] ${isActive ? 'font-bold text-[#1e241f]' : 'font-medium'}`}>
              {item.label === 'Quick Notes' ? 'Notes' : item.label === 'Love Mail' ? 'Mail' : item.label}
            </span>
            {isActive && (
              <span className="w-3 h-0.5 rounded-full bg-[#466743]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

