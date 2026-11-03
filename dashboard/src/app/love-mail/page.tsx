'use client';

import React, { useEffect, useState } from 'react';
import { Heart, Send, Sparkles, CheckCircle2, Clock, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

export default function LoveMailPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewPage, setPreviewPage] = useState(0);

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/dashboard/messages');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setPendingCount(data.pending_count || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setSubmitting(true);
    setNotification(null);

    try {
      const res = await fetch('/api/dashboard/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: inputText.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setNotification({ type: 'error', text: data.error || 'Gagal mengirim Love Mail' });
      } else {
        setNotification({
          type: 'success',
          text: 'Love Mail berhasil dimasukkan ke antrean! MewBot akan menerima surat saat polling berikutnya.',
        });
        setInputText('');
        fetchMessages();
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Gagal terhubung ke server' });
    } finally {
      setSubmitting(false);
    }
  };

  // Word-wrap preview simulator for 128x64 OLED (18 chars per line, splitting unbroken words cleanly)
  const wrapTextToOledLines = (text: string, maxLen = 18): string[] => {
    const raw = (text || '').trim();
    if (!raw) {
      return ['Tulis pesan manismu', 'untuk MewBot di', 'sini...'];
    }

    const paragraphs = raw.split(/\r?\n/);
    const lines: string[] = [];

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      const words = trimmedPara.split(/\s+/);
      let cur = '';

      for (let w of words) {
        if (!w) continue;
        const candidate = cur ? `${cur} ${w}` : w;
        if (candidate.length <= maxLen) {
          cur = candidate;
        } else {
          if (cur) {
            lines.push(cur);
            cur = '';
          }
          while (w.length > maxLen) {
            lines.push(w.slice(0, maxLen));
            w = w.slice(maxLen);
          }
          cur = w;
        }
      }
      if (cur) {
        lines.push(cur);
      }
    }

    return lines.length > 0 ? lines : ['Tulis pesan manismu', 'untuk MewBot di', 'sini...'];
  };

  const previewLines = wrapTextToOledLines(inputText, 18);
  const totalPages = previewLines.length <= 4 ? 1 : 2;
  const activePage = Math.min(previewPage, totalPages - 1);
  const displayedLines = previewLines.slice(activePage * 4, (activePage + 1) * 4);

  return (
    <div className="space-y-6">
      {/* Title Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-[#eae4d5] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[#1e241f] flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20" />
            <span>Love Mail Studio</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
              FIFO Queue
            </span>
          </h1>
          <p className="text-xs text-[#5e6b5f] mt-0.5">
            Kirim surat cinta singkat ke MewBot. Karakter kodok akan malu-malu dan menampilkan pesan selama 15 detik.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f6f3eb] border border-[#eae4d5] text-xs">
            <Clock className="w-3.5 h-3.5 text-[#5e6b5f]" />
            <span>Kapasitas Antrean:</span>
            <strong className={`${pendingCount >= 10 ? 'text-rose-600' : 'text-[#466743]'}`}>
              {pendingCount} / 10 Pending
            </strong>
          </div>
          <button
            onClick={fetchMessages}
            className="p-2 rounded-xl bg-[#f6f3eb] border border-[#eae4d5] text-[#5e6b5f] hover:text-[#1e241f]"
            title="Refresh antrean"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Editor (Left) & OLED Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor Form */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#eae4d5] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-[#1e241f] flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              <span>Tulis Surat Cinta</span>
            </h2>
            <span
              className={`text-xs font-mono font-semibold ${
                inputText.length > 80 ? 'text-rose-600' : 'text-[#5e6b5f]'
              }`}
            >
              {inputText.length} / 80 karakter
            </span>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-1">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                maxLength={80}
                rows={4}
                placeholder="Contoh: Semangat kerjanya sayang! Jangan lupa makan siang ya."
                className="w-full text-sm p-4 rounded-xl border border-[#eae4d5] focus:outline-none focus:border-[#466743] focus:ring-2 focus:ring-[#466743]/15 resize-none bg-[#fcfbf7] leading-relaxed"
              />
              <p className="text-[11px] text-[#5e6b5f]">
                Teks akan dibungkus (*word-wrap*) secara cerdas di layar OLED 128×64 piksel MewBot.
              </p>
            </div>

            {notification && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  notification.type === 'success'
                    ? 'bg-[#eef4ea] border-[#cbdbca] text-[#273826]'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {notification.type === 'success' ? (
                  <Sparkles className="w-4 h-4 text-[#466743] shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{notification.text}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setInputText('Semangat ya hari ini! Aku selalu ada untukmu.')}
                className="text-xs text-[#466743] hover:underline text-left sm:text-center"
              >
                + Pakai Contoh Manis
              </button>

              <button
                type="submit"
                disabled={submitting || !inputText.trim() || inputText.length > 80 || pendingCount >= 10}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#466743] text-white text-xs font-semibold hover:bg-[#385336] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Mengirim...' : 'Kirim ke MewBot'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live OLED Preview (128x64 Simulation) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-[#eae4d5] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#5e6b5f]">
                Simulasi Layar OLED 128×64
              </h3>
              <span className="text-[10px] font-mono text-[#466743] bg-[#eef4ea] px-2 py-0.5 rounded-full border border-[#cbdbca]">
                Monochrome SH1106
              </span>
            </div>

            {/* OLED Virtual Display Screen */}
            <div className="oled-screen-preview p-3 aspect-[2/1] rounded-xl flex flex-col justify-between select-none overflow-hidden max-w-full">
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-emerald-900/60 pb-1 text-[9px] font-bold">
                <span className="flex items-center gap-1">
                  <span>LOVE MAIL</span>
                  {totalPages > 1 && (
                    <span className="text-emerald-400 font-mono">[{activePage + 1}/{totalPages}]</span>
                  )}
                </span>
                {totalPages > 1 ? (
                  <button
                    type="button"
                    onClick={() => setPreviewPage((p) => (p === 0 ? 1 : 0))}
                    className="text-emerald-400 hover:text-emerald-200 underline font-mono cursor-pointer transition-colors"
                    title="Klik untuk melihat halaman berikutnya"
                  >
                    Hal {activePage + 1}/{totalPages} ↻
                  </button>
                ) : (
                  <span className="text-emerald-400 font-mono">15s</span>
                )}
              </div>

              {/* Message Body with Pixel Font Simulation */}
              <div className="my-auto space-y-0.5 text-[10px] leading-tight text-emerald-300 font-mono tracking-tight break-all overflow-hidden min-h-[48px] flex flex-col justify-center">
                {displayedLines.map((line, idx) => (
                  <p key={idx} className="truncate tracking-wider">{line}</p>
                ))}
              </div>

              {/* Bottom 15s Countdown Bar Simulator */}
              <div className="w-full bg-emerald-950/80 h-1 rounded-full overflow-hidden border border-emerald-800/40">
                <div className="bg-emerald-400 h-full w-4/5 animate-pulse" />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-[#5e6b5f] text-center mt-3">
            MewBot bereaksi malu (<em>shy face-cover</em>) saat surat tiba di meja!
          </p>
        </div>
      </div>

      {/* Sent Love Mail List */}
      <div className="bg-white p-6 rounded-2xl border border-[#eae4d5] shadow-xs space-y-4">
        <h2 className="font-bold text-sm text-[#1e241f] flex items-center justify-between">
          <span>Riwayat Love Mail Terkini</span>
          <span className="text-xs font-normal text-[#5e6b5f]">Pesan tersinkronisasi via Vercel HTTPS</span>
        </h2>

        <div className="space-y-2.5">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-2 text-[#5e6b5f]">
              <Loader2 className="w-5 h-5 text-rose-500 animate-spin" />
              <p className="text-xs">Memeriksa antrean surat...</p>
            </div>
          ) : messages.length > 0 ? (
            messages.map((m) => (
              <div
                key={m.id}
                className="p-3.5 rounded-xl bg-[#fcfbf7] border border-[#eae4d5] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div className="space-y-1">
                  <p className="text-xs md:text-sm font-medium text-[#1e241f]">&ldquo;{m.body}&rdquo;</p>
                  <p className="text-[10px] text-[#5e6b5f] font-mono">
                    Dibuat: {new Date(m.created_at).toLocaleString('id-ID')}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {m.status === 'queued' && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      <span>Menunggu Polling</span>
                    </span>
                  )}
                  {m.status === 'received' && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Diterima MewBot</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center space-y-1">
              <p className="text-xs font-medium text-[#1e241f]">
                Belum ada pesan di antrean aktif.
              </p>
              <p className="text-[11px] text-[#8b998c]">
                Ketik pesan cinta di atas dan klik &ldquo;Kirim ke MewBot&rdquo; untuk mengirim surat pertamamu!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

