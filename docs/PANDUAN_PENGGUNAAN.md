# Panduan Penggunaan MewBot (ESP32-C3 + Dashboard Vercel)

Panduan operasional untuk unit fisik MewBot: dari flash pertama, provisioning Wi-Fi,
sampai pemakaian harian lewat dashboard `https://mew-frog.vercel.app`.

Status firmware: **v1.9.0** (lihat `firmware/MewBot_ESP32C3/config.h`).

---

## 0. Ringkasan alur

```text
Flash firmware  ->  Provisioning Wi-Fi  ->  Sinkron NTP  ->  Polling cloud  ->  Dashboard Online
   (USB)            (HP, 192.168.4.1)       (otomatis)       (tiap 5 detik)      (heartbeat <=30s)
```

Sampai langkah NTP sukses, perangkat tetap berfungsi penuh secara lokal
(animasi kodok, jam offline, sensor sentuh, gestur, alarm).

---

## 1. Yang perlu disiapkan

### Hardware
| Komponen | Detail |
|---|---|
| Board | Nologo ESP32-C3 Super Mini (4 MB flash) |
| Layar | OLED SH1106 128x64, I2C `0x3C` |
| Sentuh | TTP223 (active-high) di GPIO4 |
| Gerak | ADXL345, I2C `0x53` |
| Bus I2C | SDA = GPIO8, SCL = GPIO9 (400 kHz) |
| Kabel | USB **data** (bukan charge-only) |

### Software (sudah terpasang di mesin ini)
- Arduino CLI: `C:\Users\rizki\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe`
- Core: `esp32:esp32 3.3.10`
- Library: Adafruit SH110X, Adafruit GFX, Adafruit BusIO, ArduinoJson 7, NTPClient, SparkFun ADXL345

### Akun & cloud (sudah siap, terverifikasi)
- Dashboard Vercel aktif: `https://mew-frog.vercel.app`
- Supabase: device `MewBot Frog Desk` (`feac2f29-...`), token hash **cocok** dengan `secrets.h`
- Akun pemilik (`owner`) sudah tertaut ke device

---

## 2. Sebelum flash: isi kredensial

Buka `firmware/MewBot_ESP32C3/secrets.h`:

```cpp
#define WIFI_SSID           "NAMA_WIFI_RUMAH_ANDA"   // <- ganti (2.4 GHz!)
#define WIFI_PASSWORD       "PASSWORD_WIFI_ANDA"     // <- ganti
```

- Wi-Fi harus **2.4 GHz**; ESP32-C3 tidak bisa 5 GHz.
- Kalau dikosongkan/dibiarkan placeholder: **tidak apa-apa**. Firmware v1.9.0 tidak akan
  mencoba connect ke SSID palsu; Anda provisioning lewat portal SoftAP (langkah 4).
- `MEWBOT_API_HOST`, `MEWBOT_DEVICE_ID`, `MEWBOT_DEVICE_TOKEN` **sudah benar** — jangan diubah.
  `MEWBOT_DEVICE_ID` sebenarnya tidak dipakai firmware (autentikasi murni via token), jadi
  kalau angkanya beda pun tidak masalah.

---

## 3. Flash firmware

### 3a. Compile (verifikasi dulu)

```powershell
$cli = "C:\Users\rizki\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe"

& $cli compile -b esp32:esp32:nologo_esp32c3_super_mini `
  --build-property "upload.maximum_size=1835008" `
  --build-property "build.partitions=partitions" `
  "firmware\MewBot_ESP32C3"
```

Contoh output yang benar:

```text
Sketch uses 1375315 bytes (74%) of program storage space. Maximum is 1835008 bytes.
Global variables use 38904 bytes (11%) of dynamic memory ...
```

### 3b. Cari port lalu upload

```powershell
& $cli board list
```

Upload (ganti `COM5` sesuai hasil `board list`):

```powershell
& $cli upload -p COM5 -b esp32:esp32:nologo_esp32c3_super_mini `
  --build-property "upload.maximum_size=1835008" `
  --build-property "build.partitions=partitions" `
  "firmware\MewBot_ESP32C3"
```

### 3c. Kalau upload gagal / board tidak terdeteksi
1. Cabut USB.
2. Tahan tombol **BOOT** di board.
3. Colok USB sambil tetap menahan BOOT ±2 detik, lalu lepas.
4. Ulangi upload. Mode ROM bootloader ini tidak bisa ter-brick oleh software.

