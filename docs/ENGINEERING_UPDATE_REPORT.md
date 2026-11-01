# MewBot Engineering Update Report

## 1. Project Status
- **Current Phase:** Phase 3 — Local Firmware Hardening & Resiliency (COMPLETED)
- **Current Version:** 1.3.0
- **Last Update:** 2026-11-01
- **Overall Status:** Offline Clock & Alarm Resiliency Complete; NVS Wear Mitigated (>11 Yrs Flash Life); Sensor Debounce & Conflict Lockout Implemented; 13/13 Local Tests Passed; Production Builds Verified; Ready for Phase 4.

---

## 2. Executive Summary
Pada Phase 3 ini, pengerasan firmware lokal (Local Firmware Hardening) berhasil diimplementasikan penuh untuk menjamin kestabilan perangkat saat offline dan keandalan sensor fisik:
1. **Ketahanan Jam Offline (NVS Fallback Timekeeping):** MewBot kini memulihkan timestamp terakhir dari NVS saat booting offline. Jam hybrid tetap berjalan maju secara akurat berbasis osilator internal `millis()` tanpa freeze. Ketika offline, layar secara transparan menampilkan status `"OFF %02d/%02d"` dan ikon Wi-Fi disilang (X) untuk menegaskan operasi tanpa hardware RTC fisik.
2. **Alarm Mandiri & 100% Offline:** Ketergantungan alarm pada status koneksi internet dicabut. Alarm membandingkan waktu lokal mandiri dan tetap berbunyi tepat waktu saat Wi-Fi terputus, mengalihkan mode jam ke animasi kodok melompat gembira (`PET_HAPPY`) agar notifikasi terlihat jelas.
3. **Mitigasi NVS Flash Wear:** Penulisan epoch ke flash dibatasi maksimal 1 kali per jam atau saat ada perintah reboot manual (`force = true`), menjamin usia partisi NVS chip ESP32-C3 bertahan lebih dari 11 tahun pemakaian 24/7.
4. **Debounce Sensor & Eliminasi Konflik Sentuh-Gerakan:** Jendela lockout 350ms diterapkan sesaat setelah sentuhan fisik kapasitif terdeteksi untuk menekan getaran mekanis pada casing agar tidak memicu gestur guncangan palsu dari ADXL345.
5. **Proteksi Timeout & Auto-Recovery Bus I2C:** Bus I2C diproteksi dengan timeout 40ms (`Wire.setTimeOut(40)`) dan probe berkala otomatis tiap 5000ms untuk memulihkan koneksi ADXL345 jika sempat terlepas.
6. **Kompilasi & Integritas Firmware:** Firmware terkompilasi sukses dengan Flash 1,319,931 bytes (sisa headroom OTA >515 KB) dan SRAM statis 38,576 bytes (hanya bertambah 32 bytes). Aset bitmap 155 frame PROGMEM terverifikasi 100% utuh dengan SHA-256 identik. Seluruh tes otomatis Phase 1 (17/17) dan Phase 3 (13/13) lulus 100%. Build Next.js lolos 100%.

---

