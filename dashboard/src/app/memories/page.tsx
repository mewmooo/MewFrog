'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Heart, Search, Calendar, Sparkles, RefreshCw, User, Loader2 } from 'lucide-react';

interface MemoryItem {
  id: string;
  body: string;
  created_at: string;
  received_at?: string;
  status: string;
  sender_name?: string;
}

export default function MemoriesPage() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchMemories = useCallback(async () => {
    try {
      setErrorMsg(null);
      const q = encodeURIComponent(search.trim());
      const res = await fetch(`/api/dashboard/memories?q=${q}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMemories(data.memories || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      console.error('[Fetch Memories Error]:', e);
      setErrorMsg(e.message || 'Gagal memuat memori');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMemories();
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-[#eae4d5] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[#1e241f] flex items-center gap-2">
            <Heart className="w-5 h-5 text-amber-600 fill-amber-600/20" />
            <span>Message Memories</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Retensi 90 Hari
            </span>
            {total > 0 && (
              <span className="text-xs font-medium text-[#5e6b5f]">
                ({total} surat)
              </span>
            )}
          </h1>
          <p className="text-xs text-[#5e6b5f] mt-0.5">
            Arsip surat-surat manis yang telah sukses diterima dan dibaca oleh MewBot di meja kerja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#5e6b5f]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kata di kenangan..."
              className="text-xs pl-8 pr-3 py-1.5 rounded-xl border border-[#eae4d5] bg-[#fcfbf7] focus:outline-none focus:border-[#466743]"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Muat ulang memori"
            className="p-1.5 rounded-xl bg-[#f6f3eb] border border-[#eae4d5] text-[#5e6b5f] hover:text-[#1e241f] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <span>Terjadi kendala memuat data: {errorMsg}</span>
          <button onClick={handleRefresh} className="underline font-semibold hover:text-red-900 ml-2">
            Coba lagi
          </button>
        </div>
      )}

      {/* Grid of Memories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full bg-white p-12 rounded-2xl border border-[#eae4d5] text-center space-y-3">
            <Loader2 className="w-6 h-6 text-[#5a8257] animate-spin mx-auto" />
            <p className="text-xs text-[#5e6b5f]">Memuat kenangan manis...</p>
          </div>
        ) : memories.length > 0 ? (
          memories.map((m) => (
            <div
              key={m.id}
              className="bg-white p-5 rounded-2xl border border-[#eae4d5] shadow-xs flex flex-col justify-between hover:border-[#cbdbca] transition-all group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#5e6b5f]">
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Calendar className="w-3 h-3 text-[#5a8257]" />
                    {new Date(m.received_at || m.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-rose-500 group-hover:scale-110 transition-transform">
                    <Heart className="w-3.5 h-3.5 fill-rose-500" />
                  </span>
                </div>
                <p className="text-sm font-medium text-[#1e241f] leading-relaxed">&ldquo;{m.body}&rdquo;</p>
              </div>

              <div className="pt-3 border-t border-[#f6f3eb] flex items-center justify-between text-[10px] text-[#5e6b5f] mt-3">
                <span className="flex items-center gap-1 text-[#466743] font-medium">
                  <User className="w-2.5 h-2.5" />
                  <span>{m.sender_name || 'Companion'}</span>
                </span>
                <span className="font-mono text-[#8b998c]">
                  {new Date(m.received_at || m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white p-8 rounded-2xl border border-[#eae4d5] text-center text-xs text-[#5e6b5f] space-y-2">
            <Sparkles className="w-8 h-8 text-[#5a8257] mx-auto opacity-40" />
            <p className="font-medium text-[#1e241f]">Belum ada kenangan tersimpan di arsip.</p>
            <p className="text-[11px] text-[#8b998c]">
              Surat Love Mail yang telah dikirim dan berhasil diterima oleh MewBot akan otomatis tersimpan di sini selama 90 hari.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
