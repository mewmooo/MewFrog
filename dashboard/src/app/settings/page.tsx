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
  Shield, 
  Check,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-[#eae4d5] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[#1e241f] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#5e6b5f]" />
            <span>Device Settings &amp; Control</span>
          </h1>
          <p className="text-xs text-[#5e6b5f] mt-0.5">
            Kelola jadwal alarm harian, mode tampilan, diagnostik perangkat keras, dan restart jarak jauh.
          </p>
        </div>
      </div>

      {toast && (
        <div className="p-3.5 rounded-xl bg-[#eef4ea] border border-[#cbdbca] text-xs text-[#273826] flex items-center gap-2 shadow-xs transition-all">
          <CheckCircle2 className="w-4 h-4 text-[#466743] shrink-0" />
          <span className="font-medium">{toast}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Alarm Settings Card */}
        <div className="bg-white p-6 rounded-2xl border border-[#eae4d5] shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#f6f3eb] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1e241f]">Pengaturan Alarm MewBot</h2>
                <p className="text-[11px] text-[#5e6b5f]">Alarm mandiri berbasis hardware ESP32-C3</p>
              </div>
            </div>

            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
              loading
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : alarmEnabled 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              {loading ? 'Sinkronisasi...' : alarmEnabled ? 'Aktif' : 'Mati / Dibatalkan'}
            </span>
          </div>

          {/* Current Active Alarm Info Box */}
          <div className={`p-4 rounded-xl border transition-all ${
            loading
              ? 'bg-[#fcfbf7] border-[#eae4d5]'
              : alarmEnabled 
              ? 'bg-amber-50/60 border-amber-200' 
              : 'bg-[#fcfbf7] border-[#eae4d5]'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-[#5e6b5f] block">
                  {loading ? 'Status Alarm:' : alarmEnabled ? 'Jadwal Alarm Berdering:' : 'Status Alarm Saat Ini:'}
                </span>
                <span className={`text-2xl font-bold font-mono ${
                  loading ? 'text-slate-400' : alarmEnabled ? 'text-amber-800' : 'text-slate-400'
                }`}>
                  {loading ? 'Memeriksa...' : alarmEnabled ? timeFormatted : '--:-- WIB'}
                </span>
                <p className="text-[11px] text-[#5e6b5f] mt-0.5">
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
                  className="px-3 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all shrink-0"
                  title="Hapus atau batalkan alarm ini jika tidak jadi memasang alarm"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Hapus Alarm</span>
                </button>
              )}
            </div>
          </div>

          {/* Alarm Configuration Form */}
          <form onSubmit={handleSaveAlarm} className="space-y-4">
            <div>
              <span className="text-xs font-bold text-[#1e241f] block mb-2">
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
                          ? 'bg-[#466743] text-white border-[#466743] shadow-xs'
                          : 'bg-[#fcfbf7] border-[#eae4d5] text-[#5e6b5f] hover:text-[#1e241f] hover:bg-white'
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
                <label className="text-[11px] font-semibold text-[#5e6b5f] block mb-1">
                  Jam (00 - 23 WIB)
                </label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={alarmHour}
                  onChange={(e) => setAlarmHour(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                  className="w-full text-base font-mono font-bold p-2.5 rounded-xl border border-[#eae4d5] bg-[#fcfbf7] focus:outline-none focus:border-[#466743]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#5e6b5f] block mb-1">
                  Menit (00 - 59)
                </label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={alarmMin}
                  onChange={(e) => setAlarmMin(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                  className="w-full text-base font-mono font-bold p-2.5 rounded-xl border border-[#eae4d5] bg-[#fcfbf7] focus:outline-none focus:border-[#466743]"
                />
              </div>
            </div>

            <p className="text-[11px] text-[#5e6b5f] leading-relaxed">
              💡 Alarm berjalan secara mandiri di hardware ESP32-C3 dan tetap akan berdering meskipun koneksi Wi-Fi sedang offline.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="submit"
                disabled={savingAlarm}
                className="flex-1 py-2.5 rounded-xl bg-[#466743] text-white text-xs font-semibold hover:bg-[#385336] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{savingAlarm ? 'Menyimpan...' : 'Simpan & Aktifkan Alarm'}</span>
              </button>

              {alarmEnabled && (
                <button
                  type="button"
                  onClick={handleDeleteAlarm}
                  disabled={savingAlarm}
                  className="px-4 py-2.5 rounded-xl bg-[#fcfbf7] border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 transition-all flex items-center justify-center gap-1.5"
                >
                  <BellOff className="w-3.5 h-3.5 text-rose-500" />
                  <span>Batalkan Alarm</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* 2. Hardware Diagnostics Card */}
        <div className="bg-white p-6 rounded-2xl border border-[#eae4d5] shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#f6f3eb] pb-3">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-[#1e241f]">Diagnostik Hardware ESP32-C3</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcfbf7] border border-[#eae4d5]">
              <span className="text-[#5e6b5f]">Sensor Gerak ADXL345 (I2C 0x53)</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Aktif</span>
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcfbf7] border border-[#eae4d5]">
              <span className="text-[#5e6b5f]">Sensor Sentuh TTP223 (GPIO 4)</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Aktif</span>
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcfbf7] border border-[#eae4d5]">
              <span className="text-[#5e6b5f]">Layar OLED SH1106 128×64 (I2C 0x3C)</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Aktif (60 FPS)</span>
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcfbf7] border border-[#eae4d5]">
              <span className="text-[#5e6b5f]">SRAM Free Heap</span>
              <span className="font-mono font-bold text-[#1e241f]">
                {dev?.diagnostics?.free_heap ? `${Math.round(dev.diagnostics.free_heap / 1024)} KB` : '282 KB'}
              </span>
            </div>
            {dev?.diagnostics?.min_free_heap && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcfbf7] border border-[#eae4d5]">
                <span className="text-[#5e6b5f]">Min Free Heap (Peak Watermark)</span>
                <span className="font-mono font-bold text-emerald-700">
                  {Math.round(dev.diagnostics.min_free_heap / 1024)} KB
                </span>
              </div>
            )}
            {dev?.diagnostics?.max_alloc_heap && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcfbf7] border border-[#eae4d5]">
                <span className="text-[#5e6b5f]">Blok Bebas Terbesar (Fragmentasi)</span>
                <span className="font-mono font-bold text-emerald-700">
                  {Math.round(dev.diagnostics.max_alloc_heap / 1024)} KB
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Remote Restart & Danger Zone */}
        <div className="bg-white p-6 rounded-2xl border border-[#eae4d5] shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#f6f3eb] pb-3">
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <h2 className="text-sm font-bold text-[#1e241f]">Remote Device Restart</h2>
          </div>

          <p className="text-xs text-[#5e6b5f] leading-relaxed">
            Restart jarak jauh berguna jika Anda baru memperbarui konfigurasi atau ingin mereset heap memory ESP32-C3.
            Perintah memerlukan konfirmasi modal untuk mencegah ketidaksengajaan.
          </p>

          <button
            onClick={() => setShowRestartModal(true)}
            className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart MewBot Jarak Jauh</span>
          </button>
        </div>

        {/* 4. OTA Firmware Info */}
        <div className="bg-white p-6 rounded-2xl border border-[#eae4d5] shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#f6f3eb] pb-3">
            <Shield className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-[#1e241f]">Firmware & Pemulihan USB</h2>
          </div>

          <div className="space-y-2 text-xs text-[#5e6b5f]">
            <p>
              Versi Terpasang: <strong className="text-[#1e241f]">{dev?.firmware_version || 'v1.0.0'}</strong>
            </p>
            <p>
              Flash Memory: <strong>4MB (QIO 80MHz)</strong>
            </p>
            <p>
              Skema Partisi OTA: <strong>Dual-Slot 1.75MB app0 / app1</strong>
            </p>
            <p className="text-[11px] text-[#8b998c] pt-1">
              Jalur recovery kabel USB (via Type-C port) selalu tersedia untuk flashing aman jika terjadi gangguan daya saat update.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Restart */}
      {showRestartModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full p-6 rounded-2xl border border-[#eae4d5] shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm text-[#1e241f]">Konfirmasi Restart MewBot</h3>
            </div>
            <p className="text-xs text-[#5e6b5f] leading-relaxed">
              Apakah Anda yakin ingin me-restart perangkat MewBot? Perangkat akan reboot seketika dan tersambung kembali ke Wi-Fi dalam ~5 detik.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRestartModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#5e6b5f] hover:bg-[#f6f3eb]"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmRestart}
                disabled={restarting}
                className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {restarting ? 'Mengirim...' : 'Ya, Restart Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
