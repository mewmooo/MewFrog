'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, Send, Plus, RefreshCw, Loader2, MessageSquareHeart } from 'lucide-react';

const CATEGORIES = ['Semua', 'Affection', 'Caring', 'Missing', 'Encouragement', 'Random'];

export default function QuickNotesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [category, setCategory] = useState('Semua');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Template Form State
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCat, setNewCat] = useState('Affection');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchTemplates();
  };

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
        setToast({
          type: 'success',
          message: `Template "${template.title}" berhasil dikirim ke antrean MewBot! 💌`,
        });
      } else {
        setToast({
          type: 'error',
          message: data.error || 'Gagal mengirim template',
        });
      }
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Gagal terhubung ke server',
      });
    } finally {
      setSendingId(null);
    }
  };

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;

    setSavingTemplate(true);
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
        setToast({
          type: 'success',
          message: 'Template baru berhasil disimpan!',
        });
        fetchTemplates();
      } else {
        const data = await res.json();
        setToast({
          type: 'error',
          message: data.error || 'Gagal menyimpan template',
        });
      }
    } catch (e: any) {
      setToast({
        type: 'error',
        message: e.message || 'Error server',
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const filtered = category === 'Semua'
    ? templates
    : templates.filter((t) => t.category === category);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-[#eae4d5] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[#1e241f] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span>Quick Love Notes</span>
            {templates.length > 0 && (
              <span className="text-xs font-medium text-[#5e6b5f]">
                ({templates.length} template)
              </span>
            )}
          </h1>
          <p className="text-xs text-[#5e6b5f] mt-0.5">
            Kumpulan template pesan cinta siap kirim dengan 1 kali klik ke MewBot.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-[#f6f3eb] border border-[#eae4d5] text-[#5e6b5f] hover:text-[#1e241f] transition-colors disabled:opacity-50"
            title="Muat Ulang Template"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-3.5 py-2 rounded-xl bg-[#466743] text-white text-xs font-semibold hover:bg-[#385336] transition-all flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Template</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {toast && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            toast.type === 'success'
              ? 'bg-[#eef4ea] border-[#cbdbca] text-[#273826]'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {/* Add New Template Modal / Panel */}
      {showAdd && (
        <form
          onSubmit={handleAddTemplate}
          className="bg-white p-5 rounded-2xl border border-[#cbdbca] shadow-xs space-y-3 animate-in fade-in-50"
        >
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#273826]">
            Tambah Template Baru
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#5e6b5f] mb-1">
                Kategori
              </label>
              <select
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-[#eae4d5] bg-[#fcfbf7] focus:outline-none focus:border-[#466743]"
              >
                {CATEGORIES.filter((c) => c !== 'Semua').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-[#5e6b5f] mb-1">
                Judul Template
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Contoh: Semangat Sidang Skripsi"
                className="w-full text-xs p-2 rounded-xl border border-[#eae4d5] bg-[#fcfbf7] focus:outline-none focus:border-[#466743]"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5e6b5f] mb-1">
              Isi Pesan (Maks. 80 Karakter)
            </label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              maxLength={80}
              rows={2}
              placeholder="Tulis pesan manismu di sini..."
              className="w-full text-xs p-2 rounded-xl border border-[#eae4d5] bg-[#fcfbf7] focus:outline-none focus:border-[#466743]"
              required
            />
            <span className="text-[10px] text-[#5e6b5f] block text-right">
              {newBody.length}/80 karakter
            </span>
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
              disabled={savingTemplate}
              className="px-4 py-1.5 rounded-lg bg-[#466743] text-white text-xs font-semibold hover:bg-[#385336] disabled:opacity-50"
            >
              {savingTemplate ? 'Menyimpan...' : 'Simpan Template'}
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
        {loading ? (
          <div className="col-span-full bg-white p-12 rounded-2xl border border-[#eae4d5] text-center space-y-3">
            <Loader2 className="w-6 h-6 text-purple-600 animate-spin mx-auto" />
            <p className="text-xs text-[#5e6b5f]">Memuat template Quick Notes...</p>
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((t, idx) => (
            <div
              key={idx}
              className="bg-white p-5 rounded-2xl border border-[#eae4d5] shadow-xs flex flex-col justify-between hover:border-[#cbdbca] transition-all space-y-4 group"
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
                className="w-full py-2 rounded-xl bg-[#eef4ea] hover:bg-[#cbdbca] text-[#273826] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border border-[#cbdbca] disabled:opacity-50"
              >
                {sendingId === t.title ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#466743]" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-[#466743]" />
                    <span>Kirim ke MewBot</span>
                  </>
                )}
              </button>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white p-8 rounded-2xl border border-[#eae4d5] text-center text-xs text-[#5e6b5f] space-y-2">
            <MessageSquareHeart className="w-8 h-8 text-purple-500 mx-auto opacity-40" />
            <p className="font-medium text-[#1e241f]">
              Belum ada template pada kategori &ldquo;{category}&rdquo;.
            </p>
            <p className="text-[11px] text-[#8b998c]">
              Klik tombol &ldquo;Tambah Template&rdquo; di atas untuk membuat pesan kustom baru.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
