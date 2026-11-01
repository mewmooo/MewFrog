# MewBot Changelog

Semua perubahan yang terdokumentasi di bawah ini mencatat perkembangan teknis proyek MewBot FrogPet berdasarkan fase pengerjaan bertahap.

---

## [1.7.5] — 2026-11-01

### Multi-WiFi Auto-Roam (Seamless Location Hopping for ESP32-C3 Super Mini)

#### Added
- **Multi-WiFi Auto-Roam Non-Blocking (Hingga 8 Jaringan):**
  - Meningkatkan kapasitas penyimpanan profil jaringan di NVS flash dari 4 menjadi **8 profil** (`MAX_WIFI_PROFILES 8`).
  - Menambahkan engine deteksi latar belakang asinkronus (`startAsyncRoamScan` & `checkRoamScanResult`):
    1. **Zero-Stutter pada Animasi Kodok:** Scanning dilakukan 100% di background FreeRTOS WiFi task (`WiFi.scanNetworks(true)`). Layar OLED SH1106, siklus mata animasi kodok, sensor sentuh TTP223, dan jam digital tetap berjalan mulus pada 60 FPS tanpa jeda/freeze.
    2. **Auto-Detection Cepat saat Berpindah Lokasi (Kos <-> Kampus):** Ketika MewBot berpindah lokasi (atau dinyalakan di tempat baru), sistem memindai udara dalam 1,5 detik. Begitu SSID yang cocok terdeteksi, MewBot langsung berpindah dan menyambungkan ke jaringan tersebut secara instan tanpa perlu menunggu timeout siklikal.
    3. **Prioritas Sinyal Terkuat (RSSI-Based AP Selection):** Jika terdapat lebih dari 1 jaringan tersimpan di udara (misal WiFi Kos dan Tethering HP sama-sama aktif), sistem otomatis memilih jaringan dengan sinyal paling kuat (RSSI tertinggi).
    4. **Manajemen Memori Ketat ESP32-C3:** Memori hasil scan langsung dideallokasi seketika dengan `WiFi.scanDelete()` untuk menjaga heap RAM tetap lapang. Cooldown scan dibatasi minimal 25 detik saat terputus (`WIFI_ROAM_SCAN_INTERVAL_MS 25000`) untuk mencegah lonjakan konsumsi daya radio dan beban interupsi CPU.
  - **Manajemen Profil di SoftAP Portal (192.168.4.1):**
    - Portal setup kini menampilkan seluruh daftar jaringan yang tersimpan dengan indikator jaringan aktif `(Aktif)`.
    - Menambahkan tombol aksi `Hapus` pada masing-masing jaringan di portal web sehingga pengguna dapat membersihkan jaringan lama yang sudah tidak digunakan.

---

## [1.7.4] — 2026-11-01

### OLED Display Preview Overflow Fix & Smart Word-Wrap Algorithm

#### Fixed
- **Penanganan Teks Panjang Tanpa Spasi pada Simulasi & Layar OLED:** Mengatasi masalah overflow teks yang keluar melampaui bingkai bezel preview OLED 128×64 ketika pengguna memasukkan teks panjang tanpa spasi (misalnya `aaaaaaaaaaaaaaaa...`).
  - *Akar Masalah:* Algoritma word-wrap sebelumnya hanya memecah teks pada karakter spasi (`split(' ')`). Ketika sebuah kata memiliki panjang melebihi batas kolom layar (18 karakter), algoritma mengabaikan pembagian dan menetapkan kata utuh ke satu baris, sehingga teks panjang 70–80 karakter meluap horizontal keluar dari layar.
  - *Solusi:*
    1. Mengimplementasikan fungsi pembagi cerdas (`wrapTextToOledLines`) yang memecah kata panjang tanpa spasi menjadi potongan berurutan maksimal 18 karakter (`while (w.length > maxLen) { lines.push(w.slice(0, maxLen)); w = w.slice(maxLen); }`).
    2. Mendukung pemotongan baris paragraf eksplisit (`\r?\n`) dan pemisahan whitespace regex fleksibel (`/\s+/`).
    3. Menambahkan properti CSS `overflow: hidden; box-sizing: border-box;` pada kelas `.oled-screen-preview`, serta `break-all`, `overflow-hidden`, dan `truncate` pada baris teks paragraf untuk menjamin proteksi fisik tampilan.
    4. Menambahkan fitur navigasi halaman pratinjau (`Hal 1/2 ↻`) di studio Love Mail sehingga pengguna dapat mempratinjau halaman 1 dan halaman 2 untuk surat cinta yang panjang.

