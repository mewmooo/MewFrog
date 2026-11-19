'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Inbox, Search, Calendar, RefreshCw, User, Loader2 } from 'lucide-react';

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[var(--amber-600)]" />
            <span>Message Memories</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--amber-50)] text-[var(--amber-700)] border border-[var(--amber-200)]">
              Retensi 90 Hari
            </span>
            {total > 0 && (
              <span className="text-xs font-medium text-[var(--text-muted)]">
                ({total} pesan)
              </span>
            )}
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Arsip pesan yang telah diterima dan dibaca oleh MewBot di meja kerja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kata di riwayat..."
              className="text-xs pl-8 pr-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] focus:outline-none focus:border-[var(--olive-primary)]"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Muat ulang memori"
            className="p-1.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-[var(--red-50)] border border-[var(--red-200)] text-xs text-[var(--red-700)] flex items-center justify-between">
          <span>Terjadi kendala memuat data: {errorMsg}</span>
          <button onClick={handleRefresh} className="underline font-semibold hover:text-[var(--red-900)] ml-2">
            Coba lagi
          </button>
        </div>
      )}

      {/* Grid of Memories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full bg-[var(--bg-surface)] p-12 rounded-2xl border border-[var(--border-subtle)] text-center space-y-3">
            <Loader2 className="w-6 h-6 text-[var(--olive-accent)] animate-spin mx-auto" />
            <p className="text-xs text-[var(--text-muted)]">Memuat riwayat pesan...</p>
          </div>
        ) : memories.length > 0 ? (
          memories.map((m) => (
            <div
              key={m.id}
              className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-xs flex flex-col justify-between hover:border-[var(--border-chip)] transition-all group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Calendar className="w-3 h-3 text-[var(--olive-accent)]" />
                    {new Date(m.received_at || m.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-[var(--olive-primary)] group-hover:scale-110 transition-transform">
                    <Inbox className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className="text-sm font-medium text-[var(--text-main)] leading-relaxed">&ldquo;{m.body}&rdquo;</p>
              </div>

              <div className="pt-3 border-t border-[var(--bg-surface-subtle)] flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-3">
                <span className="flex items-center gap-1 text-[var(--olive-primary)] font-medium">
                  <User className="w-2.5 h-2.5" />
                  <span>{m.sender_name || 'Companion'}</span>
                </span>
                <span className="font-mono text-[var(--text-dim)]">
                  {new Date(m.received_at || m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-[var(--bg-surface)] p-8 rounded-2xl border border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)] space-y-2">
            <Inbox className="w-8 h-8 text-[var(--olive-accent)] mx-auto opacity-40" />
            <p className="font-medium text-[var(--text-main)]">Belum ada pesan tersimpan di arsip.</p>
            <p className="text-[11px] text-[var(--text-dim)]">
              Pesan yang telah dikirim dan berhasil diterima oleh MewBot akan otomatis tersimpan di sini selama 90 hari.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