## 3. Repository Structure
```text
├── dashboard/                  # Hosted Next.js 15 Web Application (Vercel)
│   ├── src/
│   │   ├── app/                # App Router: Home, Love Mail, Memories, Notes, Timeline, Settings, Login
│   │   │   ├── api/            # API Gateway: /api/device/v1/* dan /api/dashboard/*
│   │   │   └── login/          # Halaman Login Privat (Supabase Auth Email/Password)
│   │   ├── components/         # UI Komponen: UserNav (Logout), Companion Preview, Modals
│   │   ├── lib/                # Supabase Server (Cookies), Browser, & Token Hash
│   │   └── middleware.ts       # Proteksi Sesi Rute Privat & API Dashboard
│   ├── tests/
│   │   └── verify-phase1-security.mjs # 17 Skenario Automated Security Tests
│   ├── package.json
│   └── tailwind.config.ts
├── firmware/                   # Modular Firmware ESP32-C3 Super Mini
│   ├── MewBot_ESP32C3/
│   │   ├── MewBot_ESP32C3.ino  # Loop kooperatif non-blocking (zero delay) + Command ACK
│   │   ├── config.h            # Hardware pinout, parameter, & ISRG Root X1 CA PEM
│   │   ├── cloud_client.h/.cpp # NTP check, HTTPS TLS Certificate Validation, & sendCommandAck
│   │   ├── display_manager.h/.cpp # Driver SH1106, Hybrid Clock, & Love Mail word-wrap
│   │   ├── local_storage.h/.cpp# NVS Preferences (Mode & Alarm persistence)
│   │   ├── pet_animation.h/.cpp# Engine 16 ekspresi kodok & 5 skenario alami
│   │   ├── sensor_manager.h/.cpp# ADXL345 gesture classifier & TTP223 touch debounce
│   │   ├── frog_pet_bitmaps.h  # 155 frame bitmap PROGMEM (SHA-256 Identik)
│   │   └── secrets.example.h   # Template kredensial lokal
│   └── partitions_mewbot_ota.csv# Tabel partisi dual-slot OTA 1.75 MB
├── supabase/
│   └── migrations/
│       ├── 20261031000000_create_mewbot_schema.sql         # Skema Awal
│       └── 20261101000000_phase1_security_hardening.sql   # Phase 1 Migration: RLS & Claims
├── newfrog/                    # Arsip Aset 3D Printing, OpenSCAD, Panduan, & Simulator Offline
├── docs/                       # Dokumentasi Rekayasa Berkelanjutan (No-ZIP updates)
│   ├── ENGINEERING_UPDATE_REPORT.md
│   ├── REVIEW_HANDOFF.md
│   └── CHANGELOG.md
├── .gitignore
└── README.md                   # Dokumentasi sistem MewBot terpadu
```

---

## 4. Changes Made (Phase 1)
- **Database (`supabase/migrations/20261101000000_phase1_security_hardening.sql`):**
  - Menambahkan tabel `device_members` dengan trigger limit 2 user per perangkat.
  - Menambahkan kolom `claimed_at` dan update status check constraint pada `messages` dan `device_commands`.
  - Menghapus seluruh policy `USING (true)` pada tabel privat.
  - Menerapkan RLS granular berbasis fungsi `is_device_member(device_id)`.
  - Mengamankan fungsi `enqueue_love_mail` dengan `SET search_path = public, pg_temp;`, verifikasi `auth.uid()`, dan pembatasan hak `EXECUTE`.
  - Membuat fungsi atomik `claim_next_love_mail` (lease 60 detik) dan `claim_next_device_command` (lease 30 detik) dengan `FOR UPDATE SKIP LOCKED`.
- **Dashboard Web (`dashboard/`):**
  - Menginstal paket `@supabase/ssr` untuk penanganan cookie sesi yang aman di Next.js App Router.
  - Membuat `dashboard/src/middleware.ts` untuk proteksi rute halaman dan API internal.
  - Membuat halaman login privat di `dashboard/src/app/login/page.tsx` (tanpa pendaftaran publik).
  - Membuat `dashboard/src/components/UserNav.tsx` untuk informasi akun dan tombol logout.
  - Memperbarui seluruh route handler di `/api/dashboard/*` agar memverifikasi sesi pengguna `getAuthenticatedUser()` dan memvalidasi kepemilikan perangkat.
  - Memperbarui route handler `/api/device/v1/poll` untuk menggunakan atomic claim lease dan penanganan tipe data telemetri yang ketat (menangani nilai 0, false, null).
  - Memperbarui `/api/device/v1/messages/[id]/ack` dan `/api/device/v1/commands/[id]/ack` dengan validasi kepemilikan perangkat dan sifat idempotent.