---

## [1.7.3] — 2026-11-01

### Mobile-Desktop Responsiveness & Spam Message Deadlock Resolution

#### Fixed
- **Bug Deadlock Spam Pesan pada Simulasi:** Mengatasi bug kritis di mana pengiriman pesan beruntun (spamming) menyebabkan pesan terakhir macet permanen di mode pesan (`MODE_MESSAGE`) dengan sisa waktu `0s` dan tidak pernah kembali ke mode Pet kodok tanpa restart.
  - *Akar Masalah:* Setiap pesan baru memicu timer klaim mandiri paralel yang saling menimpa variabel state (`previousMode`, `activeMessageId`, `messageStartTime`). Karena `currentMode` sudah bernilai `MODE_MESSAGE`, `previousMode` tertimpa menjadi `MODE_MESSAGE`, sehingga fungsi ACK mengembalikan mode ke `MODE_MESSAGE` secara berulang (infinite loop).
  - *Solusi:*
    1. Mengimplementasikan antrean FIFO sejati (`scheduleQueueProcessing` & `processNextLoveMailQueue`) yang memproses pesan satu per satu secara berurutan. Pesan berikutnya hanya diambil setelah pesan aktif selesai dan di-ACK.
    2. Menambahkan penjaga sanitasi: `previousMode` hanya disimpan jika `currentMode !== MODE_MESSAGE`, dan jika bernilai `MODE_MESSAGE` secara otomatis disanitasi kembali ke `MODE_PET` (atau `MODE_CLOCK`).
    3. Menambahkan *watchdog* pemulihan otomatis di fungsi render: jika buffer pesan aktif kosong, sistem seketika memulihkan mode ke mode normal.
- **Proteksi Watchdog pada Firmware C++ ESP32-C3 (`MewBot_ESP32C3.ino`):** Memasang pengaman sanitasi serupa di firmware C++ fisik pada `loop()` dan handler sentuh OLED untuk memastikan unit fisik tidak akan pernah mengalami deadlock tampilan pesan saat terjadi burst komunikasi internet.

#### Enhanced
- **Tata Letak & Responsivitas Mobile-Desktop Penuh:**
  - *OLED Display Canvas:* Diperbarui dengan rasio aspek dinamis `aspect-[2/1] w-full max-w-[384px] h-auto`, menjaga proporsi piksel 128×64 tetap tajam dan proporsional di seluruh lebar layar (mulai dari smartphone 320px hingga desktop 4K).
  - *Tombol & Target Sentuh Mobile:* Seluruh tombol kontrol perangkat fisik (Sensor TTP223, Ketukan Singkat, Tahan 3s, Gestur ADXL345, dan Skenario Alami) kini memiliki tinggi minimum target sentuh `min-h-[44px]` hingga `min-h-[52px]` sesuai pedoman human interface guidelines (Apple & Google) untuk kenyamanan jari di layar sentuh.
  - *Navigasi Tab Dashboard Responsif:* Header navigasi dashboard kini mendukung scrolling horizontal halus bebas batang gulir (`overflow-x-auto scrollbar-none touch-pan-x`), dengan chip tab berukuran pas dan teks label yang tidak patah vertikal.
  - *Formulir & Tombol Aksi Adaptif:* Tombol "Kirim Surat" dan "Kirim ke MewBot" di tab Home, Love Mail, dan Quick Notes kini merespons layar kecil dengan tata letak `w-full sm:w-auto` sehingga mudah diakses dengan satu jempol di smartphone.

