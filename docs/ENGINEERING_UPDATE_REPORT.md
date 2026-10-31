# MewBot Engineering Update Report

## 1. Project Status
- **Current Phase:** Phase 0 — Repository Inspection & Baseline Audit
- **Current Version:** 1.0.0
- **Last Update:** 2026-11-01
- **Overall Status:** Baseline Verified & Audited; Phase 0 Completed; Ready for Phase 1 (Security Hardening)

---

## 2. Executive Summary
Audit komprehensif terhadap seluruh repository MewBot FrogPet telah diselesaikan. Seluruh komponen sistem—meliputi Firmware ESP32-C3 modular non-blocking, Hosted Next.js Dashboard, Supabase PostgreSQL Schema & RLS, serta aset animasi kodok 155 frame—telah diinspeksi secara mendalam. 

Integritas aset animasi (`frog_pet_bitmaps.h`) telah diverifikasi dengan SHA-256 hash dan terbukti 100% identik dengan baseline (16 ekspresi / 155 frame utuh). Arsitektur partisi dual-slot OTA (1.75 MB per slot) pada flash 4MB diverifikasi layak dengan sisa headroom >520 KB per slot.

Ditemukan beberapa kelemahan kritis yang harus segera diperbaiki sebelum deployment produksi:
1. **Keamanan Autentikasi:** Dashboard Next.js saat ini belum memiliki login flow atau middleware proteksi rute; endpoint `/api/dashboard/*` dapat diakses secara publik.
2. **Keamanan Supabase RLS:** Kebijakan RLS saat ini menggunakan `USING (true)` pada tabel privat dan fungsi `enqueue_love_mail` (`SECURITY DEFINER`) belum mengunci `search_path`.
3. **Validasi TLS Firmware:** ESP32-C3 saat ini menggunakan `netClient.setInsecure()` tanpa validasi sertifikat root/bundle.
4. **Konektivitas Wi-Fi:** Masih mengandalkan 1 SSID statis tanpa multi-network manager atau fallback SoftAP provisioning.
5. **Display Love Mail:** Layout OLED saat ini hanya muat ~54 karakter teks secara simultan, sehingga pesan 80 karakter berisiko terpotong.
6. **Command ACK:** Perintah remote restart langsung mengeksekusi reboot tanpa mengirimkan ACK ke server.

---

## 3. Repository Structure
```text
├── dashboard/                  # Hosted Next.js 15 Web Application (Vercel)
│   ├── src/
│   │   ├── app/                # App Router: Home, Love Mail, Memories, Notes, Timeline, Settings
│   │   │   ├── api/            # API Gateway: /api/device/v1/* dan /api/dashboard/*
│   │   ├── components/         # UI Komponen: Navigation, Modal, Companion Preview
│   │   └── lib/                # Supabase client & token hash utilities
│   ├── package.json
│   └── tailwind.config.ts
├── firmware/                   # Modular Firmware ESP32-C3 Super Mini
│   ├── MewBot_ESP32C3/
│   │   ├── MewBot_ESP32C3.ino  # Loop kooperatif non-blocking (zero delay)
│   │   ├── config.h            # Hardware pinout (I2C SDA=8, SCL=9, Touch=4) & konstanta
│   │   ├── cloud_client.h/.cpp # Background Wi-Fi backoff, NTP WIB, & HTTPS gateway polling
│   │   ├── display_manager.h/.cpp # Driver SH1106, Hybrid Clock, & Love Mail word-wrap
│   │   ├── local_storage.h/.cpp# NVS Preferences (Mode & Alarm persistence)
│   │   ├── pet_animation.h/.cpp# Engine 16 ekspresi kodok & 5 skenario alami
│   │   ├── sensor_manager.h/.cpp# ADXL345 gesture classifier & TTP223 touch debounce
│   │   ├── frog_pet_bitmaps.h  # 155 frame bitmap PROGMEM (158.7 KB)
│   │   └── secrets.example.h   # Template kredensial lokal
│   └── partitions_mewbot_ota.csv# Tabel partisi dual-slot OTA 1.75 MB
├── supabase/
│   └── migrations/
│       └── 20261031000000_create_mewbot_schema.sql # 7 tabel, RLS, & FIFO queue atomic
├── newfrog/                    # Arsip Aset 3D Printing, OpenSCAD, Panduan, & Simulator Offline
│   ├── *.stl, *.scad           # Model casing 3D
│   ├── simulator.html          # Web simulasi casing Three.js
│   └── *.md, *.py              # Panduan skematik & perakitan
├── docs/                       # Dokumentasi Rekayasa Berkelanjutan (No-ZIP updates)
│   ├── ENGINEERING_UPDATE_REPORT.md
│   ├── REVIEW_HANDOFF.md
│   └── CHANGELOG.md
├── .gitignore                  # Mengabaikan build, secrets, dan node_modules
└── README.md                   # Panduan integrasi sistem MewBot
```