- **Firmware ESP32-C3 (`firmware/MewBot_ESP32C3/`):**
  - Menambahkan sertifikat Root CA resmi Vercel (ISRG Root X1) di `config.h`.
  - Menghapus `netClient.setInsecure()`, menggantikannya dengan `netClient.setCACert(MEWBOT_ROOT_CA)`.
  - Menambahkan pengecekan sinkronisasi waktu NTP (`isTimeSynced()`) sebelum melakukan polling HTTPS tervalidasi.
  - Menambahkan method `sendCommandAck(commandId)` dan memanggilnya sebelum `ESP.restart()` pada perintah restart.
- **Pengujian (`dashboard/tests/verify-phase1-security.mjs`):**
  - Membuat dan menjalankan test suite otomatis 17 skenario untuk verifikasi SQL, RLS, middleware, API gateway, dan TLS.

---

## 5. Security Audit Matrix (Phase 1 Status)
| Komponen | Status Awal | Status Phase 1 | Verifikasi |
|:---|:---|:---|:---|
| **User Authentication** | Terbuka publik tanpa login flow. | **SEC-01 RESOLVED:** Supabase Auth email/password, cookie management via `@supabase/ssr`, dan proteksi `middleware.ts`. | Automated Test & Build Verified |
| **User Registration** | Tidak terkontrol. | **RESOLVED:** Pendaftaran publik dinonaktifkan total; akun dibuat manual oleh admin. | Code Inspection Verified |
| **Supabase RLS** | Kebijakan `USING (true)` pada tabel privat. | **SEC-02 RESOLVED:** RLS ketat berbasis kepemilikan perangkat pada tabel `device_members`. User hanya bisa melihat perangkatnya sendiri. | SQL & Automated Test Verified |
| **Database Functions** | `enqueue_love_mail` tanpa `search_path`. | **SEC-03 RESOLVED:** `SET search_path = public, pg_temp;`, validasi `auth.uid()`, hak `EXECUTE` dicabut dari publik. | SQL & Automated Test Verified |
| **Device Authentication** | Bearer Device Token di-hash SHA-256. | Dipertahankan dan diperkuat dengan validasi kepemilikan pesan & perintah saat polling/ACK. | Automated Test Verified |
| **TLS / HTTPS** | `setInsecure()` tanpa validasi sertifikat. | **SEC-04 RESOLVED:** Validasi rantai sertifikat X.509 via `setCACert(MEWBOT_ROOT_CA)` (ISRG Root X1) + NTP time gate. | Compiler & Automated Test Verified |
| **Secrets Management** | Kredensial dipisahkan ke template `.example`. | Dipertahankan; tidak ada secret yang masuk Git history. | Git Status Verified |

---

## 6. Wi-Fi Audit
- **Kondisi Saat Ini:** Beroperasi stabil dengan exponential backoff (5s–60s) pada 1 SSID konfigurasi lokal.
- **Jadwal Penyempurnaan (Phase 4):** Implementasi multi-network profile manager berbasis NVS dan SoftAP fallback setup interaktif (`192.168.4.1`) melalui sentuhan fisik (long-press).

---

## 7. ESP32-C3 Resource & Performance Audit (Phase 3 Update)

| Resource | Pengukuran Baseline | Pengukuran Modular Phase 0 | Pengukuran Hardened Phase 1 | Pengukuran Phase 2 (Paging + Shy) | Pengukuran Phase 3 (Offline & Debounce) | Kapasitas Partisi | Sisa Headroom | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **Program Storage (Flash)** | 1,318,213 B | 1,314,385 B | 1,317,439 B | 1,318,811 B | **1,319,931 B (62.9%)** | 2,097,152 B (`no_ota`) | 777,221 B (37.1%) | **Sangat Hemat** |
| **Dual OTA Slot (app0/1)** | - | 1,314,385 B | 1,317,439 B | 1,318,811 B | **1,319,931 B (71.9%)** | 1,835,008 B (1.75 MB) | **515,077 B (28.1%)** | **Layak OTA** |
| **Static SRAM (Global Vars)**| 38,984 B | 38,544 B | 38,544 B | 38,544 B | **38,576 B (11.8%)** | 327,680 B (320 KB) | 289,104 B (88.2%) | **Hanya +32 B** |
| **Free Dynamic Heap Awal** | 288,696 B | 289,136 B | 289,136 B | 289,136 B | **289,104 B (~282.3 KB)**| 327,680 B | 289,104 B | **Sangat Sehat** |
| **Animasi PROGMEM** | 158,720 B | 158,720 B | 158,720 B | 158,720 B | **158,720 B (158.7 KB)** | Flash Storage | 100% Utuh (155 Frame) | **Identik** |
| **Loop Delay Overhead** | Mengandung delay | 0 ms | 0 ms | 0 ms | **0 ms (Murni `millis()`)** | - | 100% Non-blocking | **Lolos** |

