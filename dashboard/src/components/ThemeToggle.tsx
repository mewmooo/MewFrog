'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'mewbot-theme';

/**
 * Tombol tema di header.
 *
 * Keadaan awal dibaca dari <html> di dalam useEffect, bukan saat render, supaya
 * markup server dan klien tidak berbeda (skrip di <head> sudah memasang kelas
 * `dark` sebelum React hidrasi).
 */
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));

    // Tab lain yang menukar tema ikut menyegarkan tombol ini.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const dark = event.newValue === 'dark';
      document.documentElement.classList.toggle('dark', dark);
      setIsDark(dark);
      syncMetaThemeColor(dark);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // Mode privat bisa menolak localStorage; tema tetap berlaku untuk sesi ini.
    }
    syncMetaThemeColor(next);
    setIsDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      title={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      className="min-h-11 min-w-11 grid place-items-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)] transition-colors -mt-1 -mb-1"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function syncMetaThemeColor(isDark: boolean) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', isDark ? '#16140F' : '#fcfbf7');
  }
}
