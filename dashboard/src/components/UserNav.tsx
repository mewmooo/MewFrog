'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientBrowser } from '@/lib/supabase-browser';
import { LogOut, User } from 'lucide-react';

export default function UserNav() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClientBrowser();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setUserEmail(data.user.email);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      } else {
        setUserEmail(null);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createClientBrowser();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (!userEmail) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--olive-subtle)] border border-[var(--border-chip)] text-[11px] font-medium text-[var(--olive-deep)]">
        <User className="w-3 h-3 text-[var(--olive-primary)]" />
        <span className="max-w-[130px] truncate">{userEmail}</span>
      </div>
      <button
        onClick={handleLogout}
        title="Logout dari Dashboard"
        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--red-600)] hover:bg-[var(--red-50)] border border-transparent hover:border-[var(--red-200)] transition-all text-xs flex items-center gap-1"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span className="hidden md:inline text-[11px]">Logout</span>
      </button>
    </div>
  );
}