---

## 4. Changes Made (Phase 0)
- **Repositori & Version Control:** Menginisialisasi repositori Git resmi dengan branch utama `main`.
- **Integritas Aset Animasi:** Menghitung dan mencocokkan SHA-256 hash pada `frog_pet_bitmaps.h`.
- **Audit Kode & Arsitektur:** Memeriksa seluruh source code firmware, API routes, dan Supabase migrations terhadap spesifikasi teknis.
- **Sistem Dokumentasi:** Membuat struktur folder `docs/` dan dokumen pelaporan teknis berkelanjutan (`ENGINEERING_UPDATE_REPORT.md`, `REVIEW_HANDOFF.md`, `CHANGELOG.md`).

---

## 5. Security Audit
| Komponen | Status Saat Ini | Risiko / Temuan | Rencana Mitigasi (Phase 1) |
|:---|:---|:---|:---|
| **User Authentication** | Belum ada login flow; rute dashboard terbuka publik. | Siapa pun yang mengetahui URL dapat mengontrol perangkat. | Implementasikan Supabase Auth (Email/Password), session cookie management, dan `middleware.ts` untuk proteksi rute. |
| **User Management** | Publik signup belum dibatasi secara eksplisit. | Potensi pendaftaran akun yang tidak diinginkan. | Nonaktifkan pendaftaran publik; terapkan pembuatan akun manual oleh admin. |
| **Supabase RLS** | Menggunakan `USING (true)` untuk seluruh authenticated users. | Data antarpengguna tidak terisolasi. | Restriksi RLS berbasis `auth.uid()` dan relasi kepemilikan perangkat. |
| **Database Functions** | `enqueue_love_mail` (`SECURITY DEFINER`) tanpa `search_path`. | Search path hijacking vulnerability. | Tambahkan `SET search_path = public` dan batasi `GRANT EXECUTE`. |
| **Device Authentication** | Menggunakan Bearer Device Token di-hash dengan SHA-256 di database. | Sudah baik, token rahasia tidak disimpan dalam plain text. | Tambahkan mekanisme status revocation dan pairing flow yang terisolasi. |
| **TLS / HTTPS** | Menggunakan `netClient.setInsecure()` pada ESP32-C3. | Rentan terhadap serangan Man-in-the-Middle (MitM). | Terapkan validasi sertifikat CA atau certificate bundle yang sesuai dengan ESP32-C3. |
| **Secrets Management** | Kredensial dipisahkan ke `secrets.example.h` dan `.env.example`. File riil diabaikan oleh `.gitignore`. | Aman, tidak ada secret riil yang masuk repositori. | Pertahankan aturan kebersihan secrets pada setiap commit. |

---

## 6. Wi-Fi Audit
- **Kondisi Saat Ini:** Firmware mengandalkan satu pasangan `WIFI_SSID` dan `WIFI_PASSWORD` yang didefinisikan saat kompilasi. Jika koneksi gagal, sistem menjalankan exponential backoff (5s s/d 60s).
- **Kelemahan:**
  1. Perangkat tidak dapat berpindah jaringan secara dinamis saat dibawa bepergian (multi-lokasi).
  2. Tidak ada mekanisme fallback SoftAP provisioning jika router mati atau berganti password.
- **Rencana Peningkatan (Phase 4):**
  1. Multi-network profile manager berbasis NVS Preferences (hingga 4 profil jaringan tersimpan).
  2. Fallback SoftAP Provisioning (`192.168.4.1`) yang dapat diaktifkan melalui gesture sentuhan fisik (long-press touch).
  3. Pengamanan AP setup dengan timeout otomatis dan proteksi password acak/unik per perangkat.

---

## 7. ESP32-C3 Resource & Performance Audit
Pengukuran kompilasi dilakukan menggunakan Arduino CLI resmi core `esp32:esp32 v3.3.10`:

