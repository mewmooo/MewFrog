'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientBrowser } from '@/lib/supabase-browser';
import { LogIn, Lock, Mail, ShieldAlert, Sparkles } from 'lucide-react';
import FrogIcon from '@/components/FrogIcon';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const supabase = createClientBrowser();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        setErrorMsg(error.message || 'Email atau password salah');
      } else if (data.session) {
        // Ambil query param 'next' jika ada
        const params = new URLSearchParams(window.location.search);
        const nextUrl = params.get('next') || '/';
        router.push(nextUrl);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--login-canvas)] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-[var(--login-card-border)] p-8">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--legacy-olive-soft)] border border-[var(--legacy-olive-border)] flex items-center justify-center mb-3 p-2">
            <FrogIcon className="w-12 h-12" alt="MewBot Frog" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--gray-800)] tracking-tight flex items-center gap-2">
            MewBot Dashboard <Sparkles className="w-5 h-5 text-[var(--legacy-olive)]" />
          </h1>
          <p className="text-sm text-[var(--gray-500)] mt-1">
            Portal Dashboard MewBot
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--red-50)] border border-[var(--red-200)] text-[var(--red-700)] text-sm flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-[var(--red-500)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Login Gagal</p>
              <p className="text-xs text-[var(--red-600)] mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--gray-700)] uppercase tracking-wider mb-1.5">
              Email Pengguna
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--gray-400)]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@mewbot.internal"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--gray-300)] bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--legacy-olive)] focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--gray-700)] uppercase tracking-wider mb-1.5">
              Kata Sandi
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--gray-400)]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--gray-300)] bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--legacy-olive)] focus:border-transparent transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[var(--legacy-olive)] text-[var(--on-olive)] font-medium text-sm hover:bg-[var(--login-btn-hover)] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm mt-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-[var(--on-olive)] border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Masuk ke Dashboard
              </>
            )}
          </button>
        </form>

        {/* Security Notice (No Public Signup) */}
        <div className="mt-8 pt-6 border-t border-[var(--gray-100)] text-center">
          <p className="text-xs text-[var(--gray-500)] flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[var(--gray-400)]" />
            Portal ini bersifat privat khusus pemilik &amp; pasangan.
          </p>
          <p className="text-[11px] text-[var(--gray-400)] mt-1">
            Pendaftaran publik dinonaktifkan. Akun dibuat langsung oleh administrator.
          </p>
        </div>

      </div>
    </div>
  );
}

