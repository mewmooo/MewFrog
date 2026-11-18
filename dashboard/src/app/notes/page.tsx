'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { LayoutTemplate, Send, Plus, RefreshCw, Loader2, Pencil, Trash2, Save, X, AlertTriangle } from 'lucide-react';

const CATEGORIES = ['Semua', 'Umum', 'Pengingat', 'Sapaan', 'Semangat', 'Lainnya'];

export default function TemplatePesanPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [category, setCategory] = useState('Semua');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state: dipakai untuk tambah maupun ubah
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formCat, setFormCat] = useState('Umum');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Konfirmasi hapus
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

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

  const openCreateForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormBody('');
    setFormCat('Umum');
    setShowForm(true);
  };

  const openEditForm = (template: any) => {
    setEditingId(template.id);
    setFormTitle(template.title);
    setFormBody(template.body);
    setFormCat(template.category);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormTitle('');
    setFormBody('');
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
          message: `Template "${template.title}" berhasil dikirim ke antrean MewBot!`,
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

  // Simpan: POST bila menambah, PATCH bila mengubah
  const handleSubmitTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formBody.trim()) return;

    setSavingTemplate(true);
    try {
      const isEdit = Boolean(editingId);
      const res = await fetch('/api/dashboard/templates', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? { id: editingId, title: formTitle.trim(), body: formBody.trim(), category: formCat }
            : { title: formTitle.trim(), body: formBody.trim(), category: formCat }
        ),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        closeForm();
        setToast({
          type: 'success',
          message: isEdit ? 'Perubahan template berhasil disimpan!' : 'Template baru berhasil disimpan!',
        });
        fetchTemplates();
      } else {
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

  // Simpan template contoh menjadi baris nyata
  const handleSaveExample = async (template: any) => {
    setSavingTemplate(true);
    try {
      const res = await fetch('/api/dashboard/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template.title,
          body: template.body,
          category: template.category,
        }),
      });
      if (res.ok) {
        setToast({ type: 'success', message: `Template "${template.title}" tersimpan dan sekarang bisa diedit.` });
        fetchTemplates();
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({ type: 'error', message: data.error || 'Gagal menyimpan template contoh' });
      }
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Error server' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/templates?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast({ type: 'success', message: `Template "${deleteTarget.title}" dihapus.` });
        setDeleteTarget(null);
        fetchTemplates();
      } else {
        setToast({ type: 'error', message: data.error || 'Gagal menghapus template' });
      }
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Error server' });
    } finally {
      setDeleting(false);
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
            <LayoutTemplate className="w-5 h-5 text-[#466743]" />
            <span>Template Pesan</span>
            {templates.length > 0 && (
              <span className="text-xs font-medium text-[#5e6b5f]">
                ({templates.length} template)
              </span>
            )}
          </h1>
          <p className="text-xs text-[#5e6b5f] mt-0.5">
            Kumpulan template pesan siap kirim dengan satu klik ke MewBot.
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
            onClick={showForm ? closeForm : openCreateForm}
            className="px-3.5 py-2 rounded-xl bg-[#466743] text-white text-xs font-semibold hover:bg-[#385336] transition-all flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{showForm ? 'Tutup Form' : 'Tambah Template'}</span>
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

      {/* Form Tambah / Ubah Template */}
      {showForm && (
        <form
          onSubmit={handleSubmitTemplate}
          className="bg-white p-5 rounded-2xl border border-[#cbdbca] shadow-xs space-y-3 animate-in fade-in-50"
        >
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#273826]">
            {editingId ? 'Ubah Template' : 'Tambah Template Baru'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#5e6b5f] mb-1">
                Kategori
              </label>
              <select
                value={formCat}
                onChange={(e) => setFormCat(e.target.value)}
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
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Contoh: Pengingat Minum Air"
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
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              maxLength={80}
              rows={2}
              placeholder="Tulis isi pesan di sini..."
              className="w-full text-xs p-2 rounded-xl border border-[#eae4d5] bg-[#fcfbf7] focus:outline-none focus:border-[#466743]"
              required
            />
            <span className="text-[10px] text-[#5e6b5f] block text-right">
              {formBody.length}/80 karakter
            </span>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeForm}
              className="px-3 py-1.5 rounded-lg text-xs text-[#5e6b5f] hover:bg-[#f6f3eb]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingTemplate}
              className="px-4 py-1.5 rounded-lg bg-[#466743] text-white text-xs font-semibold hover:bg-[#385336] disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingTemplate ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan Template'}</span>
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
            <Loader2 className="w-6 h-6 text-[#466743] animate-spin mx-auto" />
            <p className="text-xs text-[#5e6b5f]">Memuat template...</p>
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((t, idx) => (
            <div
              key={t.id || `example-${idx}`}
              className="bg-white p-5 rounded-2xl border border-[#eae4d5] shadow-xs flex flex-col justify-between hover:border-[#cbdbca] transition-all space-y-4 group"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-2 gap-2">
                  <span className="font-semibold text-[#1e241f] truncate">{t.title}</span>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#f6f3eb] text-[#5e6b5f] border border-[#eae4d5] shrink-0">
                    {t.category}
                  </span>
                </div>
                <p className="text-xs text-[#5e6b5f] leading-relaxed">&ldquo;{t.body}&rdquo;</p>
                {t.is_example && (
                  <span className="inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Contoh — belum tersimpan
                  </span>
                )}
              </div>

              <div className="space-y-2">
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

                {t.is_example ? (
                  <button
                    onClick={() => handleSaveExample(t)}
                    disabled={savingTemplate}
                    className="w-full py-1.5 rounded-xl bg-white border border-[#eae4d5] text-[#466743] text-[11px] font-semibold hover:bg-[#f6f3eb] disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3 h-3" />
                    <span>Simpan sebagai template</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditForm(t)}
                      className="flex-1 py-1.5 rounded-xl bg-white border border-[#eae4d5] text-[#466743] text-[11px] font-semibold hover:bg-[#f6f3eb] flex items-center justify-center gap-1.5"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="flex-1 py-1.5 rounded-xl bg-white border border-red-200 text-red-700 text-[11px] font-semibold hover:bg-red-50 flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white p-8 rounded-2xl border border-[#eae4d5] text-center text-xs text-[#5e6b5f] space-y-2">
            <LayoutTemplate className="w-8 h-8 text-[#8b998c] mx-auto opacity-60" />
            <p className="font-medium text-[#1e241f]">
              Belum ada template pada kategori &ldquo;{category}&rdquo;.
            </p>
            <p className="text-[11px] text-[#8b998c]">
              Klik tombol &ldquo;Tambah Template&rdquo; di atas untuk membuat template baru.
            </p>
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Hapus */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full p-6 rounded-2xl border border-[#eae4d5] shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm text-[#1e241f]">Hapus Template?</h3>
            </div>
            <p className="text-xs text-[#5e6b5f] leading-relaxed">
              Template <strong className="text-[#1e241f]">&ldquo;{deleteTarget.title}&rdquo;</strong> akan
              dihapus permanen dan tidak bisa dikembalikan.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#5e6b5f] hover:bg-[#f6f3eb] flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Batal</span>
              </button>
              <button
                onClick={handleDeleteTemplate}
                disabled={deleting}
                className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