---

## [1.7.2] — 2026-11-01

### Total Elimination of Emoji Icons & Modern Minimalist SVG System

#### Enhanced
- **Pembersihan Total Karakter Emoji pada UI Dashboard & Simulator:** Menghilangkan seluruh karakter emoji unicode (`🏠`, `💌`, `📖`, `✨`, `📜`, `⚙️`, `⏰`, `🚀`, `🌿`, `🕊️`, `💢`, `💫`, `⚡`, `🔔`, `📊`, `👥`, `🔒`, dll) di seluruh codebase dashboard Next.js (`dashboard/src/app`) dan web simulator (`mewbot_studio_simulator.html` & `mewbot_simulator.html`).
- **Penerapan Sistem Ikon SVG Minimalis Modern (Linear/Raycast/Vercel Design System):** Mengganti seluruh ikon simbol dengan SVG line-art berstandar industri dengan bobot garis 2px (`stroke="currentColor"`), *rounded caps & joins*, dan integrasi pewarnaan halus berbasis Tailwind CSS.
- **Tampilan Antarmuka Profesional (Bebas Nuansa AI-Generated):** Dashboard kini menampilkan antarmuka perangkat lunak komersial profesional yang bersih, elegan, dan matang tanpa kesan template AI, dengan tetap mempertahankan maskot kodok kustom asli (`/mewbot-frog.png`).

---

## [1.7.1] — 2026-11-01

### Simulator 100% Production Mirror (Firmware C++ & Next.js 15 App Router)

#### Enhanced
- **Simulator 100% Identik Publik (`mewbot_studio_simulator.html` & Artifact):** Mengembangkan simulator sistem terpadu agar persis dan identik secara visual maupun interaktif dengan sistem publik yang sesungguhnya:
  - **Sisi Kanan (Hosted Dashboard Next.js 15):** Mengimplementasikan seluruh rute dan tata letak App Router nyata secara interaktif (`Home`, `Love Mail`, `Memories`, `Quick Notes`, `Timeline`, `Settings`, dan `Login`).
    - *Home (`/`):* Welcome banner, companion preview card dengan animasi lingkaran maskot dan partikel detak hati, mode switcher, quick mail box, dan 4 kartu telemetri diagnostik.
    - *Love Mail (`/love-mail`):* Form surat 80 karakter, live preview OLED 128x64 dengan word-wrap 19 karakter per baris, dan tabel riwayat antrean status FIFO (`Pending`, `Claimed 60s`, `Delivered & ACKed`).
    - *Memories (`/memories`):* Kartu arsip surat tersimpan dengan fitur pencarian real-time.
    - *Quick Notes (`/notes`):* Filter kategori (Affection, Caring, Missing, Encouragement, Random) dan tombol 1-klik "Kirim ke MewBot".
    - *Timeline (`/timeline`):* Audit trail peristiwa sistem (pengiriman pesan, klaim lease, deteksi sentuh, pergantian mode, restart, dll).
    - *Settings (`/settings`):* Pengaturan alarm lokal NVS, diagnostik hardware (Free Heap 282 KB, Peak Watermark 238 KB, Blok Kontigu 114 KB), tabel 2-user membership, dan konfirmasi restart jarak jauh.
    - *Login (`/login`):* Tampilan autentikasi privat dengan pemberitahuan registrasi tertutup.
  - **Sisi Kiri (Hardware Fisik ESP32-C3 Super Mini + SH1106 OLED):**
    - Logika ekspresi 100% identik dengan C++ (`pet_animation.cpp`): 16 ekspresi / 155 frame, 5 skenario alami acak berbobot (Hunting 40%, Sleep/Wake 15%, Playful 15%, Curious/Shy 15%, Emotional 15%), dan istirahat 4-7 detik di `PET_NORMAL`.
    - Simulasi sensor sentuh TTP223 (ketukan singkat untuk ganti mode pet/clock & dismiss/flip pesan; tahan 3 detik untuk SoftAP 192.168.4.1).
    - Simulasi akselerometer ADXL345 (elus, goyang sedang, guncang kuat, bangunkan) dengan lockout debounce 350ms.
    - Sinkronisasi dua arah real-time: pengiriman pesan di dashboard langsung diklaim, memicu reaksi tersipu malu 1.8 detik di OLED, menampilkan surat selama 15 detik, dan mengirimkan ACK otomatis/manual.
  - **Asset Maskot:** Mengintegrasikan Base64 Data URI resmi dari `/mewbot-frog.png` sehingga gambar maskot kodok tampil jernih, offline, dan tanpa ketergantungan server lokal.
    - Simulasi sensor sentuh TTP223 (ketukan singkat untuk ganti mode pet/clock & dismiss/flip pesan; tahan 3 detik untuk SoftAP 192.168.4.1).
    - Simulasi akselerometer ADXL345 (elus, goyang sedang, guncang kuat, bangunkan) dengan lockout debounce 350ms.
    - Sinkronisasi dua arah real-time: pengiriman pesan di dashboard langsung diklaim, memicu reaksi tersipu malu 1.8 detik di OLED, menampilkan surat selama 15 detik, dan mengirimkan ACK otomatis/manual.
  - **Asset Maskot:** Mengintegrasikan Base64 Data URI resmi dari `/mewbot-frog.png` sehingga gambar maskot kodok tampil jernih, offline, dan tanpa ketergantungan server lokal.

