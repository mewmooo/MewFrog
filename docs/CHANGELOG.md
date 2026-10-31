# MewBot Changelog

Semua perubahan yang terdokumentasi di bawah ini mencatat perkembangan teknis proyek MewBot FrogPet berdasarkan fase pengerjaan bertahap.

---

## [1.0.0] — 2026-11-01

### Phase 0 — Repository Inspection & Baseline Audit

#### Added
- Inisialisasi repositori Git resmi pada branch `main`.
- Sistem dokumentasi teknis berkelanjutan bebas ZIP besar pada direktori `docs/`:
  - `docs/ENGINEERING_UPDATE_REPORT.md` (Laporan komprehensif 16 bagian).
  - `docs/REVIEW_HANDOFF.md` (Laporan ringkas handoff reviewer eksternal).
  - `docs/CHANGELOG.md` (Catatan riwayat perubahan terstruktur).
- Pemindahan seluruh 30 aset non-hosting (model 3D STL/SCAD, panduan skematik, spesifikasi casing, simulator offline, dan skrip build) ke folder `newfrog/`.

#### Verified
- Integritas aset animasi kodok 128x64 pada `firmware/MewBot_ESP32C3/frog_pet_bitmaps.h` diverifikasi memiliki hash SHA-256 identik dengan baseline (`69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2`), mencakup 16 ekspresi dan 155 frame utuh tanpa modifikasi atau kompresi.
- Arsitektur partisi dual-slot OTA pada `firmware/partitions_mewbot_ota.csv` diverifikasi dengan perhitungan kapasitas flash 4MB fisik (0x3F0000 / 3.93 MB terpakai), memberikan headroom >520 KB per slot untuk firmware sebesar 1,314,385 bytes.

#### Performance & Resources
- Pengukuran binary firmware ESP32-C3: Flash = 1,314,385 bytes (62.6% dari 2MB no_ota, atau 71.6% dari slot OTA 1.75 MB), Static SRAM = 38,544 bytes (11.7%), Free Heap awal = 289,136 bytes (~282.4 KB).
- Seluruh loop utama firmware bebas dari pemanggilan `delay()`, menjamin operasi kooperatif non-blocking 100%.

#### Known Issues Identified (To be resolved in subsequent phases)
- **SEC-01 (Critical):** Dashboard Next.js belum memiliki login flow atau middleware proteksi rute (`middleware.ts`).
- **SEC-02 (Critical):** RLS policies di database Supabase menggunakan `USING (true)` pada tabel pesan dan perangkat.
- **SEC-03 (Critical):** Fungsi database `enqueue_love_mail` (`SECURITY DEFINER`) belum mengunci `SET search_path = public`.
- **SEC-04 (High):** TLS client di firmware menggunakan `netClient.setInsecure()`.
- **WIFI-01 (High):** Wi-Fi firmware hanya mendukung 1 SSID/password statis tanpa multi-network manager atau fallback SoftAP provisioning.
- **DISP-01 (High):** Layout Love Mail OLED hanya muat ~54 karakter simultan; teks 80 karakter berisiko terpotong atau menabrak countdown bar.
- **CMD-01 (Medium):** Perintah remote restart langsung mengeksekusi reboot tanpa mengirimkan konfirmasi ACK ke server.
- **QUEUE-01 (Medium):** Polling gateway tidak mengunci status pesan ke 'claimed' saat dikirimkan ke perangkat.