### 3d. Alternatif via Arduino IDE 2.x
- Board: **Nologo ESP32C3 Super Mini**
- Port: COMx
- Upload. `partitions.csv` di folder sketch dikenali otomatis; kalau muncul
  "sketch too big", pastikan `upload.maximum_size=1835008`.

---

## 4. Provisioning Wi-Fi (kalau `secrets.h` belum diisi)

1. Nyalakan MewBot. Layar menampilkan kodok (atau jam).
2. **Tahan sensor sentuh 3 detik** → layar berubah jadi `WI-FI SETUP PORTAL`, countdown 180 detik.
3. Di HP: sambungkan ke Wi-Fi **`MewBot-Setup`** (tanpa password).
4. Buka browser ke **`http://192.168.4.1`**.
5. Pilih SSID dari daftar (atau ketik manual) → isi password → **Simpan & Hubungkan**.
6. Portal menutup sendiri, perangkat reconnect, kredensial tersimpan di NVS.
7. Kalau perlu hapus jaringan lama: tombol **Hapus** di daftar "Profil Tersimpan" (maks 8 profil).

Membatalkan setup: ketuk sensor sekali, atau tekan **Batal & Keluar** di portal.

---

## 5. Cek lewat Serial Monitor (opsional, sangat membantu)

Baud: **115200**. Urutan log normal saat boot:

```text
[SETUP] Mode awal: PET
[SETUP] OLED SH1106 siap.
[SETUP] Touch Sensor TTP223: READY | ADXL345: DETECTED
[SETUP] Pet Animation Engine siap (155 frame PROGMEM).
[OTA] Running partition: app0 ... | Target slot: app1
[WIFI] Menghubungkan ke profil Wi-Fi slot 0: 'SSID_ANDA'...
[WIFI] Berhasil terhubung! IP: 192.168.x.x (Slot 0)
[TIME] Sinkronisasi NTP Sukses! Epoch WIB: ...
```

Kalau baris terakhir belum muncul, perangkat **belum akan polling** (memang by design,
TLS butuh waktu valid). Penyebab umum: jaringan memblokir UDP 123 (NTP) atau Wi-Fi 5 GHz.

---

## 6. Buka dashboard

1. Buka `https://mew-frog.vercel.app`
2. Login dengan akun Supabase yang sudah jadi `owner` device.
3. Halaman **Home** menampilkan status:
   - **Online** = heartbeat ≤ 30 detik
   - **Offline (Stale Data)** = pernah terhubung tapi sudah lama tidak ada heartbeat
   - **Offline** = belum pernah terhubung

### Halaman dan fungsinya
| Halaman | Fungsi |
|---|---|
| Home | Status, telemetri (RSSI, heap, uptime, sensor), ganti mode PET/CLOCK, kirim pesan cepat |
| Pesan (`/pesan`) | Tulis pesan (maks 80 karakter) + preview OLED live, antrean, batalkan pesan |
| Riwayat (`/memories`) | Arsip pesan yang sudah diterima perangkat, pencarian, retensi 90 hari |
| Template (`/notes`) | Template pesan per kategori, bisa ditambah/diedit/dihapus, kirim 1 klik |
| Timeline | Riwayat aktivitas (terjemahan manusiawi dari `activity_events`) |

### Mengelola Template Pesan
1. Buka **Template** (`/notes`).
2. **Tambah:** klik "Tambah Template", isi kategori, judul, dan isi (maks 80 karakter).
3. **Edit:** klik **Edit** pada kartu template, ubah isinya, lalu "Simpan Perubahan".
4. **Hapus:** klik **Hapus**, lalu konfirmasi pada modal yang muncul.
5. Template yang masih berlabel **Contoh** belum tersimpan di database. Klik
   "Simpan sebagai template" agar bisa diedit atau dihapus.

Kategori: Umum, Pengingat, Sapaan, Semangat, Lainnya.
| Settings | Alarm harian, diagnostik hardware, restart remote |

PWA: buka menu browser → **Add to Home Screen** untuk akses seperti aplikasi.

---

## 7. Pemakaian harian di perangkat