---

## [1.7.0] — 2026-11-01

### Phase 7 — End-to-End System Integration & Acceptance Sign-Off

#### Added
- **Suite Pengujian Terpadu End-to-End (`verify-phase7-e2e-integration.mjs`):** Memvalidasi 21 skenario integrasi menyeluruh yang mencakup booting partisi dual-slot OTA, loop non-blocking (0 delay), mitigasi NVS wear, isolasi getaran sentuh sensor (350ms), portal SoftAP captive portal (192.168.4.1), enkripsi TLS native root CA, validasi anti-bricking rollback, telemetri heap watermark, pre-alokasi buffer, zero-churn clock string, model otorisasi 2-user RLS database, stored procedure atomic FIFO claim leases, Next.js middleware session protection, hingga kepatuhan identitas merek maskot tanpa emoji kodok.
- **Total Pengujian Otomatis Sistem:** Keseluruhan 6 test suite independen di repositori kini menjalankan **97 skenario pengujian otomatis dengan tingkat kelulusan 100% (97/97 PASSED)**.
- **Petunjuk Operasional & Deployment Terpadu:** Panduan lengkap kompilasi firmware via Arduino CLI dengan skema dual-slot OTA 1.75 MB, prosedur pemulihan darurat ROM Bootloader hardware melalui tombol BOOT (GPIO9), dan urutan eksekusi migrasi Supabase PostgreSQL didokumentasikan secara rinci di `README.md`.

#### Verified
- **Stabilitas Kompilasi Firmware ESP32-C3:** Lolos kompilasi resmi via Arduino CLI core v3.3.10 dengan Flash 1,370,015 bytes (74.6% dari slot 1.75 MB), sisa headroom bebas **464,993 bytes (454.1 KB)**, SRAM statis 38,888 bytes (11.8%), dan dynamic heap bebas 288,792 bytes (~282.0 KB).
- **Integritas Aset Animasi Pixel Art Kodok:** Seluruh 16 ekspresi / 155 frame bitmap PROGMEM (158.7 KB) terverifikasi 100% utuh tanpa kompresi dengan hash SHA-256 identik terhadap baseline awal (`69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2`).
- **Produksi Web Dashboard Next.js:** Build Next.js 15.5.28 berhasil di-compile dalam 8.4 detik (10/10 rute App Router ter-generate secara bersih dengan 0 error).

---

## [1.6.0] — 2026-11-01

### Phase 6 — Resource Optimization & Heap Profiling