| Resource | Pengukuran Baseline | Pengukuran Modular Native | Kapasitas Tersedia | Sisa / Headroom | Status |
|:---|:---|:---|:---|:---|:---|
| **Program Storage (Flash)** | 1,318,213 B (62.8%) | 1,314,385 B (62.6%) | 2,097,152 B (no_ota) | 782,767 B (37.4%) | **Aman** |
| **OTA Slot (Dual-Slot)** | - | 1,314,385 B (71.6%) | 1,835,008 B (1.75 MB) | **520,623 B (28.4%)** | **Layak OTA** |
| **Static SRAM (Global Vars)** | 38,984 B (11.9%) | 38,544 B (11.7%) | 327,680 B (320 KB) | 289,136 B (88.3%) | **Sangat Sehat** |
| **Static Heap Free** | 288,696 B | 289,136 B (~282.4 KB) | 327,680 B | 289,136 B | **Sangat Sehat** |
| **Animasi PROGMEM** | 158,720 B (158.7 KB) | 158,720 B (158.7 KB) | Flash Storage | 100% Utuh (155 Frame) | **Identik** |
| **Loop Delay** | Zero delay | Zero delay | - | 100% Non-blocking | **Lolos** |

---

## 8. Firmware Audit
- **Animasi & OLED:** 16 ekspresi kodok monokrom 128x64 berjalan lancar berbasis timer kooperatif `millis()`.
- **Sensor Touch (TTP223):** Debouncing non-blocking 50ms berfungsi untuk toggle PET/CLOCK dan early dismiss Love Mail.
- **Akselerometer (ADXL345):** Klasifikasi 3 tingkat gestur (elus, guncang sedang, guncang keras) berjalan pada frekuensi 10Hz non-blocking.
- **Clock & Alarm:** Bekerja mandiri secara lokal. Sinkronisasi WIB via NTP saat online.
- **Love Mail Display:** Berjalan 15 detik dengan word-wrap dan shrinking countdown bar. Ditemukan keterbatasan kapasitas baris teks untuk pesan 80 karakter (perlu optimalisasi layout pada Phase 2).
- **Command Handling:** Ditemukan bug di mana perintah `RESTART` langsung mereboot chip tanpa mengirimkan ACK ke server (perlu diperbaiki pada Phase 2).

---

## 9. Backend & Dashboard Audit
- **Framework:** Next.js 15 (App Router, Tailwind CSS, Lucide Icons).
- **Kompilasi:** Build produksi `next build` berhasil 100% dengan 0 type error dan 0 lint error.
- **Halaman Utama:** Home Companion, Love Mail Composer dengan live OLED preview, Message Memories (90 hari), Quick Love Notes, Activity Timeline, dan Device Settings.
- **API Gateway:**
  - `POST /api/device/v1/poll`: Polling heartbeat, message queue check, desired state check, dan command dispatch.
  - `POST /api/device/v1/messages/[id]/ack`: Konfirmasi penerimaan pesan oleh perangkat.
  - `POST /api/device/v1/commands/[id]/ack`: Konfirmasi eksekusi perintah oleh perangkat.
- **Supabase Integration:** Skema 7 tabel dengan stored procedure atomic `enqueue_love_mail` (membatasi antrean maksimum 10 pesan pending).

---

## 10. Testing Results
| Test Item | Result | Evidence | Environment |
|:---|:---|:---|:---|
| **Bitmap Hash Verification** | PASS | SHA-256 `69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2` identik | Static inspection |
| **Firmware Compilation** | PASS | `Sketch uses 1314385 bytes, Global variables use 38544 bytes` (0 error) | Build verified (Arduino CLI v3.3.10) |
| **Dashboard Next.js Build** | PASS | `next build` selesai dalam 15.9s (9/9 static pages generated, 0 error) | Build verified (Next.js 15.5.28) |
| **Offline Loop Resilience** | PASS | Tidak ada pemanggilan fungsi blocking `delay()` pada siklus loop normal | Static inspection |
| **Dual OTA Math Validation** | PASS | Total layout 0x3F0000 (3.93 MB) muat dalam 4MB fisik dengan >520 KB per slot | Static inspection |
| **Physical Hardware Interaction** | NOT TESTED | Belum dijalankan pada unit fisik ESP32-C3 langsung | Not tested |

---