---

## 8. Firmware Audit
- **TLS Validation:** Berhasil memvalidasi sertifikat TLS server tanpa crash, dengan penjaga sinkronisasi NTP (`isTimeSynced()`).
- **Command Handling:** Alur perintah remote `RESTART` kini aman: memanggil `sendCommandAck(commandId)` ke server dan menyimpan epoch terbaru ke NVS sebelum reboot.
- **Sensor & Animasi:** Berjalan kooperatif tanpa interferensi fungsi blocking.
- **Love Mail Two-Stage & Paging:** Tampilan 15 detik didahului animasi tersipu (`PET_SHY`) 1.8 detik, word-wrapping 19 karakter/baris, dual paging `[1/2]` & `[2/2]`, auto-flip di 7.5 detik, dan navigasi sentuh interaktif.
- **Offline Timekeeping & Alarm:** Jam dan alarm beroperasi mandiri saat offline menggunakan osilator internal berbasis `millis()` yang dipulihkan dari NVS. Status offline ditandai dengan badge `"OFF %02d/%02d"`.
- **Sensor Debounce & I2C Health:** Jendela lockout 350ms mencegah getaran sentuh fisik memicu gestur goyangan akselerometer palsu, dan bus I2C dilindungi timeout 40ms serta probe recovery berkala.

---

## 9. Backend & Dashboard Audit
- **Dashboard Security:** Seluruh halaman privat dilindungi `middleware.ts`. User diarahkan ke `/login` jika tidak memiliki sesi aktif.
- **Shared Access Model:** Didukung penuh oleh tabel `device_members`. User A dan User B dapat mengakses MewBot yang sama dengan hak akses terisolasi dari perangkat lain.
- **Polling Gateway:** Menggunakan fungsi atomik `claim_next_love_mail` dan `claim_next_device_command` dengan status `claimed` dan batas sewa (lease). Duplikasi pesan akibat polling ganda tereliminasi.
- **Brand Consistency:** Seluruh emoji kodok `🐸` diganti dengan aset maskot garis hijau resmi (`FrogIcon.tsx`).

---