#### Added
- **Telemetri Profiling Heap & Watermark (`min_free_heap` & `max_alloc_heap`):** Firmware kini mengekstrak dan mengirimkan `ESP.getMinFreeHeap()` (titik terendah sisa heap memori sejak perangkat dinyalakan) dan `ESP.getMaxAllocHeap()` (ukuran blok kontigu bebas terbesar) secara berkala pada payload telemetri heartbeat ke gateway backend.
- **Deteksi Fragmentasi Heap Real-Time:** Menambahkan pemantauan terhadap ukuran blok kontigu terbesar (`MALLOC_CAP_8BIT`) untuk mendeteksi potensi fragmentasi memori sebelum kegagalan alokasi memori TLS terjadi.
- **Validasi Anti-Fragmentasi OTA:** Fungsi `executeOtaUpdate` pada `ota_manager.cpp` kini memeriksa `ESP.getMaxAllocHeap() >= 30000` selain batas heap total $50\text{ KB}$ guna menjamin ketersediaan ruang buffer streaming TLS yang stabil.
- **Kartu Diagnostik Hardware Dashboard Diperluas:** Antarmuka web `/settings` kini secara visual menampilkan metrik `Min Free Heap (Peak Watermark)` dan `Blok Bebas Terbesar (Fragmentasi)` yang diambil langsung dari basis data `devices.diagnostics`.
- **Automated Test Suite Phase 6 (`verify-phase6-resource-optimization.mjs`):** Menjalankan 14 skenario pengujian untuk mitigasi heap churn, reservasi buffer, pointer PROGMEM animas kodok, parser API server, dan tampilan UI. Total test suite bertambah menjadi 76 skenario lulus 100%.

#### Optimized
- **Eliminasi String Heap Churn pada Loop Jam (1Hz):** Metode `cloudClient.getDateFormatted()` diubah mengembalikan `const char*` yang menunjuk ke buffer statis `static char s_dateBuf[16]` di memory, menggantikan pembuatan objek `String` sementara setiap detik pada `MODE_CLOCK`.
- **Pre-Alokasi Buffer JSON Telemetri:** Menambahkan `reqBody.reserve(256)` sebelum fungsi `serializeJson()` dieksekusi di `cloud_client.cpp`, meniadakan reallokasi heap dinamis bertingkat saat string JSON membesar.
- **Zero-Allocation Pet Animation Loop:** Memverifikasi arsitektur `PetAnimation` yang 100% berbasis pointer `PROGMEM` (`pgm_read_ptr`), menghasilkan 0 panggilan `malloc()`, `new`, atau `String()` selama animasi ekspresi kodok berjalan.

#### Performance & Resources
- **Firmware Flash:** 1,370,015 bytes (74.6% dari partisi 1.75MB dual-slot OTA / 1,835,008 B). Penambahan telemetri heap hanya menggunakan 182 bytes flash!
- **Dual-Slot OTA Headroom:** Sisa ruang bebas sebesar **464,993 bytes (454.1 KB)** per slot.
- **Static SRAM:** 38,888 bytes (11.8% dari 320 KB).
- **Free Dynamic Heap:** 288,792 bytes (~282.0 KB free heap).
- **Integritas Animasi:** 16 ekspresi / 155 frame (158.7 KB PROGMEM) dengan hash SHA-256 `69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2` (100% utuh tanpa kompresi).
- **Test Suite Status:** 76 / 76 tests PASSED (100% pass across Phases 1, 3, 4, 5, 6).
- **Dashboard Production Build:** Next.js 15.5.28 lulus `npm run build` dalam 8.4 detik (10/10 routes generated, 0 error).

---

## [1.5.0] — 2026-11-01

### Phase 5 — Dual-Slot OTA Integration & Anti-Bricking Rollback

