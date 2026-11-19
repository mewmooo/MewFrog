'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Send, Clock, Wifi, Activity, Cpu, RefreshCw, Bell, BellOff, Trash2, Loader2, RotateCcw } from 'lucide-react';
import FrogIcon from '@/components/FrogIcon';
import { formatActivityEvent } from '@/lib/activity-helper';

export default function MewBotHomePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quickMsg, setQuickMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/dashboard/overview');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 5000); // 5s refresh
    return () => clearInterval(interval);
  }, []);

  const handleSendQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMsg.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/dashboard/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: quickMsg.trim() }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setFeedback(resData.error || 'Gagal mengirim pesan');
      } else {
        setFeedback('Pesan terkirim ke antrean! MewBot akan membacanya sesaat lagi.');
        setQuickMsg('');
        fetchOverview();
      }
    } catch (err: any) {
      setFeedback(err.message || 'Error koneksi');
    } finally {
      setSending(false);
    }
  };

  const handleToggleMode = async (newMode: 'PET' | 'CLOCK') => {
    try {
      const res = await fetch('/api/dashboard/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_mode', payload: { mode: newMode } }),
      });
      if (res.ok) {
        fetchOverview();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isOnline = data?.is_online;
  const isStale = data?.is_stale;
  const dev = data?.device;
  const state = data?.device_state || data?.state;

  const handleDeleteAlarm = async () => {
    try {
      const res = await fetch('/api/dashboard/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_alarm',
          payload: { enabled: false },
        }),
      });
      if (res.ok) {
        fetchOverview();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelCommand = async (commandId: string = 'all') => {
    if (!confirm('Batalkan seluruh perintah polling ini? MewBot tidak akan mengeksekusinya.')) return;
    try {
      const res = await fetch('/api/dashboard/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_command',
          payload: { command_id: commandId }
        }),
      });
      if (res.ok) {
        fetchOverview();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-xs">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--text-main)] flex items-center gap-2">
            <span>Halo! MewBot Companion</span>
            
          </h1>
          <p className="text-xs md:text-sm text-[var(--text-muted)] mt-0.5">
            Karakter kodok pixel-art cerdas di meja kerja Anda, terhubung ke dashboard privat.
          </p>
        </div>

        {/* Live Device Status Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                loading
                  ? 'bg-[var(--amber-400)] animate-ping'
                  : isOnline
                  ? 'bg-[var(--emerald-500)] animate-pulse'
                  : 'bg-[var(--gray-400)]'
              }`}
            />
            <span className="text-xs font-semibold text-[var(--text-main)]">
              {loading
                ? 'Menghubungkan...'
                : isOnline
                ? 'Online (Terhubung)'
                : isStale
                ? 'Offline (Stale Data)'
                : 'Offline'}
            </span>
            {!loading && data?.last_seen_relative != null && (
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                • {data.last_seen_relative}d lalu
              </span>
            )}
          </div>
          <button
            onClick={fetchOverview}
            className="p-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-subtle)] transition-colors"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Pending Polling Commands Alert */}
      {data?.pending_commands && data.pending_commands.length > 0 && (
        <div className="p-3.5 px-4 rounded-2xl bg-[var(--amber-50)] border border-[var(--amber-200)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[var(--amber-100)] text-[var(--amber-700)] flex items-center justify-center shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--amber-900)]">
                Antrean Perintah Polling ({data.pending_commands.length})
              </p>
              <p className="text-[11px] text-[var(--amber-700)] truncate">
                Menunggu bot online untuk eksekusi ({Array.from(new Set(data.pending_commands.map((c: any) => c.command_type))).join(', ')}).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleCancelCommand('all')}
            className="px-3.5 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--red-50)] text-[var(--red-700)] border border-[var(--amber-300)] hover:border-[var(--red-200)] text-xs font-semibold shrink-0 transition-colors shadow-2xs flex items-center justify-center gap-1.5"
            title="Batalkan seluruh perintah pending ini"
          >
            <Trash2 className="w-3.5 h-3.5 text-[var(--red-500)]" />
            <span>Batalkan Semua ({data.pending_commands.length})</span>
          </button>
        </div>
      )}

      {/* Main Grid: Companion Visual & Quick Mail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Companion Card */}
        <div className="lg:col-span-5 bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg-primary)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-xs flex flex-col items-center justify-between text-center relative overflow-hidden">
          {/* Subtle Olive Glow */}
          <div className="absolute top-0 w-48 h-48 bg-[var(--olive-subtle)] rounded-full blur-3xl -z-10 pointer-events-none" />

          {/* Badge & Mode Tag */}
          <div className="w-full flex items-center justify-between text-xs">
            <span className="font-mono text-[11px] font-semibold text-[var(--olive-primary)] bg-[var(--olive-subtle)] px-2.5 py-1 rounded-full border border-[var(--border-chip)]">
              ESP32-C3 FW {dev?.firmware_version || 'v1.0.0'}
            </span>
            <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[var(--olive-accent)]" />
              Mode: <strong className="text-[var(--text-main)]">{dev?.mode || 'PET'}</strong>
            </span>
          </div>

          {/* Animated Pixel Frog Character Illustration */}
          <div className="my-6 relative group">
            <div className="w-36 h-36 md:w-44 md:h-44 rounded-full bg-[var(--olive-chip-bg)] border-2 border-[var(--border-chip)] flex items-center justify-center shadow-inner relative transition-transform duration-300 group-hover:scale-105 p-4">
              <img
                src="/mewbot-frog.png"
                alt="MewBot Egg Frog"
                className="w-28 h-28 md:w-36 md:h-36 object-contain drop-shadow-sm"
              />

              {/* Penanda status pesan */}
              <div className="absolute top-2 right-2 bg-[var(--olive-subtle)] border border-[var(--border-chip)] text-[var(--olive-primary)] rounded-full p-1.5 shadow-xs">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs font-semibold text-[var(--olive-deep)] mt-3">MewBot Egg Frog</p>
            <p className="text-[11px] text-[var(--text-muted)]">Living Desk Companion</p>
          </div>

          {/* Quick Controls: Mode Switcher Button */}
          <div className="w-full bg-[var(--bg-surface-subtle)] p-1.5 rounded-xl border border-[var(--border-subtle)] flex items-center gap-1.5">
            <button
              onClick={() => handleToggleMode('PET')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                state?.desired_mode === 'PET' || (!state && dev?.mode === 'PET')
                  ? 'bg-[var(--bg-raised)] text-[var(--olive-deep)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <FrogIcon className="w-4 h-4 inline-block" /> Mode Pet / Eyes
              </span>
            </button>
            <button
              onClick={() => handleToggleMode('CLOCK')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                state?.desired_mode === 'CLOCK' || (!state && dev?.mode === 'CLOCK')
                  ? 'bg-[var(--bg-raised)] text-[var(--olive-deep)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Clock className="w-3.5 h-3.5 inline-block text-[var(--text-muted)]" />
              <span>Hybrid Clock</span>
            </button>
          </div>
        </div>

        {/* Kolom Kanan: Pesan & Aksi Cepat */}
        <div className="lg:col-span-7 space-y-6">
          {/* Pengirim Pesan Cepat */}
          <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--olive-subtle)] text-[var(--olive-primary)] flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-sm md:text-base text-[var(--text-main)]">Kirim Pesan Cepat</h2>
                  <p className="text-[11px] text-[var(--text-muted)]">Pesan singkat langsung ke layar OLED MewBot (maks 80 karakter)</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                Antrean: <strong className="text-[var(--text-main)]">{data?.pending_count || 0}/10</strong>
              </span>
            </div>

            <form onSubmit={handleSendQuick} className="space-y-3">
              <div className="relative">
                <textarea
                  value={quickMsg}
                  onChange={(e) => setQuickMsg(e.target.value)}
                  maxLength={80}
                  rows={2}
                  placeholder="Tulis pesan untuk MewBot..."
                  className="w-full text-xs md:text-sm p-3 rounded-xl border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--olive-primary)] focus:ring-2 focus:ring-[var(--focus-ring)] resize-none bg-[var(--bg-primary)]"
                />
                <span className="absolute bottom-2.5 right-3 text-[10px] font-mono text-[var(--text-muted)]">
                  {quickMsg.length} / 80
                </span>
              </div>

              {feedback && (
                <div className="p-2.5 rounded-lg bg-[var(--olive-subtle)] border border-[var(--border-chip)] text-xs text-[var(--olive-deep)] flex items-center gap-2">
                  
                  <span>{feedback}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <Link
                  href="/pesan"
                  className="text-xs font-semibold text-[var(--olive-primary)] hover:underline flex items-center gap-1"
                >
                  <span>Buka Editor Lengkap &amp; Preview OLED</span>
                  <span>&rarr;</span>
                </Link>

                <button
                  type="submit"
                  disabled={sending || !quickMsg.trim() || (data?.pending_count || 0) >= 10}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--olive-primary)] text-[var(--on-olive)] text-xs font-semibold hover:bg-[var(--olive-hover)] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sending ? 'Mengirim...' : 'Kirim Pesan'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Quick Alarm Status & Control Card */}
          <div className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border-subtle)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                loading
                  ? 'bg-[var(--amber-50)] text-[var(--amber-500)] border-[var(--amber-200)]'
                  : state?.alarm_enabled
                  ? 'bg-[var(--amber-50)] text-[var(--amber-600)] border-[var(--amber-200)]'
                  : 'bg-[var(--slate-50)] text-[var(--slate-400)] border-[var(--slate-200)]'
              }`}>
                {loading ? (
                  <Loader2 className="w-4 h-4 text-[var(--amber-600)] animate-spin" />
                ) : state?.alarm_enabled ? (
                  <Bell className="w-4 h-4 text-[var(--amber-600)]" />
                ) : (
                  <BellOff className="w-4 h-4 text-[var(--slate-400)]" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-main)]">
                    {loading
                      ? 'Memeriksa Jadwal Alarm...'
                      : state?.alarm_enabled
                      ? `Alarm Aktif: ${(state?.alarm_hour ?? 7).toString().padStart(2, '0')}:${(state?.alarm_minute ?? 0).toString().padStart(2, '0')} WIB`
                      : 'Alarm Tidak Aktif'}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    loading
                      ? 'bg-[var(--amber-50)] text-[var(--amber-700)] border-[var(--amber-200)]'
                      : state?.alarm_enabled
                      ? 'bg-[var(--emerald-50)] text-[var(--emerald-700)] border-[var(--emerald-200)]'
                      : 'bg-[var(--slate-50)] text-[var(--slate-600)] border-[var(--slate-200)]'
                  }`}>
                    {loading ? 'Sinkronisasi' : state?.alarm_enabled ? 'Aktif' : 'Mati'}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {loading
                    ? 'Menghubungkan ke konfigurasi memori hardware ESP32-C3...'
                    : state?.alarm_enabled
                    ? 'MewBot akan memutar melodi alarm pada jam yang ditentukan.'
                    : 'Belum ada alarm yang disetel. Klik Pengaturan untuk mengatur.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {!loading && state?.alarm_enabled && (
                <button
                  type="button"
                  onClick={handleDeleteAlarm}
                  className="px-3 py-1.5 rounded-xl bg-[var(--red-50)] border border-[var(--red-200)] text-[var(--red-700)] hover:bg-[var(--red-100)] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Batalkan atau hapus alarm ini jika tidak jadi memasang alarm"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[var(--red-500)]" />
                  <span>Hapus Alarm</span>
                </button>
              )}
              <Link
                href="/settings"
                className="px-3.5 py-1.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--border-subtle)] text-xs font-semibold transition-colors"
              >
                {state?.alarm_enabled ? 'Edit Jam' : 'Setel Alarm'}
              </Link>
            </div>
          </div>

          {/* Device Telemetry & Diagnostics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[var(--bg-surface)] p-3.5 rounded-xl border border-[var(--border-subtle)] shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-1">
                <Wifi className="w-3.5 h-3.5 text-[var(--blue-500)]" />
                <span>Wi-Fi Signal</span>
              </div>
              <span className="font-mono text-xs md:text-sm font-bold text-[var(--text-main)]">
                {dev?.wifi_rssi != null ? `${dev.wifi_rssi} dBm` : '-'}
              </span>
            </div>

            <div className="bg-[var(--bg-surface)] p-3.5 rounded-xl border border-[var(--border-subtle)] shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-1">
                <Clock className="w-3.5 h-3.5 text-[var(--emerald-600)]" />
                <span>Uptime</span>
              </div>
              <span className="font-mono text-xs md:text-sm font-bold text-[var(--text-main)]">
                {dev?.uptime_seconds ? `${Math.floor(dev.uptime_seconds / 60)}m` : '-'}
              </span>
            </div>

            <div className="bg-[var(--bg-surface)] p-3.5 rounded-xl border border-[var(--border-subtle)] shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-1">
                <Cpu className="w-3.5 h-3.5 text-[var(--purple-500)]" />
                <span>Free Heap</span>
              </div>
              <span className="font-mono text-xs md:text-sm font-bold text-[var(--text-main)]">
                {dev?.diagnostics?.free_heap ? `${Math.round(dev.diagnostics.free_heap / 1024)} KB` : '282 KB'}
              </span>
            </div>

            <div className="bg-[var(--bg-surface)] p-3.5 rounded-xl border border-[var(--border-subtle)] shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-1">
                <Activity className="w-3.5 h-3.5 text-[var(--red-500)]" />
                <span>Hardware</span>
              </div>
              <span className="text-[11px] font-semibold text-[var(--emerald-600)]">
                OLED + ADXL + Touch
              </span>
            </div>
          </div>

          {/* Recent Activity Timeline Preview */}
          <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Aktivitas Terbaru MewBot
              </h3>
              <Link href="/timeline" className="text-xs text-[var(--olive-primary)] hover:underline font-semibold">
                Lihat Semua &rarr;
              </Link>
            </div>

            <div className="space-y-2">
              {loading ? (
                <div className="py-8 flex flex-col items-center justify-center space-y-2 text-[var(--text-muted)]">
                  <Loader2 className="w-5 h-5 text-[var(--olive-primary)] animate-spin" />
                  <p className="text-xs">Memuat aktivitas terbaru MewBot...</p>
                </div>
              ) : data?.recent_activities && data.recent_activities.length > 0 ? (
                data.recent_activities.slice(0, 4).map((act: any) => {
                  const human = formatActivityEvent(act);
                  const IconComp = human.icon;

                  return (
                    <div
                      key={act.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${human.iconBg}`}>
                          <IconComp className={`w-3.5 h-3.5 ${human.iconColor}`} />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[var(--text-main)] truncate">{human.title}</span>
                            <span className={`text-[9px] font-medium px-1.5 py-0.2 rounded-full border ${human.badgeColor}`}>
                              {human.badge}
                            </span>
                          </div>
                          <span className="text-[11px] text-[var(--text-muted)] truncate block">{human.description}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-dim)] whitespace-nowrap shrink-0">
                        {new Date(act.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center space-y-1">
                  <p className="text-xs text-[var(--text-muted)]">Belum ada catatan aktivitas baru.</p>
                  <p className="text-[10px] text-[var(--text-dim)]">Event akan muncul otomatis saat MewBot menerima pesan atau bereaksi.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

