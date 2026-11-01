'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Send, Plus, Heart, Coffee, Compass, CheckCircle2 } from 'lucide-react';

const CATEGORIES = ['Semua', 'Affection', 'Caring', 'Missing', 'Encouragement', 'Random'];

export default function QuickNotesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [category, setCategory] = useState('Semua');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // New Template Form State
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCat, setNewCat] = useState('Affection');

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/dashboard/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSendToMewBot = async (template: any) => {
    setSendingId(template.title);
    setToast(null);
    try {
      const res = await fetch('/api/dashboard/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: template.body }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast(`Template "${template.title}" berhasil dikirim ke antrean MewBot!`);
      } else {
        setToast(data.error || 'Gagal mengirim');
      }
    } catch (err: any) {
      setToast(err.message || 'Error');
    } finally {
      setSendingId(null);
    }
  };

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;

    try {
      const res = await fetch('/api/dashboard/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCat,
          title: newTitle.trim(),
          body: newBody.trim(),
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setNewTitle('');
        setNewBody('');
        fetchTemplates();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = category === 'Semua'
    ? templates
    : templates.filter((t) => t.category === category);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-[#eae4d5] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[#1e241f] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span>Quick Love Notes</span>
          </h1>
          <p className="text-xs text-[#5e6b5f] mt-0.5">
            Kumpulan template pesan cinta siap kirim dengan 1 kali klik ke MewBot.
          </p>
        </div>

        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3.5 py-2 rounded-xl bg-[#466743] text-white text-xs font-semibold hover:bg-[#385336] transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Template Baru</span>
        </button>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-[#eef4ea] border border-[#cbdbca] text-xs text-[#273826] flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-[#466743]" />
          <span>{toast}</span>
        </div>
      )}

      {/* Add Form Dialog */}
      {showAdd && (
        <form onSubmit={handleAddTemplate} className="bg-white p-6 rounded-2xl border border-[#cbdbca] shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-[#1e241f]">Tambah Template Baru</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Judul Template (misal: Sapaan Pagi)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="text-xs p-2.5 rounded-xl border border-[#eae4d5] bg-[#fcfbf7]"
              required
            />
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              className="text-xs p-2.5 rounded-xl border border-[#eae4d5] bg-[#fcfbf7]"
            >
              <option value="Affection">Affection</option>
              <option value="Caring">Caring</option>
              <option value="Missing">Missing</option>
              <option value="Encouragement">Encouragement</option>
              <option value="Random">Random</option>
            </select>
            <input
              type="text"
              maxLength={80}
              placeholder="Isi pesan (maks 80 karakter)"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              className="text-xs p-2.5 rounded-xl border border-[#eae4d5] bg-[#fcfbf7]"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-[#5e6b5f] hover:bg-[#f6f3eb]"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[#466743] text-white text-xs font-semibold hover:bg-[#385336]"
            >
              Simpan Template
            </button>
          </div>
        </form>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              category === cat
                ? 'bg-[#466743] text-white shadow-xs'
                : 'bg-white text-[#5e6b5f] hover:text-[#1e241f] border border-[#eae4d5]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((t, idx) => (
          <div
            key={idx}
            className="bg-white p-5 rounded-2xl border border-[#eae4d5] shadow-xs flex flex-col justify-between hover:border-[#cbdbca] transition-all space-y-4"
          >
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-[#1e241f]">{t.title}</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#f6f3eb] text-[#5e6b5f] border border-[#eae4d5]">
                  {t.category}
                </span>
              </div>
              <p className="text-xs text-[#5e6b5f] leading-relaxed">&ldquo;{t.body}&rdquo;</p>
            </div>

            <button
              onClick={() => handleSendToMewBot(t)}
              disabled={sendingId === t.title}
              className="w-full py-2 rounded-xl bg-[#eef4ea] hover:bg-[#cbdbca] text-[#273826] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border border-[#cbdbca]"
            >
              <Send className="w-3.5 h-3.5 text-[#466743]" />
              <span>{sendingId === t.title ? 'Mengirim...' : 'Kirim ke MewBot'}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

