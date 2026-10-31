# MewBot — Panduan Sistem & Dokumentasi Integrasi End-to-End

Sistem MewBot terdiri dari tiga komponen utama:
1. **Firmware ESP32-C3 Modular** (`firmware/MewBot_ESP32C3/`): Arsitektur C++ murni non-blocking, rendering 16 ekspresi kodok pixel art (155 frame), driver OLED SH1106, I2C Fast Mode (400kHz), sensor sentuh TTP223, akselerometer ADXL345, jam hybrid WIB, dan klien HTTPS polling 5 detik.
2. **Hosted Dashboard Next.js** (`dashboard/`): Antarmuka web modern siap deploy ke Vercel (Next.js 16 App Router, Tailwind CSS, Lucide icons) yang menyediakan Home Companion, Love Mail Composer dengan simulasi live OLED, Message Memories 90 hari, Quick Love Notes, Activity Timeline, dan Device Settings.
3. **Supabase Database & Backend** (`supabase/migrations/`): Skema PostgreSQL dengan Row Level Security (RLS), antrean pesan FIFO atomic (`enqueue_love_mail`), retensi memories 90 hari, dan gateway polling API.

---

## 1. Konfigurasi Kredensial & Secrets

### A. Firmware ESP32-C3
1. Salin template kredensial:
   ```powershell
   Copy-Item "firmware\MewBot_ESP32C3\secrets.example.h" "firmware\MewBot_ESP32C3\secrets.h"
   ```
2. Buka `firmware\MewBot_ESP32C3\secrets.h` dan sesuaikan parameter berikut:
   - `WIFI_SSID`: Nama SSID Wi-Fi rumah (2.4 GHz).
   - `WIFI_PASSWORD`: Password Wi-Fi.
   - `MEWBOT_API_HOST`: Host domain dashboard Vercel Anda (misal `mewbot-dashboard.vercel.app` tanpa `https://`).
   - `MEWBOT_DEVICE_ID`: UUID perangkat terdaftar di Supabase (misal `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`).
   - `MEWBOT_DEVICE_TOKEN`: Device token rahasia yang dicocokkan dengan hash SHA-256 pada Supabase.

### B. Dashboard Vercel / Next.js
1. Salin file environment:
   ```powershell
   Copy-Item "dashboard\.env.example" "dashboard\.env.local"
   ```
2. Isi variabel lingkungan:
   - `NEXT_PUBLIC_SUPABASE_URL`: Endpoint proyek Supabase (`https://<project-ref>.supabase.co`).
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Kunci anon/public Supabase untuk query RLS frontend.
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key untuk endpoint API route `/api/device/v1/*` dan verifikasi hash token perangkat.
   - `DEVICE_POLL_SECRET`: Kunci enkripsi/signing internal untuk HMAC handshake.

---

## 2. Setup Database Supabase

1. Buka dashboard proyek Supabase Anda.
2. Masuk ke menu **SQL Editor**.
3. Jalankan seluruh isi skrip migrasi yang telah dioptimasi:
   `supabase/migrations/20261031000000_create_mewbot_schema.sql`
4. Skrip ini akan secara otomatis membuat:
   - Tabel `profiles`, `devices`, `device_state`, `messages`, `device_commands`, `message_templates`, `activity_events`.
   - Partial index performa tinggi: `idx_messages_fifo_queue` dan `idx_messages_memories`.
   - Stored procedure atomic `enqueue_love_mail` dengan row-level locking untuk mencegah race condition.
   - RLS Policies granular yang melindungi data pengguna dan membatasi akses perangkat.

---

## 3. Kompilasi & Flash Firmware ESP32-C3

### Spesifikasi Target Hardware
- **Board:** Nologo ESP32-C3 Super Mini (RISC-V 160MHz, 4MB Flash).
- **Core:** `esp32:esp32 v3.3.10`.
- **I2C Pinout:** SDA = GPIO8, SCL = GPIO9.
- **Touch Pin:** GPIO4 (TTP223 Active-High).
- **OLED Display:** SH1106 128x64 I2C (Alamat `0x3C`).
- **Akselerometer:** ADXL345 I2C (Alamat `0x53`).

### Perintah Kompilasi
Gunakan Arduino CLI resmi:
```powershell
& "C:\Users\rizki\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe" compile -b esp32:esp32:nologo_esp32c3_super_mini:PartitionScheme=no_ota "firmware\MewBot_ESP32C3"
```

### Skema Partisi Dual OTA (4MB Flash)
Untuk update Over-The-Air (OTA) tanpa menghapus 155 frame animasi kodok:
- Gunakan skema `firmware/partitions_mewbot_ota.csv`
- Slot `app0`: 1.75 MB (`0x1C0000`)
- Slot `app1`: 1.75 MB (`0x1C0000`)
- Menjamin sisa headroom >400 KB untuk pertumbuhan kode di masa depan.

---

## 4. Fitur Interaksi MewBot

1. **Sentuhan (Touch TTP223):**
   - **Saat Normal:** Beralih instan antara mode animasi kodok (`PET`) dan jam digital hybrid WIB (`CLOCK`). Preferensi tersimpan otomatis di NVS Flash.
   - **Saat Love Mail Aktif:** Menutup tampilan surat cinta lebih awal (early dismiss) dan mengirimkan konfirmasi ACK ke Cloud.
2. **Gerakan & Goyangan (ADXL345):**
   - **Elus Lembut:** Kodok tertawa gembira (`PET_LAUGHING`).
   - **Guncangan Sedang:** Kodok marah cemberut (`PET_ANGRY`).
   - **Guncangan Keras / Double Tap:** Kodok pusing berputar spiral (`PET_DIZZY`).
   - **Gerakan Saat Tidur:** Kodok kaget terbangun (`PET_SURPRISED`).
3. **Love Mail Cloud Polling:**
   - Polling non-blocking tiap 5 detik ke Vercel HTTPS Gateway.
   - Pesan baru otomatis menginterupsi layar selama 15 detik, dilengkapi countdown progress bar dan animasi amplop retro.
   - Antrean FIFO atomic menjamin surat ditampilkan satu per satu secara berurutan.
4. **Alarm & Offline Resilience:**
   - Jam lokal, sensor sentuh, akselerometer, dan seluruh animasi kodok tetap berfungsi 100% secara offline jika koneksi Wi-Fi terputus.
   - Mekanisme exponential backoff mencegah pemborosan daya dan beban CPU saat reconnecting.

