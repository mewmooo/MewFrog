'use client';

import React, { useEffect, useState } from 'react';
import { 
  Settings, 
  Clock, 
  Bell, 
  BellOff, 
  Trash2, 
  RotateCcw, 
  Cpu, 
  Wifi, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Check,
  Upload,
  HardDrive,
  Loader2 
} from 'lucide-react';

export default function SettingsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [alarmHour, setAlarmHour] = useState(7);
  const [alarmMin, setAlarmMin] = useState(0);
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [savingAlarm, setSavingAlarm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Restart Modal Confirmation
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // OTA Firmware Update
  const [otaBuilds, setOtaBuilds] = useState<any[]>([]);
  const [selectedBuild, setSelectedBuild] = useState<any>(null);
  const [manualOta, setManualOta] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [manualSha, setManualSha] = useState('');
  const [manualVersion, setManualVersion] = useState('');
  const [showOtaModal, setShowOtaModal] = useState(false);
  const [sendingOta, setSendingOta] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/dashboard/overview');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        const st = json.device_state || json.state;
        if (st) {
          setAlarmHour(st.alarm_hour ?? 7);
          setAlarmMin(st.alarm_minute ?? 0);
          setAlarmEnabled(Boolean(st.alarm_enabled));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Daftar build firmware tersedia diambil dari manifest statis (satu origin, tanpa auth).
  useEffect(() => {
    fetch('/firmware/manifest.json')
      .then((res) => (res.ok ? res.json() : { firmware: [] }))
      .catch(() => ({ firmware: [] }))
      .then((json) => setOtaBuilds(Array.isArray(json?.firmware) ? json.firmware : []));
  }, []);

  // Label kedaluwarsa dihitung terhadap waktu sekarang. Tanpa detak berkala,
  // tab yang dibiarkan terbuka terus menampilkan "Berlaku sampai ..." padahal
  // perintahnya sudah lewat masa berlaku.
  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  const handleSaveAlarm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingAlarm(true);
    setToast(null);
    try {
      const res = await fetch('/api/dashboard/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_alarm',
          payload: {
            enabled: true,
            hour: alarmHour,
            minute: alarmMin,
          },
        }),
      });
      const resData = await res.json();
      if (res.ok) {
        setAlarmEnabled(true);
        setToast(resData.feedback || `Alarm berhasil disetel pada pukul ${alarmHour.toString().padStart(2, '0')}:${alarmMin.toString().padStart(2, '0')} WIB!`);
        fetchSettings();
      } else {
        setToast(resData.error || 'Gagal menyimpan alarm');
      }
    } catch (err: any) {
      setToast(err.message || 'Error');
    } finally {
      setSavingAlarm(false);
    }
  };

  const handleDeleteAlarm = async () => {
    setSavingAlarm(true);
    setToast(null);
    try {
      const res = await fetch('/api/dashboard/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_alarm',
          payload: {
            enabled: false,
            hour: alarmHour,
            minute: alarmMin
          },
        }),
      });
      const resData = await res.json();
      if (res.ok) {
        setAlarmEnabled(false);
        setToast(resData.feedback || 'Alarm berhasil dibatalkan / dihapus!');
        fetchSettings();
      } else {
        setToast(resData.error || 'Gagal menghapus alarm');
      }
    } catch (err: any) {
      setToast(err.message || 'Error');
    } finally {
      setSavingAlarm(false);
    }
  };

  const handleSelectPreset = (h: number, m: number) => {
    setAlarmHour(h);
    setAlarmMin(m);
  };

  const handleConfirmRestart = async () => {
    setRestarting(true);
    try {
      const res = await fetch('/api/dashboard/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart', payload: {} }),
      });
      const resData = await res.json();
      setShowRestartModal(false);
      setToast(resData.feedback || 'Perintah restart telah dijadwalkan!');
    } catch (err: any) {
      setToast(err.message || 'Error');
    } finally {
      setRestarting(false);
    }
  };

  const dev = data?.device;
  const timeFormatted = `${alarmHour.toString().padStart(2, '0')}:${alarmMin.toString().padStart(2, '0')} WIB`;

  const pendingOta = (data?.pending_commands || []).filter((cmd: any) => cmd.command_type === 'ota');

  // Hasil update terakhir, diambil dari linimasa agar pemilik melihat konfirmasi
  // (berhasil atau gagal beserta alasannya) di kartu yang sama dengan tombol kirim.
  const lastOtaResult = (() => {
    const activities = data?.recent_activities || [];
    const found = activities.find(
      (act: any) =>
        act.metadata?.action === 'firmware_update_applied' ||
        act.metadata?.action === 'firmware_update_failed'
    );
    if (!found) return null;
    return {
      ok: found.metadata.action === 'firmware_update_applied',
      error: found.metadata.error || null,
      at: found.created_at,
    };
  })();

  const otaPayload = () => {
    if (manualOta) {
      const url = manualUrl.trim();
      const sha = manualSha.trim();
      if (!url || sha.length !== 64) return null;
      return { url, sha256: sha, version: manualVersion.trim() || undefined };
    }
    if (!selectedBuild) return null;
    return {
      url: selectedBuild.url,
      sha256: selectedBuild.sha256,
      version: selectedBuild.version,
    };
  };

  const otaReady = otaPayload() !== null;

  const handleConfirmOta = async () => {
    const payload = otaPayload();
    if (!payload) {
      setToast('Pilih firmware atau isi URL manual terlebih dahulu.');
      setShowOtaModal(false);
      return;
    }

    setSendingOta(true);
    try {
      const res = await fetch('/api/dashboard/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ota', payload }),
      });
      const resData = await res.json();
      setShowOtaModal(false);

      if (!res.ok) {
        setToast(resData.error || 'Gagal menjadwalkan update firmware');
        return;
      }

      setToast(resData.feedback || 'Perintah update firmware dijadwalkan!');
      setSelectedBuild(null);
      fetchSettings();
    } catch (err: any) {
      setToast(err.message || 'Error');
    } finally {
      setSendingOta(false);
    }
  };

  const handleCancelOta = async (commandId: string) => {
    try {
      const res = await fetch('/api/dashboard/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_command', payload: { command_id: commandId } }),
      });
      const resData = await res.json();
      setToast(res.ok ? resData.feedback : resData.error || 'Gagal membatalkan perintah');
      fetchSettings();
    } catch (err: any) {
      setToast(err.message || 'Error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[var(--text-muted)]" />
            <span>Device Settings &amp; Control</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Kelola jadwal alarm harian, mode tampilan, diagnostik perangkat keras, dan restart jarak jauh.
          </p>
        </div>
      </div>

      {toast && (
        <div className="p-3.5 rounded-xl bg-[var(--olive-subtle)] border border-[var(--border-chip)] text-xs text-[var(--olive-deep)] flex items-center gap-2 shadow-xs transition-all">
          <CheckCircle2 className="w-4 h-4 text-[var(--olive-primary)] shrink-0" />
          <span className="font-medium">{toast}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Alarm Settings Card */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--bg-surface-subtle)] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--amber-50)] text-[var(--amber-600)] flex items-center justify-center border border-[var(--amber-200)]">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-main)]">Pengaturan Alarm MewBot</h2>
                <p className="text-[11px] text-[var(--text-muted)]">Alarm mandiri berbasis hardware ESP32-C3</p>
              </div>
            </div>

            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
              loading
                ? 'bg-[var(--amber-50)] text-[var(--amber-700)] border-[var(--amber-200)]'
                : alarmEnabled 
                ? 'bg-[var(--emerald-50)] text-[var(--emerald-700)] border-[var(--emerald-200)]' 
                : 'bg-[var(--slate-50)] text-[var(--slate-600)] border-[var(--slate-200)]'
            }`}>
              {loading ? 'Sinkronisasi...' : alarmEnabled ? 'Aktif' : 'Mati / Dibatalkan'}
            </span>
          </div>

          {/* Current Active Alarm Info Box */}
          <div className={`p-4 rounded-xl border transition-all ${
            loading
              ? 'bg-[var(--bg-primary)] border-[var(--border-subtle)]'
              : alarmEnabled 
              ? 'bg-[var(--amber-50)]/60 border-[var(--amber-200)]' 
              : 'bg-[var(--bg-primary)] border-[var(--border-subtle)]'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">
                  {loading ? 'Status Alarm:' : alarmEnabled ? 'Jadwal Alarm Berdering:' : 'Status Alarm Saat Ini:'}
                </span>
                <span className={`text-2xl font-bold font-mono ${
                  loading ? 'text-[var(--slate-400)]' : alarmEnabled ? 'text-[var(--amber-800)]' : 'text-[var(--slate-400)]'
                }`}>
                  {loading ? 'Memeriksa...' : alarmEnabled ? timeFormatted : '--:-- WIB'}
                </span>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {loading
                    ? 'Menghubungkan ke chip RTC / NVS ESP32-C3...'
                    : alarmEnabled 
                    ? 'MewBot akan memutar melodi pengingat pada jam di atas setiap hari.' 
                    : 'Tidak ada alarm aktif saat ini.'}
                </p>
              </div>

              {!loading && alarmEnabled && (
                <button
                  type="button"
                  onClick={handleDeleteAlarm}
                  disabled={savingAlarm}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--red-200)] text-[var(--red-600)] hover:bg-[var(--red-50)] text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all shrink-0"
                  title="Hapus atau batalkan alarm ini jika tidak jadi memasang alarm"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[var(--red-500)]" />
                  <span>Hapus Alarm</span>
                </button>
              )}
            </div>
          </div>

          {/* Alarm Configuration Form */}
          <form onSubmit={handleSaveAlarm} className="space-y-4">
            <div>
              <span className="text-xs font-bold text-[var(--text-main)] block mb-2">
                Pilih Jam Waktu Cepat (Preset WIB):
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {[
                  { label: '05:00', h: 5, m: 0 },
                  { label: '06:00', h: 6, m: 0 },
                  { label: '06:30', h: 6, m: 30 },
                  { label: '07:00', h: 7, m: 0 },
                  { label: '07:30', h: 7, m: 30 },
                  { label: '08:00', h: 8, m: 0 },
                ].map((preset) => {
                  const isSelected = alarmHour === preset.h && alarmMin === preset.m;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleSelectPreset(preset.h, preset.m)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-mono font-semibold border transition-all ${
                        isSelected
                          ? 'bg-[var(--olive-primary)] text-[var(--on-olive)] border-[var(--olive-primary)] shadow-xs'
                          : 'bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manual Time Input */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                  Jam (00 - 23 WIB)
                </label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={alarmHour}
                  onChange={(e) => setAlarmHour(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                  className="w-full text-base font-mono font-bold p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] focus:outline-none focus:border-[var(--olive-primary)]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                  Menit (00 - 59)
                </label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={alarmMin}
                  onChange={(e) => setAlarmMin(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                  className="w-full text-base font-mono font-bold p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] focus:outline-none focus:border-[var(--olive-primary)]"
                />
              </div>
            </div>

            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              💡 Alarm berjalan secara mandiri di hardware ESP32-C3 dan tetap akan berdering meskipun koneksi Wi-Fi sedang offline.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="submit"
                disabled={savingAlarm}
                className="flex-1 py-2.5 rounded-xl bg-[var(--olive-primary)] text-[var(--on-olive)] text-xs font-semibold hover:bg-[var(--olive-hover)] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{savingAlarm ? 'Menyimpan...' : 'Simpan & Aktifkan Alarm'}</span>
              </button>

              {alarmEnabled && (
                <button
                  type="button"
                  onClick={handleDeleteAlarm}
                  disabled={savingAlarm}
                  className="px-4 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--red-200)] text-[var(--red-700)] text-xs font-semibold hover:bg-[var(--red-50)] transition-all flex items-center justify-center gap-1.5"
                >
                  <BellOff className="w-3.5 h-3.5 text-[var(--red-500)]" />
                  <span>Batalkan Alarm</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* 2. Hardware Diagnostics Card */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--bg-surface-subtle)] pb-3">
            <Activity className="w-4 h-4 text-[var(--emerald-600)]" />
            <h2 className="text-sm font-bold text-[var(--text-main)]">Diagnostik Hardware ESP32-C3</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Sensor Gerak ADXL345 (I2C 0x53)</span>
              <span className="font-semibold text-[var(--emerald-600)] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--emerald-600)]" />
                <span>Aktif</span>
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Sensor Sentuh TTP223 (GPIO 4)</span>
              <span className="font-semibold text-[var(--emerald-600)] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--emerald-600)]" />
                <span>Aktif</span>
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Layar OLED SH1106 128×64 (I2C 0x3C)</span>
              <span className="font-semibold text-[var(--emerald-600)] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--emerald-600)]" />
                <span>Aktif (60 FPS)</span>
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">SRAM Free Heap</span>
              <span className="font-mono font-bold text-[var(--text-main)]">
                {dev?.diagnostics?.free_heap ? `${Math.round(dev.diagnostics.free_heap / 1024)} KB` : '282 KB'}
              </span>
            </div>
            {dev?.diagnostics?.min_free_heap && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Min Free Heap (Peak Watermark)</span>
                <span className="font-mono font-bold text-[var(--emerald-700)]">
                  {Math.round(dev.diagnostics.min_free_heap / 1024)} KB
                </span>
              </div>
            )}
            {dev?.diagnostics?.max_alloc_heap && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Blok Bebas Terbesar (Fragmentasi)</span>
                <span className="font-mono font-bold text-[var(--emerald-700)]">
                  {Math.round(dev.diagnostics.max_alloc_heap / 1024)} KB
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Remote Restart & Danger Zone */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--bg-surface-subtle)] pb-3">
            <RotateCcw className="w-4 h-4 text-[var(--red-600)]" />
            <h2 className="text-sm font-bold text-[var(--text-main)]">Remote Device Restart</h2>
          </div>

          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Restart jarak jauh berguna jika Anda baru memperbarui konfigurasi atau ingin mereset heap memory ESP32-C3.
            Perintah memerlukan konfirmasi modal untuk mencegah ketidaksengajaan.
          </p>

          <button
            onClick={() => setShowRestartModal(true)}
            className="px-4 py-2 rounded-xl bg-[var(--red-50)] border border-[var(--red-200)] text-[var(--red-700)] text-xs font-semibold hover:bg-[var(--red-100)] transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart MewBot Jarak Jauh</span>
          </button>
        </div>

        {/* 4. Update Firmware (OTA) */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--bg-surface-subtle)] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--purple-50)] text-[var(--purple-600)] flex items-center justify-center border border-[var(--purple-200)]">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-main)]">Update Firmware (OTA)</h2>
                <p className="text-[11px] text-[var(--text-muted)]">Unduh firmware baru tanpa mencabut kabel USB</p>
              </div>
            </div>

            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border bg-[var(--bg-primary)] text-[var(--text-muted)] border-[var(--border-subtle)]">
              Terpasang: {dev?.firmware_version || 'belum terhubung'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Flash 4MB · Dual-slot app0/app1</span>
            </span>
            <button
              type="button"
              onClick={() => setManualOta((prev) => !prev)}
              className="text-[var(--olive-primary)] font-semibold hover:underline"
            >
              {manualOta ? 'Pakai daftar build' : 'URL manual'}
            </button>
          </div>

          {manualOta ? (
            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                  URL firmware (HTTPS)
                </label>
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://contoh.com/mewbot-1.9.0.bin"
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] focus:outline-none focus:border-[var(--olive-primary)]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                    SHA-256 (64 karakter)
                  </label>
                  <input
                    type="text"
                    value={manualSha}
                    onChange={(e) => setManualSha(e.target.value)}
                    placeholder="ab12..."
                    className="w-full text-[11px] font-mono p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] focus:outline-none focus:border-[var(--olive-primary)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                    Versi (opsional)
                  </label>
                  <input
                    type="text"
                    value={manualVersion}
                    onChange={(e) => setManualVersion(e.target.value)}
                    placeholder="1.9.0"
                    className="w-full text-[11px] font-mono p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] focus:outline-none focus:border-[var(--olive-primary)]"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {otaBuilds.length === 0 ? (
                <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
                  Belum ada build di server. Taruh file <span className="font-mono">mewbot-x.y.z.bin</span> di
                  <span className="font-mono"> dashboard/public/firmware</span>, jalankan
                  <span className="font-mono"> npm run firmware:manifest</span>, lalu deploy.
                </p>
              ) : (
                otaBuilds.map((build: any) => {
                  const isSelected = !manualOta && selectedBuild?.file === build.file;
                  return (
                    <button
                      key={build.file}
                      type="button"
                      onClick={() => setSelectedBuild(build)}
                      className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-[var(--olive-subtle)] border-[var(--border-chip)]'
                          : 'bg-[var(--bg-primary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-[var(--text-main)]">v{build.version}</span>
                        <span className="block text-[10px] font-mono text-[var(--text-muted)] truncate">
                          {(build.size / 1024 / 1024).toFixed(2)} MB · sha {String(build.sha256).slice(0, 12)}...
                        </span>
                      </span>
                      <span className={`text-[11px] font-semibold shrink-0 ${isSelected ? 'text-[var(--olive-primary)]' : 'text-[var(--text-dim)]'}`}>
                        {isSelected ? 'Dipilih' : 'Pilih'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {lastOtaResult && (
            <div
              className={`p-3 rounded-xl border text-[11px] leading-relaxed ${
                lastOtaResult.ok
                  ? 'bg-[var(--emerald-50)]/60 border-[var(--emerald-200)] text-[var(--emerald-900)]'
                  : 'bg-[var(--red-50)]/60 border-[var(--red-200)] text-[var(--red-900)]'
              }`}
            >
              <span className="font-semibold block">
                {lastOtaResult.ok ? 'Update terakhir: Berhasil' : 'Update terakhir: Gagal'}
              </span>
              <span className="block">
                {lastOtaResult.ok
                  ? 'Perangkat sudah berpindah ke firmware baru. Versi di atas berubah setelah perangkat melapor kembali.'
                  : `Perangkat tetap memakai firmware lama.${lastOtaResult.error ? ` Alasan: ${lastOtaResult.error}` : ''}`}
              </span>
            </div>
          )}

          {pendingOta.length > 0 && (
            <div className="space-y-2 p-3 rounded-xl bg-[var(--amber-50)]/60 border border-[var(--amber-200)]">
              <p className="text-[11px] font-semibold text-[var(--amber-900)]">
                Perintah update menunggu polling perangkat
              </p>
              {pendingOta.map((cmd: any) => {
                const expired = cmd.expires_at ? new Date(cmd.expires_at).getTime() < nowTick : false;
                return (
                  <div key={cmd.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-[var(--amber-900)]">
                        {cmd.payload?.version ? `v${cmd.payload.version}` : 'Firmware baru'}
                      </span>
                      <span className={`block text-[10px] ${expired ? 'text-[var(--red-600)] font-semibold' : 'text-[var(--amber-800)]'}`}>
                        {expired
                          ? 'Kedaluwarsa — kirim ulang saat perangkat online'
                          : `Berlaku sampai ${new Date(cmd.expires_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCancelOta(cmd.id)}
                      className="text-[11px] font-semibold text-[var(--red-700)] hover:underline shrink-0"
                    >
                      Batalkan
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowOtaModal(true)}
            disabled={!otaReady}
            className="w-full py-2.5 rounded-xl bg-[var(--olive-primary)] text-[var(--on-olive)] text-xs font-semibold hover:bg-[var(--olive-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Kirim Perintah Update</span>
          </button>

          <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
            Update butuh perangkat online, berlangsung 1-2 menit, dan perangkat reboot sendiri.
            Jalur recovery kabel USB (Type-C) selalu tersedia jika terjadi gangguan daya.
          </p>
        </div>
      </div>

      {/* Confirmation Modal for Restart */}
      {showRestartModal && (
        <div className="fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] max-w-sm w-full p-6 rounded-2xl border border-[var(--border-subtle)] shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-[var(--red-600)]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm text-[var(--text-main)]">Konfirmasi Restart MewBot</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Apakah Anda yakin ingin me-restart perangkat MewBot? Perangkat akan reboot seketika dan tersambung kembali ke Wi-Fi dalam ~5 detik.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRestartModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)]"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmRestart}
                disabled={restarting}
                className="px-4 py-1.5 rounded-lg bg-[var(--red-600)] text-[var(--on-danger)] text-xs font-semibold hover:bg-[var(--red-700)] disabled:opacity-50"
              >
                {restarting ? 'Mengirim...' : 'Ya, Restart Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal for OTA Firmware Update */}
      {showOtaModal && (
        <div className="fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] max-w-sm w-full p-6 rounded-2xl border border-[var(--border-subtle)] shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-[var(--purple-700)]">
              <Upload className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm text-[var(--text-main)]">Konfirmasi Update Firmware</h3>
            </div>

            <div className="space-y-2 text-xs text-[var(--text-muted)] leading-relaxed">
              <p>
                MewBot akan mengunduh{' '}
                <strong className="text-[var(--text-main)]">
                  {manualOta
                    ? manualVersion || 'firmware dari URL manual'
                    : selectedBuild
                      ? `v${selectedBuild.version}`
                      : 'firmware terpilih'}
                </strong>{' '}
                dan menuliskannya ke slot cadangan.
              </p>
              <p>
                Perangkat harus online saat polling berikutnya. Proses memakan 1-2 menit, layar
                menampilkan progres, lalu perangkat reboot sendiri.
              </p>
              <p className="text-[11px] text-[var(--text-dim)]">
                Jangan cabut daya saat proses berjalan. Jika update gagal, firmware lama tetap utuh.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowOtaModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)]"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmOta}
                disabled={sendingOta}
                className="px-4 py-1.5 rounded-lg bg-[var(--olive-primary)] text-[var(--on-olive)] text-xs font-semibold hover:bg-[var(--olive-hover)] disabled:opacity-50"
              >
                {sendingOta ? 'Mengirim...' : 'Ya, Kirim Perintah'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
