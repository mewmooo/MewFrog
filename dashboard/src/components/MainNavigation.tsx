'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  MessageSquare, 
  Inbox, 
  LayoutTemplate, 
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
    iconColor: 'text-[var(--olive-accent)]',
  },
  {
    label: 'Pesan',
    href: '/pesan',
    exact: false,
    icon: MessageSquare,
    iconColor: 'text-[var(--olive-primary)]',
  },
  {
    label: 'Riwayat',
    href: '/memories',
    exact: false,
    icon: Inbox,
    iconColor: 'text-[var(--amber-600)]',
  },
  {
    label: 'Template',
    href: '/notes',
    exact: false,
    icon: LayoutTemplate,
    iconColor: 'text-[var(--olive-accent)]',
  },
  {
    label: 'Timeline',
    href: '/timeline',
    exact: false,
    icon: History,
    iconColor: 'text-[var(--blue-600)]',
  },
  {
    label: 'Settings',
    href: '/settings',
    exact: false,
    icon: Settings,
    iconColor: 'text-[var(--text-muted)]',
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
    <nav className="hidden md:flex items-center gap-1 bg-[var(--bg-surface-subtle)] p-1 rounded-xl border border-[var(--border-subtle)]">
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
                ? 'bg-[var(--bg-raised)] text-[var(--text-main)] font-semibold shadow-xs border border-[var(--border-chip)]'
                : 'text-[var(--nav-idle)] hover:text-[var(--text-main)] hover:bg-[var(--nav-active-bg)] font-normal border border-transparent'
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--nav-bar-bg)] backdrop-blur-md border-t border-[var(--border-subtle)] px-3 py-2 flex justify-around items-center">
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
                ? 'text-[var(--olive-deep)] font-bold'
                : 'text-[var(--nav-idle-mobile)] hover:text-[var(--text-main)] font-medium'
            }`}
          >
            <IconComp className={`w-4 h-4 ${isActive ? item.iconColor : 'text-[var(--text-dim)]'}`} />
            <span>
              {item.label === 'Template' ? 'Template' : item.label}
            </span>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--olive-primary)] mt-0.5" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