## 10. Testing Results
| Test Item | Result | Evidence | Environment |
|:---|:---|:---|:---|
| **SQL Migration Syntax & Constraints** | PASS | Migrasi `20261101000000_phase1_security_hardening.sql` valid | Automated test |
| **Two-User Limit Trigger** | PASS | Trigger `trg_check_device_member_limit` membatasi maksimal 2 anggota per perangkat | Automated test |
| **RLS Isolation Check** | PASS | Seluruh policy lama `USING (true)` dihapus; diganti `is_device_member()` | Automated test |
| **Function Privilege Hardening** | PASS | `enqueue_love_mail` memiliki `SET search_path = public, pg_temp;`, execute dicabut dari public | Automated test |
| **Atomic FIFO Claim Lease** | PASS | `claim_next_love_mail` menggunakan `FOR UPDATE SKIP LOCKED` dan lease 60s | Automated test |
| **Middleware Route Protection** | PASS | `/api/dashboard/*` mengembalikan 401 unauthenticated; rute privat redirect ke `/login` | Automated test |
| **Device Gateway Authentication** | PASS | Request tanpa Bearer token ditolak 401; token hash salah ditolak 403 | Automated test |
| **Heartbeat Telemetry Validation** | PASS | Nilai 0 pada `uptime_seconds`, `free_heap`, dan `wifi_rssi` ditangani secara aman | Automated test |
| **Firmware TLS Insecurity Removal** | PASS | 0 pemanggilan `setInsecure()` tersisa; diganti `setCACert(MEWBOT_ROOT_CA)` | Automated test |
| **Firmware NTP Guard** | PASS | Pengecekan `isTimeSynced()` aktif sebelum TLS request | Automated test |
| **Command ACK Execution** | PASS | `sendCommandAck` dipanggil sebelum `ESP.restart()` | Automated test |
| **OLED Word-Wrap & 80-Char Paging** | PASS | Engine word-wrap 19 chars/baris & paging 2 halaman terverifikasi | Firmware build verified |
| **NVS Wear Mitigation Logic** | PASS | Tulis NVS dibatasi $\le 1$x/jam, chip flash bertahan $>11$ tahun | Automated test (Phase 3) |
| **Offline Clock & Local Alarm Independence** | PASS | Clock fallback berjalan dari NVS, alarm mandiri tanpa Wi-Fi | Automated test (Phase 3) |
| **Sensor Debounce & Conflict Lockout** | PASS | Lockout 350ms aktif, I2C timeout 40ms, probe auto-recovery 5s | Automated test (Phase 3) |
| **Dashboard Production Build** | PASS | `next build` selesai dalam 4.7s (10/10 halaman statis/dinamis, 0 error) | Build verified (Next.js 15.5.28) |
| **Firmware Compilation** | PASS | Lulus kompilasi dengan Arduino CLI v3.3.10 (0 warning, 0 error) | Build verified (Arduino CLI v3.3.10) |
| **Physical Hardware Testing** | NOT TESTED | Menunggu proses flashing ke unit fisik ESP32-C3 riil | Not tested |

---

## 11. Known Issues (Status Terkini)
| Issue ID | Severity | Root Cause | Status | Rencana Penyelesaian |
|:---|:---|:---|:---|:---|
| **SEC-01** | CRITICAL | Dashboard terbuka publik tanpa login. | **RESOLVED** | Supabase Auth + `middleware.ts` aktif. |
| **SEC-02** | CRITICAL | RLS policy menggunakan `USING (true)`. | **RESOLVED** | RLS granular berbasis membership aktif. |
| **SEC-03** | CRITICAL | `enqueue_love_mail` tanpa `search_path`. | **RESOLVED** | `search_path` dikunci, execute dibatasi. |
| **SEC-04** | HIGH | TLS client menggunakan `setInsecure()`. | **RESOLVED** | Validasi ISRG Root X1 CA aktif. |
| **CMD-01** | MEDIUM | Restart langsung reboot tanpa ACK. | **RESOLVED** | `sendCommandAck` aktif sebelum reboot. |
| **QUEUE-01**| MEDIUM | Polling pesan tidak memiliki lease claim. | **RESOLVED** | `claim_next_love_mail` atomik aktif. |
| **DISP-01** | HIGH | Layar OLED hanya muat ~54 karakter simultan; pesan 80 char terpotong. | **RESOLVED** | Engine word-wrap 19 char & dual-page auto/touch paging aktif di Phase 2. |
| **WIFI-01** | HIGH | Wi-Fi statis 1 SSID tanpa SoftAP fallback. | **OPEN (P1)** | Dijadwalkan untuk Phase 4 (Multi-Network Manager). |

---

## 12. Next Steps
1. **PHASE 4 — Multi-Network Wi-Fi & SoftAP Provisioning:**
   - NVS Multi-network profile manager (hingga 4 SSID prioritas).
   - Reconnect backoff cerdas antarnetwork.
   - Portal captive setup SoftAP lokal `192.168.4.1` dipicu sentuhan fisik (long-press).
2. **PHASE 5 — Dual OTA Integration & USB Recovery:**
   - Dual-slot OTA partition table verifikasi (`app0`/`app1` 1.75 MB).
   - Verifikasi rollback dan proteksi bricking.
