# MewBot FrogPet — Review & Engineering Handoff

Dokumen ini disusun untuk memberikan ringkasan status teknis terkini kepada reviewer independen (ChatGPT, IoT Architect, atau Peer Engineer) tanpa memerlukan transfer berkas ZIP berukuran besar.

---

## 1. Metadata Proyek & Repositori
- **Platform Perangkat:** Nologo ESP32-C3 Super Mini (RISC-V 160MHz, 4MB Flash).
- **Display & Sensor:** OLED SH1106 128x64 I2C (`0x3C`), ADXL345 I2C (`0x53`), Touch TTP223 (GPIO4).
- **Cloud Backend:** Hosted Next.js 15 (Vercel) + Supabase PostgreSQL (RLS, Shared Device Membership & Atomic FIFO Queue).
- **Git Branch:** `main`
- **Fase Saat Ini:** **PHASE 1 (Security Hardening & API Reliability Review) SELESAI**
- **Fase Berikutnya:** **PHASE 2 (Display Love Mail 80-Char OLED, Paging & Advanced Queue)**

---

## 2. Integritas Aset Kritis
- **File Animasi Kodok:** `firmware/MewBot_ESP32C3/frog_pet_bitmaps.h`
- **Format:** 128x64 1-bit monochrome PROGMEM (158.7 KB)
- **Ekspresi:** 16 Ekspresi Penuh
- **Frame:** Tepat 155 Frame
- **SHA-256 Hash:** `69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2`
- **Status:** **100% Identik dengan baseline, 0 frame diubah/dihapus.**

---

## 3. Arsitektur Keamanan & Otorisasi Terbaru (Phase 1)

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Pengguna / Pasangan                          │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Supabase Auth (Email/Password)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Hosted Dashboard (Next.js 15 App Router)           │
│  - Middleware Proteksi: middleware.ts (Redirect to /login)      │
│  - Session Management: @supabase/ssr (Secure Cookie Handling)   │
│  - Halaman Login: /login (Public signup disabled)               │
│  - Header UserNav: Display email & secure logout                │
│  - API Routes: /api/dashboard/* memverifikasi sesi & membership │
└───────────────────┬─────────────────────────────────────────────┘
                    │ HTTPS Client (Bearer Device Token)
                    │ Validasi Sertifikat Root CA (ISRG Root X1)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MewBot (ESP32-C3 Super Mini)                  │
│  - Validasi TLS: setCACert(MEWBOT_ROOT_CA) (Bebas setInsecure)  │
│  - Penjaga Waktu TLS: Menunggu NTP sinkron sebelum request TLS  │
│  - Polling Non-blocking: Tiap 5 detik ke /api/device/v1/poll    │
│  - Command ACK: Kirim ACK sebelum reboot (status 'applied')     │
│  - Dual-Slot OTA Partitions: 1.75 MB/slot (>517 KB Headroom)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Status Penyelesaian Masalah Keamanan & Reliabilitas

| Issue ID | Area | Temuan Asli | Solusi yang Diterapkan di Phase 1 | Status |
|:---|:---|:---|:---|:---|
| **SEC-01** | Dashboard | Tidak ada login flow / middleware. | Pasang `@supabase/ssr`, `middleware.ts`, `/login` flow. Rute terbuka publik ditutup total. | **RESOLVED** |
| **SEC-02** | Database | RLS policy menggunakan `USING (true)`. | Hapus seluruh policy `true`, buat tabel `device_members` (2 user shared model), terapkan RLS berbasis `is_device_member()`. | **RESOLVED** |
| **SEC-03** | Database | `enqueue_love_mail` tanpa `search_path`. | Tambahkan `SET search_path = public, pg_temp;`, validasi `auth.uid()`, batasi execute privilege. | **RESOLVED** |
| **SEC-04** | Firmware | Menggunakan `netClient.setInsecure()`. | Ganti dengan `netClient.setCACert(MEWBOT_ROOT_CA)` (ISRG Root X1 CA) + NTP time synchronization gate. | **RESOLVED** |
| **CMD-01** | Firmware | Restart langsung reboot tanpa ACK. | Tambahkan `cloudClient.sendCommandAck(commandId)` sebelum `ESP.restart()`. | **RESOLVED** |
| **QUEUE-01**| Gateway | Polling pesan tidak memiliki lease claim. | Terapkan fungsi atomik `claim_next_love_mail` dan `claim_next_device_command` dengan lease expiry. | **RESOLVED** |
| **DISP-01** | Display | Layar OLED hanya muat ~54 karakter teks. | Dijadwalkan untuk Phase 2 (Paging 2-halaman / Word-wrap layout). | **Next Phase** |
| **WIFI-01** | Wi-Fi | Hanya 1 SSID statis tanpa SoftAP fallback. | Dijadwalkan untuk Phase 4 (Multi-Network NVS Manager). | **Next Phase** |

---

## 5. Ringkasan Pengukuran Resource Terkini ESP32-C3
- **Ukuran Flash Binary:** 1,317,439 bytes (62.8% dari partisi 2MB, atau 71.8% dari slot OTA 1.75 MB).
- **Sisa Headroom OTA:** **517,569 bytes (505.4 KB)** per slot.
- **Static SRAM:** 38,544 bytes (11.7%, 0 bytes pertambahan dari Phase 0).
- **Free Heap Awal:** 289,136 bytes (~282.4 KB free).
- **Hasil Kompilasi Firmware:** PASS (0 error via official Arduino CLI `esp32:esp32 v3.3.10`).
- **Hasil Build Dashboard:** PASS (0 error via `next build` Next.js 15.5.28).
- **Automated Security Tests:** 17 / 17 PASSED (100% via `node dashboard/tests/verify-phase1-security.mjs`).

---

## 6. Berkas yang Perlu Diperiksa oleh Reviewer
1. [`supabase/migrations/20261101000000_phase1_security_hardening.sql`](file:///c:/Users/rizki/OneDrive/Documents/MewBot_LeafPet_ClockMiniCharacter_Code%20(1)/supabase/migrations/20261101000000_phase1_security_hardening.sql) — Migrasi RLS, shared device members, & atomic claim lease.
2. [`dashboard/src/middleware.ts`](file:///c:/Users/rizki/OneDrive/Documents/MewBot_LeafPet_ClockMiniCharacter_Code%20(1)/dashboard/src/middleware.ts) — Proteksi rute session Next.js.
3. [`dashboard/src/app/api/device/v1/poll/route.ts`](file:///c:/Users/rizki/OneDrive/Documents/MewBot_LeafPet_ClockMiniCharacter_Code%20(1)/dashboard/src/app/api/device/v1/poll/route.ts) — Gateway polling yang telah di-hardening.
4. [`firmware/MewBot_ESP32C3/cloud_client.cpp`](file:///c:/Users/rizki/OneDrive/Documents/MewBot_LeafPet_ClockMiniCharacter_Code%20(1)/firmware/MewBot_ESP32C3/cloud_client.cpp) — Validasi TLS cert & command ACK.
5. [`dashboard/tests/verify-phase1-security.mjs`](file:///c:/Users/rizki/OneDrive/Documents/MewBot_LeafPet_ClockMiniCharacter_Code%20(1)/dashboard/tests/verify-phase1-security.mjs) — Skrip pengujian otomatis 17 skenario.