## 11. Known Issues
| Issue ID | Severity | Root Cause | Suggested Fix | Priority |
|:---|:---|:---|:---|:---|
| **SEC-01** | CRITICAL | Belum ada session authentication & middleware proteksi rute di Next.js dashboard. | Buat login page, session handler via Supabase Auth, dan `middleware.ts`. | P0 |
| **SEC-02** | CRITICAL | RLS policies di database menggunakan `USING (true)` untuk semua authenticated users. | Restriksi RLS berbasis kepemilikan perangkat dan user id. | P0 |
| **SEC-03** | CRITICAL | Fungsi `enqueue_love_mail` belum menetapkan `SET search_path = public`. | Tambahkan parameter keamanan eksplisit pada skrip migrasi. | P0 |
| **SEC-04** | HIGH | TLS client di firmware menggunakan `setInsecure()`. | Terapkan CA root certificate validation untuk Vercel. | P1 |
| **WIFI-01** | HIGH | Kredensial Wi-Fi statis 1 SSID tanpa fallback provisioning. | Implementasikan multi-network NVS storage dan SoftAP fallback setup. | P1 |
| **DISP-01** | HIGH | Layout Love Mail OLED hanya muat ~54 karakter simultan; teks 80 karakter berisiko terpotong. | Optimalkan dimensi layout atau terapkan auto-paging 2 halaman untuk pesan panjang. | P1 |
| **CMD-01** | MEDIUM | Firmware tidak mengirim ACK sebelum mengeksekusi remote restart. | Panggil `cloudClient.sendCommandAck(commandId)` sebelum reboot. | P2 |
| **QUEUE-01** | MEDIUM | Polling gateway tidak mengunci status pesan ke 'claimed' saat dikirimkan. | Implementasikan status claim sementara atau lease expiry untuk mencegah duplikasi poll. | P2 |

---

## 12. Next Steps
Urutan pengerjaan bertahap sesuai master framework:
1. **PHASE 1 — Security Hardening:**
   - Membangun Supabase Auth (Login/Session) dan `middleware.ts` untuk memproteksi dashboard privat.
   - Memperbaiki RLS policies dan fungsi `enqueue_love_mail` (`search_path`).
   - Menerapkan validasi TLS certificate pada `NetworkClientSecure` di firmware.
2. **PHASE 2 — Cloud & Love Mail Queue Optimization:**
   - Menyempurnakan status siklus hidup pesan (idempotency, claim lease, ACK).
   - Memperbaiki display layout OLED agar 80 karakter terbaca utuh dan estetik.
   - Memperbaiki penanganan command remote restart dan pengiriman command ACK.
3. **PHASE 3 — Local Firmware Hardening:**
   - Menyempurnakan fallback clock saat boot offline tanpa RTC.
   - Pengecekan debounce sensor dan NVS flash write-cycle longevity.
4. **PHASE 4 — Multi-Network Wi-Fi & SoftAP Provisioning:**
   - NVS Multi-network profile manager.
   - Web server SoftAP lokal `192.168.4.1` dengan portal setup interaktif via long-press touch.
5. **PHASE 5 — OTA Evaluation & Implementation:**
   - Validasi skema partisi kustom pada build system dan endpoint pembaruan firmware HTTPS.
6. **PHASE 6 — Resource & Concurrency Optimization:**
   - Profiling heap runtime, optimasi buffer JSON, dan eliminasi fragmentasi memory.
7. **PHASE 7 — End-to-End Integration Testing & Verification.**
8. **PHASE 8 — Final Review & Comprehensive Documentation Delivery.**

---

## 13. Modified Files (Phase 0)
- `docs/ENGINEERING_UPDATE_REPORT.md` (Created)
- `docs/REVIEW_HANDOFF.md` (Created)
- `docs/CHANGELOG.md` (Created)
- `.gitignore` (Verified)

---

## 14. Resource Comparison
| Parameter | Baseline (Adafruit IO) | Kondisi Terkini (Modular HTTPS) | Target Akhir |
|:---|:---|:---|:---|
| Flash Memory | 1,318,213 bytes | 1,314,385 bytes | < 1,400,000 bytes (Muat di 1.75 MB OTA) |
| Static SRAM | 38,984 bytes | 38,544 bytes | < 45,000 bytes |
| Free Dynamic Heap | ~281.9 KB | ~282.4 KB | > 180 KB saat runtime TLS aktif |
| Animation Frame Count | 155 frames | 155 frames | 155 frames (100% Utuh) |
| Delay Blocking in Loop | Ada (`delay` di beberapa aksi) | 0 ms (Murni `millis()`) | 0 ms |

---

## 15. Animation Integrity
- **Baseline SHA-256:** `69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2`
- **Current SHA-256:** `69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2`
- **Total Expressions:** 16
- **Total Frames:** 155
- **Resolution:** 128x64 monokrom (1024 bytes/frame)
- **Status:** **TERVERIFIKASI IDENTIK (100% UTUH)**

---

## 16. Deployment Status
- **Vercel Dashboard:** Siap deploy (`npm run build` PASS, 0 error).
- **Supabase Database:** Skema migrasi siap dieksekusi di SQL Editor.
- **ESP32-C3 Firmware:** Terkompilasi sukses dengan Arduino CLI core v3.3.10.
- **Physical Hardware:** Menunggu flashing ke unit fisik via USB.
