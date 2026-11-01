'use client';

import React, { useEffect, useState } from 'react';
import { History, Activity, Wifi, Bell, Heart, RefreshCw } from 'lucide-react';

export default function TimelinePage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = async () => {
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
    }
  };

  useEffect(() => {
    fetchTimeline();
    const interval = setInterval(fetchTimeline, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-[#eae4d5] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[#1e241f] flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <span>Activity Timeline</span>
          </h1>
          <p className="text-xs text-[#5e6b5f] mt-0.5">
            Log kronologis event aktivitas MewBot (Status Online, Pergantian Mode, Love Mail, Reaksi Sentuh).
          </p>
        </div>

        <button
          onClick={fetchTimeline}
          className="p-2 rounded-xl bg-[#f6f3eb] border border-[#eae4d5] text-[#5e6b5f] hover:text-[#1e241f] self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-[#eae4d5] shadow-xs">
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#eae4d5]">
          {activities.length > 0 ? (
            activities.map((item) => (
              <div key={item.id} className="relative flex items-start justify-between gap-4">
                {/* Dot */}
                <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#466743] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#466743]" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1e241f] capitalize">
                      {item.event_type.replace('_', ' ')}
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono text-[#5e6b5f] bg-[#fcfbf7] p-2 rounded-lg border border-[#eae4d5] max-w-lg overflow-x-auto">
                    {JSON.stringify(item.metadata, null, 2)}
                  </pre>
                </div>

                <span className="text-[11px] font-mono text-[#8b998c] whitespace-nowrap">
                  {new Date(item.created_at).toLocaleString('id-ID')}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-[#5e6b5f] py-4">Belum ada rekaman log timeline.</p>
          )}
        </div>
      </div>
    </div>
  );
}

