'use client';

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import FrogIcon from './FrogIcon';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Registrasi Service Worker jika didukung browser
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('[PWA] Service Worker terdaftar dengan scope:', registration.scope);
          },
          (err) => {
            console.log('[PWA] Registrasi Service Worker gagal:', err);
          }
        );
      });
    }

    // 2. Cek apakah sudah running dalam mode standalone (PWA terinstall)
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
        || (window.navigator as any).standalone === true;
      if (isStandalone) {
        setIsInstalled(true);
        return;
      }

      // Cek apakah user pernah menutup prompt instalasi hari ini
      const dismissedUntil = localStorage.getItem('mewbot_pwa_dismissed');
      if (dismissedUntil && parseInt(dismissedUntil, 10) > Date.now()) {
        return;
      }

      // 3. Tangkap event install prompt native (Android / Desktop Chrome / Edge)
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setShowPrompt(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } catch (e) {
      console.error('[PWA] Gagal memicu install prompt:', e);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Sembunyikan selama 3 hari agar tidak mengganggu UX
    localStorage.setItem('mewbot_pwa_dismissed', (Date.now() + 3 * 24 * 60 * 60 * 1000).toString());
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <aside aria-label="Instal Aplikasi" className="fixed bottom-20 md:bottom-6 right-4 z-50 max-w-sm w-[calc(100%-2rem)] bg-white/95 backdrop-blur-md border border-[#cbdbca] rounded-2xl p-3.5 shadow-xl animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#eef4ea] border border-[#b8cfb7] p-1.5 flex items-center justify-center shrink-0">
          <FrogIcon className="w-full h-full" alt="MewBot Frog" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-[#273826] leading-tight">Pasang MewBot di HP</h4>
          <p className="text-[11px] text-[#5e6b5f] truncate">Akses instan layaknya aplikasi native tanpa URL bar</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          title="Tutup banner"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="flex-1 py-1.5 px-3 rounded-xl bg-[#466743] hover:bg-[#385435] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Pasang Sekarang</span>
        </button>
        <button
          onClick={handleDismiss}
          className="py-1.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors"
        >
          Nanti Saja
        </button>
      </div>
    </aside>
  );
}

