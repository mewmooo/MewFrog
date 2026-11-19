'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { History, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { formatActivityEvent } from '@/lib/activity-helper';

export default function TimelinePage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/overview');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.recent_activities || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTimeline();
    const interval = setInterval(fetchTimeline, 8000);
    return () => clearInterval(interval);
  }, [fetchTimeline]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchTimeline();
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--blue-600)]" />
            <span>Activity Timeline</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Log kronologis aktivitas MewBot (Pesan, Pergantian Mode, Jadwal Alarm, dan Status Sistem).
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] self-start sm:self-auto transition-colors disabled:opacity-50"
          title="Segarkan Linimasa"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Timeline Card */}
      <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-xs">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-6 h-6 text-[var(--blue-600)] animate-spin" />
            <p className="text-xs text-[var(--text-muted)]">Memuat riwayat linimasa aktivitas...</p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[var(--border-subtle)]">
            {activities.length > 0 ? (
              activities.map((item) => {
                const act = formatActivityEvent(item);
                const IconComp = act.icon;

                return (
                  <div key={item.id} className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4 pb-1 group">
                    {/* Timeline Dot Indicator */}
                    <div className={`absolute -left-6 top-1.5 w-4 h-4 rounded-full !bg-[var(--bg-surface)] border-2 flex items-center justify-center ${act.iconBg}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${act.iconColor.replace('text-', 'bg-')}`} />
                    </div>

                    <div className="space-y-1.5 flex-1 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg border flex items-center justify-center ${act.iconBg}`}>
                          <IconComp className={`w-3.5 h-3.5 ${act.iconColor}`} />
                        </div>
                        <span className="text-xs font-bold text-[var(--text-main)]">
                          {act.title}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${act.badgeColor}`}>
                          {act.badge}
                        </span>
                      </div>

                      <p className="text-xs text-[var(--timeline-body)] leading-relaxed pl-8 sm:pl-0">
                        {act.description}
                      </p>

                      {/* Preview pesan jika tersedia */}
                      {act.previewQuote && (
                        <div className="mt-1 pl-8 sm:pl-0">
                          <div className="p-2.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs italic text-[var(--olive-deep)] font-medium max-w-lg shadow-xs">
                            {act.previewQuote}
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="text-[11px] font-mono text-[var(--text-dim)] whitespace-nowrap self-end sm:self-start pt-1">
                      {new Date(item.created_at).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })} WIB
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 space-y-2">
                <Sparkles className="w-6 h-6 text-[var(--olive-accent)] mx-auto opacity-40" />
                <p className="text-xs text-[var(--text-muted)]">Belum ada rekaman log timeline.</p>
                <p className="text-[11px] text-[var(--text-dim)]">
                  Aktivitas MewBot seperti pesan diterima, pergantian mode, atau sensor sentuh akan tercatat otomatis di sini.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