| Aksi | Efek |
|---|---|
| Ketuk sensor (singkat) | Ganti mode **Kodok ↔ Jam** |
| Tahan 3 detik | Buka portal Wi-Fi (`MewBot-Setup`) |
| Ketuk saat portal aktif | Batal, kembali ke mode sebelumnya |
| Ketuk saat pesan tampil | Halaman `[1/2] → [2/2]`, ketuk lagi = tutup lebih awal (ACK) |
| Elus lembut | Kodok tertawa (`PET_LAUGHING`) |
| Goyang sedang | Kodok marah (`PET_ANGRY`) |
| Guncang keras | Kodok pusing (`PET_DIZZY`) |
| Gerak saat tidur | Kodok kaget (`PET_SURPRISED`) |
| Alarm berbunyi | Kodok melompat senang (`PET_HAPPY`) |

### Alur Pesan
```text
Dashboard kirim pesan  ->  perangkat poll (<=5 s)  ->  tampilan singkat 1,8 s
   ->  kartu pesan 15 s (word-wrap 19 char/baris, maks 2 halaman)
   ->  ACK otomatis / saat ditutup  ->  masuk ke Riwayat Pesan
```

Batas: maksimal **10 pesan** menunggu di antrean; kelebihan ditolak (HTTP 429).
Pesan yang sudah diterima tidak bisa dibatalkan; yang masih antre bisa dihapus dari dashboard.

### Jam & alarm
- Jam = NTP (WIB) saat online, lalu berjalan dengan osilator lokal saat offline.
- Saat offline, tanggal ditandai `OFF dd/mm` agar jelas bukan waktu tersinkron.
- **Alarm hanya berbunyi jika jam sudah pernah sinkron** minimal sekali (NTP atau epoch di NVS).
- Alarm bersifat lokal: tetap berbunyi walau internet mati, dan tidak butuh dashboard.

### Mode: siapa yang menang?
- Mode bisa diubah dari perangkat (ketuk) **atau** dashboard (tombol PET/CLOCK).
- Perubahan dari dashboard punya `config_revision`; perangkat menyimpan revisi terakhir.
- Artinya: pilihan terakhir yang Anda lakukan (di perangkat atau dashboard) akan bertahan,
  tidak lagi saling timpa setiap 5 detik seperti firmware lama.

---

## 7b. Update Firmware (OTA)

Memperbarui firmware **tanpa mencabut kabel USB**. Semua dilakukan dari halaman Settings.

### Cara memakai
1. Buka dashboard → **Settings** → kartu **Update Firmware (OTA)**.
2. Kartu menampilkan versi terpasang dan daftar build yang tersedia di server
   (versi, ukuran, 12 karakter pertama SHA-256).
3. Pilih build → **Kirim Perintah Update** → konfirmasi.
4. Perangkat mengunduh saat polling berikutnya (≤5 detik bila online). Layar OLED
   menampilkan `Menghubungkan...` lalu persentase unduhan.
5. Setelah SHA-256 cocok, perangkat menulis slot cadangan, reboot, dan boot ke firmware baru.
6. Hasilnya muncul di **Timeline**: "Firmware Diperbarui" atau "Update Firmware Gagal"
   beserta alasannya.

### Syarat
- Perangkat **online** saat perintah dikirim. Perintah hanya berlaku **30 menit**;
  kalau perangkat mati lebih lama, kirim ulang.
- Hanya **satu** perintah update boleh menunggu. Kirim yang baru setelah yang lama selesai
  atau dibatalkan.
- Sumber file harus **HTTPS** yang sertifikatnya dirantai ke ISRG Root X1
  (domain dashboard sendiri aman).
- Update butuh 1–2 menit dan memblokir loop utama selama proses. Jangan cabut daya.

### Rilis firmware baru (untuk Anda)
```powershell
# 1. Naikkan versi di firmware/MewBot_ESP32C3/config.h
# 2. Compile
$cli = "C:\Users\rizki\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe"
& $cli compile -b esp32:esp32:nologo_esp32c3_super_mini `
  --build-property "upload.maximum_size=1835008" `
  --build-property "build.partitions=partitions" `
  "firmware\MewBot_ESP32C3"

# 3. Salin binary ke folder publik
$bin = Get-ChildItem "$env:LOCALAPPDATA\arduino\sketches" -Recurse -Filter "MewBot_ESP32C3.ino.bin" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
Copy-Item $bin.FullName "dashboard\public\firmware\mewbot-1.9.0.bin"

# 4. Perbarui manifest (SHA-256 dihitung otomatis)
cd dashboard
npm run firmware:manifest