#### Added
- **Skema Partisi Dual-Slot OTA 1.75 MB (`partitions.csv`):** Mengganti skema default single-app 1.25 MB dengan skema kustom dual OTA (`app0` pada `0x10000` sebesar 1.75 MB / 1,835,008 B; `app1` pada `0x1D0000` sebesar 1.75 MB / 1,835,008 B; `otadata` pada `0xE000` sebesar 8 KB). Menjamin seluruh 4MB Flash terutilisasi optimal dengan aman ($\le \text{0x400000}$).
- **Headroom OTA Luas Tanpa Kompresi:** Aplikasi firmware berukuran ~1.36 MB dapat dimuat pada slot 1.75 MB dengan sisa ruang bebas **476,335 bytes (465.1 KB)**, sehingga seluruh 155 frame bitmap animasi kodok tetap 100% utuh tanpa perlu dikompresi atau diturunkan resolusinya.
- **Modul Manajer OTA Mandiri (`ota_manager.h` & `ota_manager.cpp`):** Mengelola siklus update firmware over-the-air melalui HTTPS dengan validasi sertifikat root CA ISRG Root X1, anti-downgrade check, dan inspeksi heap sebelum unduhan dimulai.
- **Streaming SHA-256 Checksum Verification:** Menghitung checksum SHA-256 secara streaming chunk-by-chunk menggunakan pustaka perangkat keras `mbedtls/sha256.h` saat data binary diunduh, memverifikasi kecocokan hash server secara ketat sebelum `Update.end()` dieksekusi.
- **Proteksi Anti-Bricking Rollback Otomatis:** Menggunakan mekanisme ESP-IDF OTA rollback. Firmware baru di-bootloader dalam status `ESP_OTA_IMG_PENDING_VERIFY`. Fungsi `otaManager.begin()` memanggil `esp_ota_mark_app_valid_cancel_rollback()` hanya setelah periferal vital (I2C, OLED, NVS, Sensor) berhasil diinisialisasi. Jika firmware baru crash atau bootloop, bootloader ESP32 secara otomatis membatalkan boot dan memulihkan slot partisi sebelumnya.
- **Jalur Pemulihan Darurat Hardware USB ROM:** ESP32-C3 Super Mini memiliki native USB Serial/JTAG terintegrasi langsung pada silikon SoC. Menahan tombol `BOOT` (GPIO9) saat mencolokkan USB kabel ke PC membuka ROM Bootloader bawaan pabrik yang tidak dapat ter-brick oleh software apa pun.
- **Umpan Balik Visual Layar OLED (`drawOtaProgress`):** Menampilkan banner judul, status langkah operasi (Menghubungkan, Mengunduh, Verifikasi SHA, Sukses), teks persentase besar, dan visual progress bar retro yang ter-update tiap peningkatan unduhan.
- **Integrasi Cloud Polling Command (`OTA` / `UPDATE_FIRMWARE`):** Polling berkala gateway mendeteksi perintah update firmware, mengekstrak URL, target version, dan checksum SHA-256, mengirimkan konfirmasi ACK sebelum menjalankan prosedur update dan auto-reboot.
- **Automated Test Suite Phase 5 (`verify-phase5-dual-ota.mjs`):** Menjalankan 19 skenario pengujian komprehensif untuk skema partisi, batas ukuran 4MB, integritas hash SHA-256 bitmap, proteksi rollback, validasi TLS X.509, dan kepatuhan merek tanpa emoji frog.

#### Performance & Resources
- **Firmware Flash:** 1,369,833 bytes (74.6% dari partisi 1.75MB dual-slot OTA / 1,835,008 B).
- **Dual-Slot OTA Headroom:** Sisa ruang bebas sebesar **465,175 bytes (454.3 KB)** per slot (sangat luas & aman).
- **Static SRAM:** 38,872 bytes (11.8% dari 320 KB).
- **Free Dynamic Heap:** 288,808 bytes (~282.0 KB free heap).
- **Integritas Animasi:** 16 ekspresi / 155 frame (158.7 KB PROGMEM) dengan hash SHA-256 `69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2` (100% utuh tanpa kompresi).
- **Test Suite Status:** 62 / 62 tests PASSED (100% pass across Phases 1, 3, 4, 5).
- **Dashboard Production Build:** Next.js 15.5.28 lulus `npm run build` dalam 14.2 detik (10/10 routes generated, 0 error).

