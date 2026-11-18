# Desain: OTA Firmware dari Dashboard (Rilis 1.8.0)

Tanggal: 2026-11-18
Status: menunggu persetujuan

## 1. Kenapa

Mesin OTA di firmware sudah ada dan lengkap: unduh HTTPS dengan verifikasi CA,
hitung SHA-256 sambil streaming, tulis ke slot `app1`, lalu rollback otomatis
dibatalkan setelah boot sehat. Yang tidak ada adalah **cara mengirim perintah
`ota` dari dashboard**. Akibatnya satu-satunya cara memperbarui alat adalah
mencolok kabel USB.

Tujuan: setelah rilis ini, memperbarui firmware cukup dari halaman Settings.

## 2. Sasaran

- Bisa memilih build firmware yang tersedia, melihat versi + SHA-256, lalu
  mengirim perintah update dengan satu konfirmasi.
- Perangkat mengunduh, memverifikasi hash, menulis slot cadangan, reboot, dan
  dashboard menampilkan versi baru.
- Kalau update gagal (hash beda, jaringan putus, heap kurang), dashboard
  menampilkan **gagal + alasannya**, bukan "berhasil".
- Tidak ada jalur di mana kegagalan dilaporkan sebagai sukses.

## 3. Bukan sasaran

- Upload file `.bin` dari browser (kita pilih hosting lewat repo, lihat §5).
- Update massal banyak perangkat.
- Update delta / terkompresi.
- Firmware bertanda tangan (yang ada hanya SHA-256 dari server).
- Rollback otomatis untuk firmware yang boot tapi berperilaku salah.

## 4. Anti-sasaran (dianggap gagal walau fitur "jalan")

- Alat brick sampai harus disolder / tidak bisa masuk mode ROM.
- Dashboard bilang sukses padahal alat masih di versi lama.
- Update terkirim ke alat yang sedang offline lalu dieksekusi diam-diam
  berjam-jam kemudian tanpa sepengetahuan pemilik.

## 5. Keputusan yang sudah diambil

### 5.1 File firmware disimpan di `dashboard/public/firmware/`

Nama file: `mewbot-<versi>.bin` (contoh `mewbot-1.8.0.bin`).

Alasan: firmware hanya memegang **ISRG Root X1**, jadi host unduhan harus
dirantai ke Let's Encrypt. Domain Vercel yang sudah dipakai (`mew-frog.vercel.app`)
sudah memenuhi itu, jadi tidak ada risiko cert baru. Konsekuensinya setiap rilis
firmware butuh satu deploy — itu harga yang diterima.

Sebuah skrip `dashboard/scripts/build-firmware-manifest.mjs` memindai folder itu
dan menulis `public/firmware/manifest.json`:

```json
{
  "generated_at": "2026-11-18T...",
  "firmware": [
    { "version": "1.8.0", "file": "mewbot-1.8.0.bin",
      "url": "/firmware/mewbot-1.8.0.bin",
      "sha256": "ab12...", "size": 1375315 }
  ]
}
```

Diurutkan versi terbaru dulu. SHA-256 dihitung otomatis → tidak ada risiko salah
ketik hash, yang merupakan penyebab kegagalan OTA paling sulit didiagnosis.

### 5.2 Endpoint: aksi `ota` di API dashboard

`POST /api/dashboard/device` dengan:

```json
{ "action": "ota",
  "payload": { "url": "/firmware/mewbot-1.8.0.bin",
               "sha256": "ab12...", "version": "1.8.0" } }
```

Validasi server:

| Aturan | Alasan |
|---|---|
| `url` wajib, diawali `https://` (atau `/firmware/` yang diubah jadi absolut) | Firmware menolak non-TLS |
| `sha256` wajib, 64 karakter heksadesimal | Tanpa hash, `Update` tidak bisa diverifikasi |
| `version` opsional, format `x.y.z` | Dipakai untuk log & anti-downgrade nanti |
| tolak kalau sudah ada `ota` berstatus `pending`/`claimed` | Cegah antrean ganda |
| `expires_at` = sekarang + 30 menit | Cukup waktu untuk menyalakan alat, tapi tidak menggantung berhari-hari |

URL absolut dibentuk di server dari origin request, lalu disimpan ke
`device_commands.payload` sebagai `{ url, sha256, version, requested_by }`
dengan `command_type: 'ota'`. Firmware sudah membaca kunci ini apa adanya
(`cloud_client.cpp` baris 455-468), jadi **tidak perlu perubahan parsing**.

### 5.3 Hasil OTA harus jujur (ini butuh perubahan firmware)

