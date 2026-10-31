# MewBot FrogPet — Review & Engineering Handoff

Dokumen ini disusun untuk memberikan ringkasan status teknis terkini kepada reviewer independen (ChatGPT, IoT Architect, atau Peer Engineer) tanpa memerlukan transfer berkas ZIP berukuran besar.

---

## 1. Metadata Proyek & Repositori
- **Platform Perangkat:** Nologo ESP32-C3 Super Mini (RISC-V 160MHz, 4MB Flash).
- **Display & Sensor:** OLED SH1106 128x64 I2C (`0x3C`), ADXL345 I2C (`0x53`), Touch TTP223 (GPIO4).
- **Cloud Backend:** Hosted Next.js 15 (Vercel) + Supabase PostgreSQL (RLS & Atomic FIFO Queue).
- **Git Branch:** `main`
- **Fase Saat Ini:** **PHASE 0 (Repository Inspection & Baseline Audit) Selesai**
- **Fase Berikutnya:** **PHASE 1 (Security Hardening: Auth, RLS, TLS)**

---

## 2. Integritas Aset Kritis
- **File Animasi Kodok:** `firmware/MewBot_ESP32C3/frog_pet_bitmaps.h`
- **Format:** 128x64 1-bit monochrome PROGMEM (158.7 KB)
- **Ekspresi:** 16 Ekspresi Penuh
- **Frame:** Tepat 155 Frame
- **SHA-256 Hash:** `69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2`
- **Status:** **100% Identik dengan baseline, 0 frame diubah/dihapus.**

---

## 3. Arsitektur Sistem Aktual

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Pengguna / Pasangan                          │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTPS (Browser)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Hosted Dashboard (Next.js 15 App Router)           │
│  - Home Companion & Live OLED Simulation Preview                │
│  - Love Mail Composer (Max 80 Char, FIFO Queue)                 │
│  - Message Memories (90-Day Retention), Notes, Settings        │
│  - API Gateway: /api/device/v1/poll, /api/device/v1/*           │
└───────────────────┬─────────────────────────────────────────────┘
                    │ HTTPS Client (Bearer Token)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MewBot (ESP32-C3 Super Mini)                  │
│  - Loop Kooperatif 100% Non-Blocking (Zero Delay)               │
│  - Polling HTTPS Non-blocking tiap 5 detik                      │
│  - NVS Local Storage (Mode PET/CLOCK & Alarm Persistence)       │
│  - Driver SH1106 OLED (Jam Hybrid Modern & Love Mail 15s)       │
│  - Hardware Touch (TTP223) & Gesture Akselerometer (ADXL345)    │
│  - Dual-Slot OTA Partitions (1.75 MB per slot, >520 KB Headroom)│
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Temuan Audit Kritis & Status Penyelesaian

| Area | Temuan Audit | Dampak / Risiko | Rencana Tindakan | Status |
|:---|:---|:---|:---|:---|
| **Dashboard Auth** | Dashboard terbuka untuk publik tanpa login flow atau middleware proteksi rute. | Siapa pun dengan URL dapat mengontrol MewBot. | Pasang Supabase Auth + `middleware.ts`. | **Pending (Phase 1)** |
| **Database RLS** | RLS policy menggunakan `USING (true)` pada tabel privat. | Data pesan dan perangkat tidak terisolasi antarpengguna. | Terapkan RLS ketat berbasis `auth.uid()`. | **Pending (Phase 1)** |
| **SQL Function** | `enqueue_love_mail` (`SECURITY DEFINER`) tanpa `search_path`. | Search path hijacking vulnerability. | Tambahkan `SET search_path = public`. | **Pending (Phase 1)** |
| **Firmware TLS** | ESP32-C3 menggunakan `netClient.setInsecure()`. | Rentan Man-in-the-Middle di Wi-Fi publik. | Terapkan validasi sertifikat TLS. | **Pending (Phase 1)** |
| **Konektivitas Wi-Fi**| Hanya 1 SSID statis tanpa fallback provisioning. | Perangkat offline total jika berpindah lokasi. | Implementasi Multi-Network NVS + SoftAP. | **Pending (Phase 4)** |
| **Display Love Mail** | Layar hanya muat ~54 karakter simultan; pesan 80 char terpotong. | Pesan cinta panjang tidak terbaca utuh. | Paging 2-layar atau optimasi layout OLED. | **Pending (Phase 2)** |
| **Command ACK** | Remote restart mengeksekusi reboot tanpa kirim ACK. | Status perintah di server menggantung. | Kirim ACK sebelum `ESP.restart()`. | **Pending (Phase 2)** |

---

## 5. Ringkasan Pengukuran Resource ESP32-C3
- **Ukuran Flash Binary:** 1,314,385 bytes (62.6% dari partisi 2MB, atau 71.6% dari slot OTA 1.75 MB).
- **Sisa Headroom OTA:** **520,623 bytes (508.4 KB)** per slot.
- **Static SRAM:** 38,544 bytes (11.7%).
- **Free Heap Awal:** 289,136 bytes (~282.4 KB free).
- **Hasil Kompilasi:** Lulus dengan 0 error via official Arduino CLI `esp32:esp32 v3.3.10`.
- **Hasil Build Dashboard:** Lulus dengan 0 error via `next build` (Next.js 15.5.28).

---

## 6. Berkas yang Perlu Diperiksa oleh Reviewer
1. [`docs/ENGINEERING_UPDATE_REPORT.md`](file:///c:/Users/rizki/OneDrive/Documents/MewBot_LeafPet_ClockMiniCharacter_Code%20(1)/docs/ENGINEERING_UPDATE_REPORT.md) — Laporan teknis mendalam 16 bagian.
2. [`firmware/MewBot_ESP32C3/MewBot_ESP32C3.ino`](file:///c:/Users/rizki/OneDrive/Documents/MewBot_LeafPet_ClockMiniCharacter_Code%20(1)/firmware/MewBot_ESP32C3/MewBot_ESP32C3.ino) — Loop kooperatif firmware.
3. [`firmware/partitions_mewbot_ota.csv`](file:///c:/Users/rizki/OneDrive/Documents/MewBot_LeafPet_ClockMiniCharacter_Code%20(1)/firmware/partitions_mewbot_ota.csv) — Tabel partisi dual-slot OTA.
4. [`supabase/migrations/20261031000000_create_mewbot_schema.sql`](file:///c:/Users/rizki/OneDrive/Documents/MewBot_LeafPet_ClockMiniCharacter_Code%20(1)/supabase/migrations/20261031000000_create_mewbot_schema.sql) — Skema database & RLS.
5. [`dashboard/src/app/api/device/v1/poll/route.ts`](file:///c:/Users/rizki/OneDrive/Documents/MewBot_LeafPet_ClockMiniCharacter_Code%20(1)/dashboard/src/app/api/device/v1/poll/route.ts) — Gateway polling perangkat.

---

## 7. Rekomendasi Langkah Selanjutnya
Segera lanjutkan ke **PHASE 1 (Security Hardening)**:
1. Membangun halaman login dan Next.js `middleware.ts` untuk memblokir akses publik ke dashboard privat.
2. Memperbaiki skrip migrasi Supabase untuk RLS policies yang aman dan penguncian `search_path` pada fungsi atomik.
3. Menerapkan pengamanan TLS certificate pada client firmware ESP32-C3.