# 5. Deploy
git add public/firmware && git commit -m "release: firmware 1.9.0" && git push
```

Jangan pernah mengetik SHA-256 manual — manifest yang menghitungnya, karena hash salah
ketik adalah penyebab kegagalan OTA yang paling sulit dilacak.

### Kalau update gagal
Firmware lama **tetap utuh**: `Update` hanya menulis ke slot cadangan, dan bootloader
melakukan rollback otomatis kalau firmware baru gagal boot. Jalur recovery kabel USB
selalu tersedia sebagai jalan terakhir.

### Catatan penting
Versi **1.9.0 harus di-flash lewat USB sekali** (langkah 3 di atas) bila perangkat belum pernah menerima 1.8.0, karena protokol
pelaporan hasil update belum ada di 1.7.7. Setelah itu, pembaruan berikutnya bisa OTA.

---

## 8. Troubleshooting

| Gejala | Cek |
|---|---|
| Layar kosong/putih | I2C: SDA=8, SCL=9, alamat `0x3C`, daya 3.3 V. Coba I2C scanner. |
| `ADXL345: NOT FOUND` | Kabel I2C, alamat `0x53`. Firmware akan probe ulang tiap 5 detik. |
| Sentuhan tidak responsif | Modul TTP223 mungkin active-low. Ubah `TOUCH_ACTIVE_HIGH` di `config.h`. |
| Tidak muncul di dashboard | Wi-Fi 2.4 GHz? Cek log `[WIFI]` lalu `[TIME]`. Tanpa NTP, polling tidak jalan. |
| Polling balas **403** | Hash token tidak cocok. `DEVICE_TOKEN_SECRET_SALT` di Vercel harus sama dengan salt saat hash di DB dibuat. |
| Dashboard menampilkan fw lama (`1.2.0-virtual`) | Itu data simulator. Akan berubah setelah alat benar-benar poll. |
| Tombol Restart tidak berefek | Pastikan firmware **1.9.0** (bug case `restart` sudah diperbaiki). |
| Pesan tidak muncul | Perangkat offline, atau antrean penuh (10), atau pesan sudah kedaluwarsa. |
| Gerakan terlalu sensitif / tidak peka | Ambang gestur (`45/140/320`) perlu kalibrasi manual di `sensor_manager.cpp`. |
| Tombol update OTA tidak aktif | Belum ada build di manifest. Jalankan `npm run firmware:manifest` di folder `dashboard` lalu deploy. |
| OTA gagal dengan `Unduhan HTTP gagal: kode 404` | File `.bin` belum ter-deploy atau URL-nya salah. Cek `curl -I <url>`. |
| OTA gagal dengan `Checksum SHA-256 tidak cocok` | File di server berbeda dengan yang tercatat di manifest. Jalankan ulang `npm run firmware:manifest` lalu deploy. |
| OTA gagal dengan `Heap memori ... tidak mencukupi` | Perangkat kehabisan RAM saat perintah tiba. Restart dulu, lalu kirim ulang. |
| Perintah update hilang sendiri | Perintah hanya berlaku 30 menit. Kirim ulang saat perangkat online. |

---

## 9. Keamanan & perawatan

- `firmware/MewBot_ESP32C3/secrets.h` dan `dashboard/.env.local` **jangan pernah** di-commit
  atau dibagikan. Keduanya sudah masuk `.gitignore`.
- Device token = kunci perangkat. Kalau bocor, ganti token di `secrets.h` **dan** update
  `device_token_hash` di tabel `devices`.
- `SUPABASE_SERVICE_ROLE_KEY` hanya untuk server Vercel; jangan pernah dimasukkan ke firmware.
- Penulisan NVS dibatasi (jam: maks 1x/jam) untuk memperpanjang umur flash.
- Kalau perlu "reset bersih": long-press → hapus semua profil Wi-Fi di portal, lalu flash ulang.

---

## 10. Batasan yang diketahui saat ini

1. **Satu device per akun** — semua query dashboard memakai device pertama milik user.
2. **Maksimal 2 akun** per device (ditegakkan trigger database).
3. Registrasi device/user masih manual (tidak ada halaman pairing).
4. Belum ada uji runtime di hardware; ambang sensor masih nilai awal yang perlu kalibrasi.
5. OTA belum diverifikasi di perangkat fisik — mekanismenya sudah ada dan lolos uji statis,
   tapi pembuktian terakhir butuh satu kali percobaan nyata.
6. Setiap rilis firmware butuh deploy ulang dashboard (binary ikut di `public/firmware/`).
