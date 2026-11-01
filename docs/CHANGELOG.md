# MewBot Changelog

Semua perubahan yang terdokumentasi di bawah ini mencatat perkembangan teknis proyek MewBot FrogPet berdasarkan fase pengerjaan bertahap.

---

## [1.2.0] — 2026-11-01

### Phase 2 — Cloud & Love Mail Queue Optimization + Custom Frog Icon

#### Added
- **Custom Frog Icon Branding:** Mengintegrasikan aset ilustrasi garis hijau maskot kodok kustom (`media_1793491390455_4dd149f6.png` -> `dashboard/public/mewbot-frog.png`) ke seluruh UI Dashboard Next.js, menggantikan seluruh emoji generik `🐸` dan SVG default.
- **Komponen Reusable `FrogIcon`:** Dibuat komponen `dashboard/src/components/FrogIcon.tsx` berbasis `next/image` dengan properti ukuran, class styling Tailwind, dan prioritas render optimal.
- **Word-Wrap & Smart Paging OLED (DISP-01 Resolved):** Algoritma pemecah kata (word-wrap) 19 karakter/baris pada `firmware/MewBot_ESP32C3/display_manager.cpp` dengan pemisahan cerdas hingga 8 baris teks.
- **Dual-Page Paging 80 Karakter:** Dukungan pesan teks hingga 80 karakter dengan badge header `LOVE MAIL [1/2]` dan `LOVE MAIL [2/2]`.
- **Two-Stage Visual Cycle Love Mail:**
  - *Fase 1 (1.8 detik):* Karakter kodok bereaksi malu dan tersipu (`PET_SHY`) sesaat setelah surat cinta tiba.
  - *Fase 2 (15 detik):* Transisi otomatis ke tampilan kartu retro surat cinta lengkap dengan garis hitung mundur progres bar.
- **Interaksi Sentuh Multi-Page:** Sentuhan pada sensor TTP223 membalik halaman `[1/2]` ke `[2/2]` seketika, dan sentuhan pada halaman akhir menutup pesan lebih awal dengan mengirimkan ACK seketika serta memicu lompatan ceria kodok (`PET_HAPPY`).

#### Changed
- **Header Banner & Brand Dashboard:** `dashboard/src/app/layout.tsx`, `dashboard/src/app/login/page.tsx`, dan `dashboard/src/app/page.tsx` diperbarui dengan `<FrogIcon />` resmi.
- **Preset Pesan Cinta:** `dashboard/src/app/api/dashboard/templates/route.ts` diperbarui untuk menggunakan teks bersih tanpa emoji generik `🐸`.
- **Display Manager Firmware:** Method `drawLoveMail` kini menerima parameter `forcePage` (-1 untuk auto-flip di paruh waktu 7.5 detik, 0 untuk halaman 1, 1 untuk halaman 2) serta fungsi `getLoveMailPageCount(body)`.
- **MewBot Firmware Loop:** `handleDisplayRendering` dan `handleTouchInput` di `firmware/MewBot_ESP32C3/MewBot_ESP32C3.ino` diperbarui untuk mengoordinasikan siklus visual dua tahap dan navigasi sentuh interaktif.

#### Fixed
- **DISP-01 (Resolved):** Batasan kapasitas layar OLED SH1106 yang sebelumnya hanya memuat ~54 karakter teks terselesaikan secara elegan dengan sistem word-wrap dan paging otomatis/interaktif, memungkinkan seluruh 80 karakter terbaca utuh tanpa terpotong.
- **Visual Reaction Interruption:** Kodok kini menampilkan animasi tersipu (`PET_SHY`) terlebih dahulu sebelum kartu pesan ditutup, menghilangkan *race condition* render display sebelumnya.

#### Performance & Resources
- **Firmware Flash:** 1,318,811 bytes (62.8% dari partisi 2MB `no_ota`, atau 71.8% dari partisi 1.75MB dual-slot OTA). Penambahan fitur paging dan transisi visual hanya menggunakan 1,372 bytes flash!
- **Dual-Slot OTA Headroom:** Sisa ruang bebas sebesar **516,197 bytes (504.1 KB)** per slot.
- **Static SRAM:** 38,544 bytes (11.7%, 0 bytes pertambahan static SRAM).
- **Free Dynamic Heap:** 289,136 bytes (~282.4 KB free heap).
- **Integritas Animasi:** 16 ekspresi / 155 frame (158.7 KB PROGMEM) dengan hash SHA-256 `69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2` (100% utuh tanpa kompresi).
- **Dashboard Production Build:** Next.js 15.5.28 lulus `npm run build` dalam 6.5 detik (10/10 static/dynamic routes generated, 0 error).

---

## [1.1.0] — 2026-11-01

### Phase 1 — Security Hardening & API Reliability Review