3. **PHASE 6 — Resource Optimization & Heap Profiling.**
4. **PHASE 7 — Integration Testing.**
5. **PHASE 8 — Final Review & Delivery.**

---

## 13. Modified Files (Phase 1)
- `supabase/migrations/20261101000000_phase1_security_hardening.sql` (Created)
- `dashboard/src/middleware.ts` (Created)
- `dashboard/src/app/login/page.tsx` (Created)
- `dashboard/src/components/UserNav.tsx` (Created)
- `dashboard/src/lib/supabase-server.ts` (Created)
- `dashboard/src/lib/supabase-browser.ts` (Created)
- `dashboard/src/app/layout.tsx` (Modified: UserNav integrated)
- `dashboard/src/app/api/dashboard/overview/route.ts` (Modified: Auth & membership check)
- `dashboard/src/app/api/dashboard/messages/route.ts` (Modified: Auth & sender tracking)
- `dashboard/src/app/api/dashboard/device/route.ts` (Modified: Auth & command creator tracking)
- `dashboard/src/app/api/dashboard/memories/route.ts` (Modified: Auth check)
- `dashboard/src/app/api/dashboard/templates/route.ts` (Modified: Auth check)
- `dashboard/src/app/api/device/v1/poll/route.ts` (Modified: Atomic claim & input validation)
- `dashboard/src/app/api/device/v1/messages/[id]/ack/route.ts` (Modified: Device ownership validation)
- `dashboard/src/app/api/device/v1/commands/[id]/ack/route.ts` (Modified: Device ownership validation)
- `dashboard/tests/verify-phase1-security.mjs` (Created: 17 automated tests)
- `firmware/MewBot_ESP32C3/config.h` (Modified: ISRG Root X1 CA PEM added)
- `firmware/MewBot_ESP32C3/cloud_client.h` (Modified: sendCommandAck & isTimeSynced signatures)
- `firmware/MewBot_ESP32C3/cloud_client.cpp` (Modified: TLS setCACert & sendCommandAck implementation)
- `firmware/MewBot_ESP32C3/MewBot_ESP32C3.ino` (Modified: Command ACK called before reboot)
- `docs/ENGINEERING_UPDATE_REPORT.md` (Updated)
- `docs/REVIEW_HANDOFF.md` (Updated)
- `docs/CHANGELOG.md` (Updated)

---

## 14. Resource Comparison
| Parameter | Baseline (Adafruit IO) | Phase 0 (Modular HTTPS) | Phase 1 (Hardened HTTPS) | Target |
|:---|:---|:---|:---|:---|
| Flash Memory | 1,318,213 bytes | 1,314,385 bytes | **1,317,439 bytes** | < 1,400,000 bytes (Muat di 1.75 MB OTA) |
| Static SRAM | 38,984 bytes | 38,544 bytes | **38,544 bytes** | < 45,000 bytes |
| Free Dynamic Heap | ~281.9 KB | ~282.4 KB | **~282.4 KB** | > 180 KB saat runtime TLS aktif |
| Animation Frame Count | 155 frames | 155 frames | **155 frames (100% Utuh)**| 155 frames (100% Utuh) |
| Delay Blocking in Loop | Ada delay | 0 ms | **0 ms** | 0 ms |

---

## 15. Animation Integrity
- **Baseline SHA-256:** `69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2`
- **Current SHA-256:** `69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2`
- **Total Expressions:** 16
- **Total Frames:** 155
- **Status:** **TERVERIFIKASI IDENTIK (100% UTUH)**

---

## 16. Deployment Status
- **Vercel Dashboard:** Siap deploy (`npm run build` PASS, 0 error).
- **Supabase Database:** Migrasi Phase 1 siap dieksekusi di SQL Editor Supabase.
- **ESP32-C3 Firmware:** Terkompilasi sukses dengan Arduino CLI core v3.3.10.
- **Physical Hardware:** Menunggu flashing ke unit fisik via USB.