---

## [1.4.0] — 2026-11-01

### Phase 4 — Multi-Network Wi-Fi & SoftAP Provisioning

#### Added
- **Multi-Network Profile Manager (WIFI-01 Resolved):** Penyimpanan hingga 4 profil jaringan Wi-Fi (SSID & Password) pada NVS Preferences melalui `localStorage.saveWiFiProfile` dan `getWiFiProfile`, menggantikan ketergantungan statis pada satu SSID tunggal.
- **Smart Network Cycling & Reconnect:** Logika `cloudClient` kini secara otomatis mencoba profil aktif terakhir, dan beralih ke profil tersimpan berikutnya jika terjadi kegagalan koneksi 2 kali berturut-turut dengan exponential backoff non-blocking.
- **Portal Wi-Fi Setup SoftAP Interaktif (`192.168.4.1`):** Modul `WifiProvisioner` berbasis `WebServer` terisolasi yang menyediakan portal web lokal sementara ber-SSID `MewBot-Setup` pada subnet `192.168.4.1`.
- **Pindai Wi-Fi & Form Kredensial:** Antarmuka web responsif dengan fitur pemindaian jaringan sekitar (`WiFi.scanNetworks()`), input SSID/Password, daftar profil tersimpan, dan opsi batal.
- **Aktivasi Fisik Long-Press 3 Detik:** Sensor sentuh TTP223 kini mendeteksi sentuhan tahan terus-menerus $\ge 3000\text{ ms}$ untuk membuka portal setup secara intuitif tanpa alat khusus.
- **Tampilan Layar Setup OLED Retro:** Tampilan `drawSetupScreen` pada OLED SH1106 menampilkan SSID AP, instruksi IP `192.168.4.1`, dan bilah hitung mundur waktu tersisa.
- **Perlindungan Auto-Timeout & Manajemen Memori:** SoftAP memiliki batas waktu aktif otomatis 180 detik (3 menit). Instansiasi `WebServer` sepenuhnya dinamis (`new` saat mulai dan `delete` saat selesai), menjamin zero permanent heap leak (0 KB terbuang) selama operasi normal.
- **Automated Test Suite Phase 4:** Skrip `dashboard/tests/verify-phase4-wifi-manager.mjs` memvalidasi 13 skenario multi-network, SoftAP provisioning, auto-timeout, deallokasi heap, long-press trigger, dan integritas hash bitmap.

#### Changed
- **Pencegahan Kebocoran Kredensial:** Seluruh fungsi log Serial dan dashboard tidak pernah mengekspos isi password Wi-Fi pengguna.
- **Initial Profile Seeding:** Profil Wi-Fi pertama secara mulus di-seed dari konfigurasi default jika partisi NVS baru pertama kali digunakan.

#### Fixed
- **WIFI-01 (Resolved):** Masalah MewBot terkunci pada satu SSID statis tanpa opsi setup di lapangan terselesaikan tuntas. Perangkat kini dapat dibawa bepergian ke berbagai lokasi (rumah, kantor, hotspot seluler) dan dikonfigurasi langsung dari smartphone pengguna.

#### Performance & Resources
- **Firmware Flash:** 1,358,729 bytes (64.7% dari partisi 2MB `no_ota`, atau 74.0% dari partisi 1.75MB dual-slot OTA).
- **Dual-Slot OTA Headroom:** Sisa ruang bebas sebesar **476,279 bytes (465.1 KB)** per slot (sangat aman untuk OTA).
- **Static SRAM:** 38,640 bytes (11.8% dari 320 KB; penambahan hanya 64 bytes).
- **Free Dynamic Heap:** 289,040 bytes (~282.2 KB free heap).
- **Integritas Animasi:** 16 ekspresi / 155 frame (158.7 KB PROGMEM) dengan hash SHA-256 `69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2` (100% utuh tanpa kompresi).
- **Dashboard Production Build:** Next.js 15.5.28 lulus `npm run build` dalam 7.0 detik (10/10 routes generated, 0 error).