#### Added
- **Database Model Akses Bersama Pasangan:** Tabel `device_members` dengan foreign keys ke `devices` dan `auth.users`, role `'owner'` dan `'partner'`, serta trigger pembatas maksimal 2 anggota per perangkat (`trg_check_device_member_limit`).
- **Autentikasi Dashboard & Session:** Halaman login email/password di `dashboard/src/app/login/page.tsx`, paket `@supabase/ssr`, utilitas server cookies di `dashboard/src/lib/supabase-server.ts`, dan browser client di `dashboard/src/lib/supabase-browser.ts`.
- **Proteksi Rute Middleware:** `dashboard/src/middleware.ts` memproteksi seluruh rute privat dashboard dan rute `/api/dashboard/*`, mengarahkan pengguna unauthenticated ke `/login?next=...` sambil mengecualikan endpoint Bearer token perangkat (`/api/device/v1/*`).
- **User Navigation & Logout:** Komponen `dashboard/src/components/UserNav.tsx` untuk menampilkan identitas pengguna terotentikasi dan tombol logout aman.
- **Atomic FIFO Claim Lease:** Fungsi database PostgreSQL `claim_next_love_mail(device_id, lease_seconds)` dan `claim_next_device_command(device_id, lease_seconds)` dengan klausa `FOR UPDATE SKIP LOCKED` dan lease expiry untuk mencegah pesan ganda saat polling paralel/timeout.
- **Sertifikat Root CA Resmi Vercel:** Memasukkan Let's Encrypt ISRG Root X1 CA PEM ke dalam PROGMEM (`MEWBOT_ROOT_CA` di `firmware/MewBot_ESP32C3/config.h`).
- **Automated Test Suite:** `dashboard/tests/verify-phase1-security.mjs` memvalidasi 17 skenario keamanan, RLS, middleware, API gateway, dan firmware TLS.

#### Changed
- **Refactor API Routes Dashboard:** Seluruh endpoint `/api/dashboard/*` (`overview`, `messages`, `device`, `memories`, `templates`) kini memverifikasi sesi pengguna `getAuthenticatedUser()` dan memvalidasi keanggotaan perangkat sebelum mengembalikan data.
- **Refactor Polling Gateway `/api/device/v1/poll`:** Menggunakan fungsi atomik `claim_next_love_mail` dan `claim_next_device_command`, memvalidasi tipe data heartbeat secara ketat (menangani `0`, `false`, `null`), dan memproses piggybacked ACK dengan validasi kepemilikan perangkat.
- **Firmware TLS Client:** Menghapus seluruh pemanggilan `netClient.setInsecure()` dan menggantikannya dengan `netClient.setCACert(MEWBOT_ROOT_CA)` yang tervalidasi setelah sinkronisasi waktu NTP terkonfirmasi (`isTimeSynced()`).
- **Remote Restart Command ACK:** Firmware kini memanggil `cloudClient.sendCommandAck(commandId)` sebelum mengeksekusi reboot (`ESP.restart()`).

#### Fixed
- **SEC-01 (Resolved):** Celah rute dashboard tanpa login berhasil ditutup sepenuhnya dengan Next.js middleware dan Server Component session checks. Pendaftaran publik dinonaktifkan.
- **SEC-02 (Resolved):** Menghapus seluruh policy `USING (true)` pada tabel privat. Menggantikannya dengan RLS granular berbasis fungsi `is_device_member(device_id)`.
- **SEC-03 (Resolved):** Menambahkan klausa `SET search_path = public, pg_temp;` pada fungsi `enqueue_love_mail`, memvalidasi kecocokan `auth.uid()`, dan mencabut hak `EXECUTE` dari publik.
- **SEC-04 (Resolved):** Menghilangkan `setInsecure()` pada firmware ESP32-C3 dan menggantinya dengan validasi TLS X.509 resmi via ISRG Root X1.
- **CMD-01 (Resolved):** Firmware kini mengirimkan ACK ke `/api/device/v1/commands/[id]/ack` sebelum melakukan reboot, sehingga server mencatat status `applied`.
- **QUEUE-01 (Resolved):** Pesan dan command pending kini diklaim secara atomik dengan status `claimed` dan lease 60s/30s, mencegah pengiriman berulang saat polling retry.

#### Performance & Resources
- **Firmware Flash:** 1,317,439 bytes (62.8% dari 2MB, atau 71.8% dari slot OTA 1.75 MB). Penambahan hanya 3,054 bytes untuk penyertaan sertifikat CA dan fungsi command ACK. Masih lebih hemat 774 bytes dibanding baseline.
- **Dual-Slot OTA Headroom:** Sisa ruang bebas sebesar **517,569 bytes (505.4 KB)** per slot.
- **Static SRAM:** 38,544 bytes (11.7%, identik dengan Phase 0, 0 bytes bertambah).
- **Free Dynamic Heap:** 289,136 bytes (~282.4 KB free heap).
- **Integritas Animasi:** 16 ekspresi / 155 frame (158.7 KB PROGMEM) dengan hash SHA-256 `69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2` (100% utuh).
- **Dashboard Build:** Next.js 15.5.28 lulus build produksi (`next build`) dalam 5.5 detik (10/10 static/dynamic pages generated, 0 error).

---

## [1.0.0] — 2026-11-01

### Phase 0 — Repository Inspection & Baseline Audit
- Inisialisasi repositori Git dan baseline audit arsitektur.
