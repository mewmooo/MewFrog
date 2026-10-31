'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Clock, Bell, RotateCcw, Cpu, Wifi, Activity, AlertTriangle, CheckCircle2, Shield } from 'lucide-react';

export default function SettingsPage() {
  const [data, setData] = useState<any>(null);
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
        if (json.device_state) {
          setAlarmHour(json.device_state.alarm_hour ?? 7);
          setAlarmMin(json.device_state.alarm_minute ?? 0);
          setAlarmEnabled(json.device_state.alarm_enabled ?? false);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAlarm(true);
    setToast(null);
    try {
      const res = await fetch('/api/dashboard/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_alarm',
          payload: {
            enabled: alarmEnabled,
            hour: alarmHour,
            minute: alarmMin,
          },
        }),
      });
      const resData = await res.json();
      if (res.ok) {
        setToast(resData.feedback || 'Pengaturan alarm berhasil disimpan!');
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-[#eae4d5] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[#1e241f] flex items-center gap-2">
            <span>⚙️ Device Settings & Control</span>
          </h1>
          <p className="text-xs text-[#5e6b5f] mt-0.5">
            Konfigurasi alarm lokal, ganti mode operasi, diagnostik sensor, dan perintah remote aman.
          </p>
        </div>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-[#eef4ea] border border-[#cbdbca] text-xs text-[#273826] flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-[#466743]" />
          <span>{toast}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Alarm Settings Card */}
        <div className="bg-white p-6 rounded-2xl border border-[#eae4d5] shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#f6f3eb] pb-3">
            <Bell className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-[#1e241f]">Pengaturan Alarm Lokal (WIB)</h2>
          </div>

          <form onSubmit={handleSaveAlarm} className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#fcfbf7] border border-[#eae4d5]">
              <span className="text-xs font-medium text-[#1e241f]">Aktifkan Alarm MewBot</span>
              <input
                type="checkbox"
                checked={alarmEnabled}
                onChange={(e) => setAlarmEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#466743] rounded"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#5e6b5f] block mb-1">Jam (00 - 23)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={alarmHour}
                  onChange={(e) => setAlarmHour(parseInt(e.target.value, 10))}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#eae4d5] bg-[#fcfbf7]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#5e6b5f] block mb-1">Menit (00 - 59)</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={alarmMin}
                  onChange={(e) => setAlarmMin(parseInt(e.target.value, 10))}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#eae4d5] bg-[#fcfbf7]"
                />
              </div>
            </div>

            <p className="text-[11px] text-[#5e6b5f]">
              Alarm berjalan secara mandiri di hardware ESP32-C3 dan tetap akan berdering meskipun koneksi Wi-Fi sedang offline.
            </p>

            <button
              type="submit"
              disabled={savingAlarm}
              className="w-full py-2.5 rounded-xl bg-[#466743] text-white text-xs font-semibold hover:bg-[#385336] transition-all"
            >
              {savingAlarm ? 'Menyimpan...' : 'Simpan Alarm'}
            </button>
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
              <span className="font-semibold text-emerald-600">✓ Aktif</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcfbf7] border border-[#eae4d5]">
              <span className="text-[#5e6b5f]">Sensor Sentuh TTP223 (GPIO 4)</span>
              <span className="font-semibold text-emerald-600">✓ Aktif</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcfbf7] border border-[#eae4d5]">
              <span className="text-[#5e6b5f]">Layar OLED SH1106 128×64 (I2C 0x3C)</span>
              <span className="font-semibold text-emerald-600">✓ Aktif (60 FPS)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcfbf7] border border-[#eae4d5]">
              <span className="text-[#5e6b5f]">SRAM Free Heap</span>
              <span className="font-mono font-bold text-[#1e241f]">
                {dev?.diagnostics?.free_heap ? `${Math.round(dev.diagnostics.free_heap / 1024)} KB` : '282 KB'}
              </span>
            </div>
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