---

## [1.3.0] — 2026-11-01

### Phase 3 — Local Firmware Hardening & Resiliency

#### Added
- **Mitigasi NVS Flash Wear:** Fungsi `localStorage.saveLastKnownEpoch(epoch, force)` membatasi penulisan timestamp ke NVS flash maksimal 1 kali per jam (`>= 3600s`) atau saat dipaksa (`force = true`), menjamin ketahanan chip flash hingga $>11$ tahun pemakaian non-stop.
- **Offline Clock Fallback Engine:** `cloudClient` kini memulihkan timestamp terakhir dari NVS saat boot dan menjalankan osilator software lokal berbasis `millis()` sehingga waktu tetap berjalan maju detik demi detik meskipun boot tanpa Wi-Fi dan tanpa internet.
- **Indikasi Tanggal Offline Transparan:** Format tanggal pada layar OLED menampilkan badge `"OFF %02d/%02d"` (atau `"OFF 00/00"` jika belum pernah tersinkronisasi) dan ikon Wi-Fi disilang (X) saat offline, secara jujur mendokumentasikan ketiadaan modul hardware RTC fisik.
- **Alarm 100% Mandiri & Offline:** Fungsi `handleAlarmCheck` dilepaskan dari ketergantungan status koneksi internet (`!cloudClient.isConnected()` dicabut), sehingga alarm terjadwal tetap berbunyi tepat waktu saat internet terputus.
- **Proteksi Konflik Sentuhan-Gerakan (Touch-Motion Lockout):** Jendela jeda 350ms diterapkan sesaat setelah sentuhan fisik kapasitif terdeteksi untuk menekan getaran mekanis agar tidak disalahartikan sebagai gestur guncangan ADXL345.
- **Auto-Recovery Bus I2C & Timeout Protection:** `Wire.setTimeOut(40)` mencegah hanging pada loop firmware jika perangkat I2C bermasalah, disertai probe berkala (tiap 5000ms) untuk otomatis mendeteksi dan menginisialisasi ulang sensor ADXL345 yang terlepas/reconnected.
- **Automated Test Suite Phase 3:** Skrip `dashboard/tests/verify-phase3-local-firmware.mjs` memvalidasi 13 skenario uji ketahanan lokal, rumus waktu, mitigasi NVS, debouncing, dan integritas hash bitmap.

#### Changed
- **Alarm Visual Alert pada Mode Jam:** Jika alarm berbunyi saat perangkat berada pada `MODE_CLOCK`, tampilan otomatis beralih sementara ke animasi kodok melompat gembira (`PET_HAPPY`) agar pengguna mendapatkan notifikasi visual yang jelas.
- **Pre-Reboot Epoch Flush:** Handler perintah remote `RESTART` kini menyimpan epoch waktu terbaru ke NVS dengan opsi `force = true` sesaat sebelum reboot dijalankan.

#### Performance & Resources
- **Firmware Flash:** 1,319,931 bytes (62.9% dari partisi 2MB `no_ota`, atau 71.9% dari partisi 1.75MB dual-slot OTA). Penambahan fitur fallback clock dan debounce sensor hanya menambah 1,120 bytes flash!
- **Dual-Slot OTA Headroom:** Sisa ruang bebas sebesar **515,077 bytes (503.0 KB)** per slot.
- **Static SRAM:** 38,576 bytes (11.7% dari 320 KB; hanya bertambah 32 bytes untuk variabel fallback).
- **Free Dynamic Heap:** 289,104 bytes (~282.3 KB free heap).
- **Integritas Animasi:** 16 ekspresi / 155 frame (158.7 KB PROGMEM) dengan hash SHA-256 `69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2` (100% utuh tanpa kompresi).
- **Dashboard Production Build:** Next.js 15.5.28 lulus `npm run build` dalam 4.7 detik (10/10 routes generated, 0 error).

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