Masalah yang ditemukan: firmware mengirim ACK **sebelum** update dijalankan
(`MewBot_ESP32C3.ino` baris 285), dan endpoint ACK selalu menulis status
`applied`. Artinya OTA yang gagal di tengah jalan tetap tampil "diterapkan".

Perbaikan:

- `sendCommandAck(id, bool success, const String& error)` mengirim body
  `{"status":"applied"|"failed","error":"..."}`.
- Endpoint ACK menerima `status`/`error`, menyimpan hasil ke
  `payload.ota_result`, dan menulis status `failed` bila gagal.
- Cabang OTA di firmware: ACK dikirim **setelah** percobaan selesai
  (sukses → ACK lalu reboot; gagal → ACK gagal + alasan, layar menampilkan
  `PET_SAD_CRYING` seperti sekarang).
- Cabang restart tetap ACK sebelum reboot (tidak ada hasil yang perlu dilaporkan).

### 5.4 UI di Settings

Kartu baru **"Update Firmware (OTA)"** menggantikan kartu info "Firmware &
Pemulihan USB" yang sekarang statis:

```
Update Firmware (OTA)                         [ Terpasang: 1.7.7 ]
-------------------------------------------------------------
Tersedia:
  ( ) 1.8.0  · 1.31 MB · sha ab12cd34...      [ Pilih ]
  ( ) 1.7.7  · 1.31 MB · sha 9f8e7d6c...      [ Pilih ]

URL manual (opsional):
  [ https://...                             ]  [ Isi otomatis ]

      [ Kirim Perintah Update ]   (buka modal konfirmasi)
```

- Daftar build diambil dari `/firmware/manifest.json` (satu origin, tidak
  lewat API agar tidak butuh auth).
- Mode lanjutan: tempel URL HTTPS + SHA sendiri untuk host lain.
- Modal konfirmasi menjelaskan: alat harus online, proses 1-2 menit, layar
  menampilkan progres, alat reboot sendiri, dan jalur USB tetap tersedia.
- Panel "Perintah menunggu": memakai `pending_commands` dari
  `/api/dashboard/overview` yang sudah ada — menampilkan status + sisa waktu
  kedaluwarsa + tombol Batalkan (memakai aksi `cancel_command` yang sudah ada).
- Setelah selesai, kartu menampilkan hasil terakhir dari `recent_activities`
  (`firmware_update_applied` / `firmware_update_failed` + alasan).

### 5.5 Linimasa

Tabel `activity_events.event_type` dibatasi CHECK, jadi tidak ada tipe baru.
Peristiwa OTA dicatat sebagai `mode_change` dengan `metadata.action`:
`firmware_update_requested`, `firmware_update_applied`, `firmware_update_failed`.
`activity-helper.ts` ditambah tiga cabang agar Timeline membacanya sebagai
kalimat manusiawi, bukan entri "tidak dikenal".

## 6. Bagian yang diserahkan ke pelaksana

- Susunan kartu Settings mengikuti gaya kartu yang sudah ada (warna, radius,
  ikon lucide).
- Nama fungsi/helper bebas selama pola repo diikuti.
- Penanganan error jaringan di UI memakai pola toast yang sudah ada.

## 7. Batasan teknis yang harus dijaga

- Binary saat ini 1.375.315 byte dari 1.835.008 byte per slot (74%).
  `Update.begin()` menerima `Content-Length`; server statis Vercel
  mengirimnya. Ini diverifikasi dengan `curl -I` sebelum rilis.
- OTA butuh heap bebas ≥ 50 KB dan blok kontigu ≥ 30 KB saat perintah tiba;
  kalau tidak, firmware menolak dengan pesan jelas (sudah ada).
- Perintah tidak akan dieksekusi bila `expires_at` lewat — perilaku
  `claim_next_device_command` yang sudah ada.
- Versi 1.8.0 harus di-flash **lewat USB sekali** karena protokol ACK baru
  belum ada di 1.7.7. Setelah itu pembaruan berikutnya bisa OTA.

## 8. Verifikasi

- Suite regresi baru `dashboard/tests/verify-ota.mjs` (gaya assertion statis
  seperti suite lain) menutup: aksi `ota` + validasi, payload keys, guard
  antrean ganda, ACK berstatus, urutan ACK-setelah-update di firmware,
  manifest berisi `sha256`/`size`/`url`, dan elemen UI Settings.
- Seluruh suite lama tetap hijau (109 assertion saat ini).
- `arduino-cli compile` untuk memastikan ukuran binary masih di bawah batas
  slot dan tidak ada perubahan RAM berbahaya.
- `curl -I https://mew-frog.vercel.app/firmware/mewbot-1.8.0.bin` untuk
  memastikan `content-length` ada dan tidak ada `content-encoding`.
