'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Send, Clock, Wifi, Activity, Cpu, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import FrogIcon from '@/components/FrogIcon';

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
        setFeedback('Surat terkirim ke antrean! MewBot akan membacanya sesaat lagi.');
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
  const state = data?.device_state;

  return (
    <div className="space-y-6">
      {/* Top Welcome Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#eae4d5] shadow-xs">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#1e241f] flex items-center gap-2">
            <span>Halo! MewBot Companion</span>
            <Sparkles className="w-5 h-5 text-[#466743]" />
          </h1>
          <p className="text-xs md:text-sm text-[#5e6b5f] mt-0.5">
            Karakter kodok pixel-art cerdas di meja kerja Anda, terhubung ke dashboard privat.
          </p>
        </div>

        {/* Live Device Status Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f6f3eb] border border-[#eae4d5]">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            <span className="text-xs font-semibold text-[#1e241f]">
              {isOnline ? 'Online (Terhubung)' : isStale ? 'Offline (Stale Data)' : 'Offline'}
            </span>
            {data?.last_seen_relative != null && (
              <span className="text-[10px] font-mono text-[#5e6b5f]">
                • {data.last_seen_relative}d lalu
              </span>
            )}
          </div>
          <button
            onClick={fetchOverview}
            className="p-2 rounded-xl bg-[#f6f3eb] border border-[#eae4d5] text-[#5e6b5f] hover:text-[#1e241f] hover:bg-[#eae4d5] transition-colors"
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Companion Visual & Quick Mail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Companion Card */}
        <div className="lg:col-span-5 bg-gradient-to-b from-white to-[#fcfbf7] p-6 rounded-2xl border border-[#eae4d5] shadow-xs flex flex-col items-center justify-between text-center relative overflow-hidden">
          {/* Subtle Olive Glow */}
          <div className="absolute top-0 w-48 h-48 bg-[#eef4ea] rounded-full blur-3xl -z-10 pointer-events-none" />

          {/* Badge & Mode Tag */}
          <div className="w-full flex items-center justify-between text-xs">
            <span className="font-mono text-[11px] font-semibold text-[#466743] bg-[#eef4ea] px-2.5 py-1 rounded-full border border-[#cbdbca]">
              ESP32-C3 FW {dev?.firmware_version || 'v1.0.0'}
            </span>
            <span className="text-[11px] font-medium text-[#5e6b5f] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#5a8257]" />
              Mode: <strong className="text-[#1e241f]">{dev?.mode || 'PET'}</strong>
            </span>
          </div>

          {/* Animated Pixel Frog Character Illustration */}
          <div className="my-6 relative group">
            <div className="w-36 h-36 md:w-44 md:h-44 rounded-full bg-[#eef4ea]/80 border-2 border-[#cbdbca] flex items-center justify-center shadow-inner relative transition-transform duration-300 group-hover:scale-105 p-4">
              <img
                src="/mewbot-frog.png"
                alt="MewBot Egg Frog"
                className="w-28 h-28 md:w-36 md:h-36 object-contain drop-shadow-sm"
              />

              {/* Heart Pulse Particle */}
              <div className="absolute top-2 right-2 bg-rose-50 border border-rose-200 text-rose-500 rounded-full p-1.5 shadow-xs">
                <Heart className="w-4 h-4 fill-rose-500" />
              </div>
            </div>
            <p className="text-xs font-semibold text-[#273826] mt-3">MewBot Egg Frog</p>
            <p className="text-[11px] text-[#5e6b5f]">Living Desk Companion</p>
          </div>

          {/* Quick Controls: Mode Switcher Button */}
          <div className="w-full bg-[#f6f3eb] p-1.5 rounded-xl border border-[#eae4d5] flex items-center gap-1.5">
            <button
              onClick={() => handleToggleMode('PET')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                state?.desired_mode === 'PET' || (!state && dev?.mode === 'PET')
                  ? 'bg-white text-[#273826] shadow-xs'
                  : 'text-[#5e6b5f] hover:text-[#1e241f]'
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
                  ? 'bg-white text-[#273826] shadow-xs'
                  : 'text-[#5e6b5f] hover:text-[#1e241f]'
              }`}
            >
              <Clock className="w-3.5 h-3.5 inline-block text-[#5e6b5f]" />
              <span>Hybrid Clock</span>
            </button>
          </div>
        </div>

        {/* Right Column: Love Mail & Quick Actions */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Love Mail Sender */}
          <div className="bg-white p-6 rounded-2xl border border-[#eae4d5] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Heart className="w-4 h-4 fill-rose-600" />
                </div>
                <div>
                  <h2 className="font-bold text-sm md:text-base text-[#1e241f]">Kirim Love Mail Cepat</h2>
                  <p className="text-[11px] text-[#5e6b5f]">Pesan surat singkat langsung ke layar OLED MewBot (Maks 80 karakter)</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#f6f3eb] text-[#5e6b5f] border border-[#eae4d5]">
                Antrean: <strong className="text-[#1e241f]">{data?.pending_count || 0}/10</strong>
              </span>
            </div>

            <form onSubmit={handleSendQuick} className="space-y-3">
              <div className="relative">
                <textarea
                  value={quickMsg}
                  onChange={(e) => setQuickMsg(e.target.value)}
                  maxLength={80}
                  rows={2}
                  placeholder="Tulis pesan manis untuk MewBot & pasanganmu..."
                  className="w-full text-xs md:text-sm p-3 rounded-xl border border-[#eae4d5] focus:outline-none focus:border-[#466743] focus:ring-2 focus:ring-[#466743]/15 resize-none bg-[#fcfbf7]"
                />
                <span className="absolute bottom-2.5 right-3 text-[10px] font-mono text-[#5e6b5f]">
                  {quickMsg.length} / 80
                </span>
              </div>

              {feedback && (
                <div className="p-2.5 rounded-lg bg-[#eef4ea] border border-[#cbdbca] text-xs text-[#273826] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#466743] shrink-0" />
                  <span>{feedback}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <Link
                  href="/love-mail"
                  className="text-xs font-semibold text-[#466743] hover:underline flex items-center gap-1"
                >
                  <span>Buka Editor Lengkap &amp; Preview OLED</span>
                  <span>&rarr;</span>
                </Link>

                <button
                  type="submit"
                  disabled={sending || !quickMsg.trim() || (data?.pending_count || 0) >= 10}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#466743] text-white text-xs font-semibold hover:bg-[#385336] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sending ? 'Mengirim...' : 'Kirim Surat'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Device Telemetry & Diagnostics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-[#eae4d5] shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-[#5e6b5f] mb-1">
                <Wifi className="w-3.5 h-3.5 text-blue-500" />
                <span>Wi-Fi Signal</span>
              </div>
              <span className="font-mono text-xs md:text-sm font-bold text-[#1e241f]">
                {dev?.wifi_rssi != null ? `${dev.wifi_rssi} dBm` : '-'}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#eae4d5] shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-[#5e6b5f] mb-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Uptime</span>
              </div>
              <span className="font-mono text-xs md:text-sm font-bold text-[#1e241f]">
                {dev?.uptime_seconds ? `${Math.floor(dev.uptime_seconds / 60)}m` : '-'}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#eae4d5] shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-[#5e6b5f] mb-1">
                <Cpu className="w-3.5 h-3.5 text-purple-500" />
                <span>Free Heap</span>
              </div>
              <span className="font-mono text-xs md:text-sm font-bold text-[#1e241f]">
                {dev?.diagnostics?.free_heap ? `${Math.round(dev.diagnostics.free_heap / 1024)} KB` : '282 KB'}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#eae4d5] shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-[#5e6b5f] mb-1">
                <Activity className="w-3.5 h-3.5 text-rose-500" />
                <span>Hardware</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600">
                OLED + ADXL + Touch
              </span>
            </div>
          </div>

          {/* Recent Activity Timeline Preview */}
          <div className="bg-white p-5 rounded-2xl border border-[#eae4d5] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5e6b5f]">
                Aktivitas Terbaru MewBot
              </h3>
              <Link href="/timeline" className="text-xs text-[#466743] hover:underline">
                Lihat Semua
              </Link>
            </div>

            <div className="space-y-2">
              {data?.recent_activities && data.recent_activities.length > 0 ? (
                data.recent_activities.slice(0, 3).map((act: any) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcfbf7] border border-[#eae4d5] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-medium text-[#1e241f]">{act.event_type}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#5e6b5f]">
                      {new Date(act.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#5e6b5f] py-2">Belum ada catatan aktivitas baru.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

