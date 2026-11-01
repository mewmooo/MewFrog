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
3. Jalankan kedua berkas migrasi SQL secara berurutan:
   - `supabase/migrations/20261031000000_create_mewbot_schema.sql` (Skema Awal)
   - `supabase/migrations/20261101000000_phase1_security_hardening.sql` (Security Hardening, Shared 2-User Model, RLS Granular, Search Path Lock, & Atomic Lease Claims)
4. Skrip ini akan secara otomatis membuat:
   - Tabel `profiles`, `devices`, `device_state`, `messages`, `device_commands`, `message_templates`, `activity_events`, dan `device_members`.
   - Model akses bersama pasangan (maksimal 2 user terdaftar per MewBot yang ditegakkan oleh trigger constraint).
   - Stored procedure atomic `enqueue_love_mail` dengan search_path terkunci dan atomic claim lease (`claim_next_love_mail`, `claim_next_device_command`).
   - Kebijakan RLS granular yang melindungi seluruh rute data privat.

---

## 3. Kompilasi & Flash Firmware ESP32-C3

### Spesifikasi Target Hardware
- **Board:** Nologo ESP32-C3 Super Mini (RISC-V 160MHz, 4MB Flash).
- **Core:** `esp32:esp32 v3.3.10`.
- **I2C Pinout:** SDA = GPIO8, SCL = GPIO9.
- **Touch Pin:** GPIO4 (TTP223 Active-High).
- **OLED Display:** SH1106 128x64 I2C (Alamat `0x3C`).
- **Akselerometer:** ADXL345 I2C (Alamat `0x53`).

### Perintah Kompilasi Resmi (Dual-Slot OTA 1.75 MB)
Gunakan Arduino CLI dengan skema partisi kustom:
```powershell
& "C:\Users\rizki\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe" compile -b esp32:esp32:nologo_esp32c3_super_mini --build-property "upload.maximum_size=1835008" --build-property "build.partitions=partitions" "firmware\MewBot_ESP32C3"
```

### Skema Partisi Dual OTA (4MB Flash)
- Skema partisi tersimpan di `firmware/MewBot_ESP32C3/partitions.csv`
- Slot `app0`: 1.75 MB (`0x10000`, size `0x1C0000` / 1,835,008 B)
- Slot `app1`: 1.75 MB (`0x1D0000`, size `0x1C0000` / 1,835,008 B)
- `otadata`: 8 KB (`0xE000`)
- Ukuran binary: **1,370,015 bytes (74.6%)**, menyisakan headroom **464,993 bytes (454.1 KB)** bebas per slot. Seluruh 155 frame bitmap animasi kodok tetap 100% utuh tanpa kompresi.

### Pemulihan Darurat Hardware USB ROM
ESP32-C3 Super Mini memiliki native USB CDC/JTAG langsung pada silikon. Jika terjadi kegagalan firmware:
1. Cabut kabel USB.
2. Tahan tombol **BOOT** (GPIO9) pada papan ESP32-C3.
3. Tancapkan kembali kabel USB ke komputer sambil tetap menahan tombol BOOT selama 2 detik.
4. Perangkat masuk ke mode ROM Bootloader bawaan pabrik yang tidak bisa ter-brick oleh software apa pun, siap di-flash ulang via USB.

---

## 4. Fitur Interaksi & Operasional MewBot

1. **Sentuhan (Touch TTP223):**
   - **Ketukan Singkat:** Beralih instan antara mode animasi kodok (`PET`) dan jam digital hybrid WIB (`CLOCK`).
   - **Tahan Sentuhan 3 Detik (Long-Press):** Masuk ke **Mode Setup Wi-Fi SoftAP** (`MewBot-Setup`, IP `192.168.4.1`) untuk konfigurasi jaringan via smartphone.
   - **Saat Love Mail Aktif:** Sentuhan pertama membalik halaman (`[1/2]` $\rightarrow$ `[2/2]`), sentuhan berikutnya menutup pesan lebih awal (early dismiss) dan mengirimkan konfirmasi ACK ke Cloud.
2. **Gerakan & Goyangan (ADXL345):**
   - **Elus Lembut:** Kodok tertawa gembira (`PET_LAUGHING`).
   - **Guncangan Sedang:** Kodok marah cemberut (`PET_ANGRY`).
   - **Guncangan Keras:** Kodok pusing berputar spiral (`PET_DIZZY`).
   - **Gerakan Saat Tidur:** Kodok kaget terbangun (`PET_SURPRISED`).
   - **Debounce Lockout 350ms:** Getaran mekanis akibat ketukan jari otomatis ditekan agar tidak salah terbaca sebagai guncangan.
3. **Love Mail Cloud Polling & Reaksi Shy:**
   - Polling non-blocking tiap 5 detik ke Vercel HTTPS Gateway dengan validasi sertifikat root CA ISRG Root X1.
   - Pesan baru menginterupsi layar dengan siklus dua tahap: Reaksi kodok malu/senang selama 1.8 detik (`PET_SHY`) diikuti kartu retro 15 detik dengan word-wrap otomatis 19 karakter/baris dan pagination multi-halaman.
   - Antrean FIFO atomic dengan claim lease (60s) mencegah duplikasi pengiriman pesan.
4. **Alarm Mandiri & Ketahanan Offline:**
   - Jam lokal didukung osilator software berbasis `millis()` dan pemulihan epoch NVS, tetap berjalan presisi saat offline.
   - Mitigasi NVS wear membatasi penulisan ke flash maksimal 1x per jam (>11 tahun umur chip).
   - Alarm lokal berbunyi tepat waktu secara mandiri tanpa memerlukan koneksi internet.
5. **Telemetri Profiling Heap & Diagnostik:**
   - Firmware memantau `min_free_heap` (peak watermark) dan `max_alloc_heap` (blok kontigu terbesar).
   - Kartu diagnostik hardware pada `/settings` menampilkan visual kesehatan heap secara real-time.

