# OTA Firmware dari Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memungkinkan pembaruan firmware MewBot dari halaman Settings, dengan verifikasi SHA-256 dan pelaporan hasil yang jujur.

**Architecture:** Firmware `.bin` disajikan sebagai aset statis dari `dashboard/public/firmware/` (satu origin, cert Let's Encrypt yang sudah dipercaya firmware). Skrip manifest menghitung SHA-256 & ukuran otomatis. Aksi `ota` di API dashboard menaruh baris `device_commands`, lalu perangkat mengambilnya lewat poll yang sudah ada. Hasil update dilaporkan balik lewat endpoint ACK dengan status `applied`/`failed`.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Supabase (Postgres + service role), Arduino/ESP32-C3 (C++), Node 20 ESM untuk skrip & tes.

**Spec:** `docs/superpowers/specs/2026-11-18-ota-firmware-design.md`

## Global Constraints

- Semua teks UI, komentar, dan pesan error berbahasa Indonesia.
- Firmware **1.8.0**; `FIRMWARE_VERSION` di `firmware/MewBot_ESP32C3/config.h`.
- Batas slot aplikasi: **1.835.008 byte** per slot (`app0`/`app1` di `partitions.csv`). Binary saat ini 1.375.472 byte → sisa ~449 KB.
- `command_type` di DB hanya boleh `'set_mode' | 'set_alarm' | 'restart' | 'ota'` (huruf kecil).
- `device_commands.status` hanya boleh `'pending' | 'claimed' | 'accepted' | 'applied' | 'failed' | 'expired'`.
- `activity_events.event_type` hanya boleh `'online' | 'offline' | 'mode_change' | 'message_received' | 'touch_interaction' | 'wifi_reconnect' | 'alarm_triggered'` — peristiwa OTA memakai `mode_change` + `metadata.action`.
- URL firmware wajib HTTPS. `sha256` wajib 64 karakter heksadesimal.
- Perintah OTA kedaluwarsa **30 menit** setelah dibuat.
- Tidak boleh ada emoji kodok di firmware maupun komponen UI.
- Tes bersifat statis (regex/`includes`/urutan `indexOf`) mengikuti suite yang sudah ada, **kecuali** tes manifest yang benar-benar menjalankan fungsi (lihat Task 1).
- Perintah build firmware yang dipakai:
  `& "C:\Users\rizki\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe" compile -b esp32:esp32:nologo_esp32c3_super_mini --build-property "upload.maximum_size=1835008" --build-property "build.partitions=partitions" "firmware\MewBot_ESP32C3"`

## Review Focus

- **URL firmware tidak bisa diunduh** (salah tulis, file belum dideploy, host non-HTTPS): server harus menolak sebelum perintah masuk antrean, dengan pesan yang menyebut sebabnya — bukan menerima lalu gagal diam-diam di alat.
- **Dua perintah OTA bersamaan**: permintaan kedua harus ditolak dan UI menjelaskan bahwa masih ada update menunggu, supaya alat tidak mengunduh dua binary berturut-turut.
- **Update gagal di tengah jalan** (hash beda / Wi-Fi putus): dashboard harus menampilkan `failed` beserta alasannya, bukan `applied`.
- **Perintah kedaluwarsa** karena alat mati lebih dari 30 menit: UI harus berhenti menampilkan "menunggu" dan menyatakan perintah kedaluwarsa, bukan menggantung selamanya.
- **Hash salah ketik pada mode URL manual**: server mencocokkan SHA-256 dengan manifest untuk URL internal, sehingga kesalahan tertangkap sebelum dikirim.

---

### Task 0: Simpan pekerjaan perbaikan sebelumnya sebagai baseline

**Files:**
- Modify: (hanya index git)

**Interfaces:**
- Consumes: —
- Produces: riwayat git bersih sehingga diff fitur OTA mudah ditinjau.

- [ ] **Step 1: Pastikan tidak ada perubahan yang belum diinginkan**

Run: `git status --short`
Expected: hanya file yang memang hasil perbaikan kesiapan firmware (`docs/CHANGELOG.md`, `docs/PANDUAN_PENGGUNAAN.md`, `firmware/MewBot_ESP32C3/*`, `dashboard/tests/verify-firmware-readiness.mjs`, `docs/superpowers/specs/*`).

- [ ] **Step 2: Commit baseline**

```bash
git add -A
git commit -m "fix(firmware): persist config revision, case-insensitive commands, wifi placeholder guard"
```

---

### Task 1: Skrip manifest firmware

**Files:**
- Create: `dashboard/scripts/build-firmware-manifest.mjs`
- Create: `dashboard/public/firmware/.gitkeep`
- Modify: `dashboard/package.json` (tambah skrip `firmware:manifest`)
- Test: `dashboard/tests/verify-ota.mjs`

**Interfaces:**
- Consumes: —
- Produces:
  - `buildManifest(firmwareDir: string) -> { generated_at: string, firmware: Array<{ version: string, file: string, url: string, sha256: string, size: number }> }`
  - `writeManifest(firmwareDir: string, manifestPath: string) -> manifest` (memanggil `buildManifest` lalu menulis JSON)
  - Nama file yang dikenali: `mewbot-<x.y.z>.bin`. File lain diabaikan.
  - `url` selalu berbentuk `/firmware/<file>`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `dashboard/tests/verify-ota.mjs` dengan helper `assert(condition, message)` dan penghitung `passedTests`/`totalTests` seperti suite lain, lalu bagian pertama:

```js
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { buildManifest, writeManifest } from '../scripts/build-firmware-manifest.mjs';

const tmp = mkdtempSync(path.join(tmpdir(), 'mewbot-fw-'));
const binA = Buffer.from('firmware-baru');
const binB = Buffer.from('firmware-lama');
writeFileSync(path.join(tmp, 'mewbot-1.8.0.bin'), binA);
writeFileSync(path.join(tmp, 'mewbot-1.7.7.bin'), binB);
writeFileSync(path.join(tmp, 'catatan.txt'), 'abaikan');

const manifest = buildManifest(tmp);

assert(manifest.firmware.length === 2, 'Manifest: hanya file mewbot-<versi>.bin yang dihitung');
assert(manifest.firmware[0].version === '1.8.0', 'Manifest: build terbaru berada di urutan pertama');
assert(manifest.firmware[0].url === '/firmware/mewbot-1.8.0.bin', 'Manifest: url berbentuk /firmware/<file>');
assert(
  manifest.firmware[0].sha256 === createHash('sha256').update(binA).digest('hex'),
  'Manifest: sha256 cocok dengan isi file'
);
assert(manifest.firmware[0].size === binA.length, 'Manifest: size sama dengan ukuran file');

const written = writeManifest(tmp, path.join(tmp, 'manifest.json'));
assert(
  JSON.parse(readFileSync(path.join(tmp, 'manifest.json'), 'utf-8')).firmware[0].sha256 === written.firmware[0].sha256,
  'Manifest: writeManifest menulis JSON yang bisa dibaca kembali'
);
rmSync(tmp, { recursive: true, force: true });
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `node dashboard/tests/verify-ota.mjs`
Expected: FAIL — `Cannot find module '../scripts/build-firmware-manifest.mjs'`

- [ ] **Step 3: Implementasikan `buildManifest` dan `writeManifest`**

Di `dashboard/scripts/build-firmware-manifest.mjs`:

- `buildManifest` membaca direktori dengan `readdirSync(firmwareDir)`, menyaring nama yang cocok `/^mewbot-(\d+\.\d+\.\d+)\.bin$/`, menghitung `sha256` dengan `createHash('sha256').update(readFileSync(...))`, mengisi `size` dari `Buffer.length`, lalu mengurutkan menurun berdasarkan versi numerik (bandingkan tiap komponen `split('.')` sebagai angka, bukan string).
- `writeManifest` memanggil `buildManifest`, menulis `JSON.stringify(manifest, null, 2)`, mengembalikan manifest.
- Blok eksekusi langsung: bila berkas dijalankan (`process.argv[1]` sama dengan `fileURLToPath(import.meta.url)`), panggil `writeManifest(path.join(process.cwd(), 'public/firmware'), path.join(process.cwd(), 'public/firmware/manifest.json'))` — jadi skrip dijalankan dari folder `dashboard`.

Tambah ke `dashboard/package.json`:
```json
"firmware:manifest": "node scripts/build-firmware-manifest.mjs"
```

Buat file kosong `dashboard/public/firmware/.gitkeep`.

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `node dashboard/tests/verify-ota.mjs`
Expected: PASS untuk 6 assertion manifest.

- [ ] **Step 5: Commit**

```bash
git add dashboard/scripts/build-firmware-manifest.mjs dashboard/tests/verify-ota.mjs dashboard/package.json dashboard/public/firmware/.gitkeep
git commit -m "feat(ota): add firmware manifest generator with sha256"
```

---

### Task 2: Aksi `ota` di API dashboard

**Files:**
- Modify: `dashboard/src/app/api/dashboard/device/route.ts` (sisipkan sebelum blok `cancel_command`)
- Test: `dashboard/tests/verify-ota.mjs`

**Interfaces:**
- Consumes: `getAuthenticatedUser()`, `getSupabaseAdmin()`, tabel `device_members`, `device_commands`, `activity_events`.
- Produces: `POST /api/dashboard/device` menerima
  `{ action: 'ota', payload: { url: string, sha256: string, version?: string } }`
  dan membalas `{ status: 'ok', command: {...}, feedback: string }`, atau `400`/`409` dengan `{ error: string }`.

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan ke `dashboard/tests/verify-ota.mjs`:

```js
const deviceRoute = readFileSync(path.join(rootDir, 'dashboard/src/app/api/dashboard/device/route.ts'), 'utf-8');

assert(deviceRoute.includes("action === 'ota'"), 'API: menangani aksi ota');
assert(deviceRoute.includes("command_type: 'ota'"), 'API: menyimpan perintah dengan tipe ota');
assert(/sha256[\s\S]{0,120}\/\^\[a-f0-9\]\{64\}\$\/i/.test(deviceRoute), 'API: sha256 wajib 64 karakter heksadesimal');
assert(deviceRoute.includes("startsWith('https://')"), 'API: URL manual wajib HTTPS');
assert(
  deviceRoute.includes("command_type', 'ota'") && deviceRoute.includes(".in('status', ['pending', 'claimed'])"),
  'API: menolak perintah ota ganda yang masih menunggu'
);
assert(deviceRoute.includes('30 * 60 * 1000'), 'API: perintah ota kedaluwarsa 30 menit');
assert(deviceRoute.includes('/firmware/manifest.json'), 'API: memverifikasi hash URL internal terhadap manifest');
assert(deviceRoute.includes('firmware_update_requested'), 'API: mencatat permintaan update ke linimasa');
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `node dashboard/tests/verify-ota.mjs`
Expected: 8 FAIL baru pada bagian `API:`.

- [ ] **Step 3: Implementasikan cabang `ota`**

Di `route.ts`, sebelum blok `if (action === 'cancel_command')`, tambahkan blok `if (action === 'ota')` yang:

1. Membaca `payload?.url`, `payload?.sha256`, `payload?.version`.
2. Menolak (`400`) bila `sha256` tidak cocok `/^[a-f0-9]{64}$/i`.
3. Menolak (`400`) bila `version` ada tapi tidak cocok `/^\d+\.\d+\.\d+$/`.
4. Menolak (`400`) bila `url` tidak diawali `https://` **dan** tidak diawali `/firmware/`.
5. Bila `url` diawali `/firmware/`: bentuk `absoluteUrl = new URL(url, req.nextUrl.origin).toString()`, lalu `fetch(new URL('/firmware/manifest.json', req.nextUrl.origin))`; bila respons OK, cari entri dengan `file` yang cocok dan bandingkan `sha256` — beda berarti `400` "SHA-256 tidak cocok dengan manifest".
6. Menolak (`409`) bila sudah ada perintah menunggu:
   `.from('device_commands').select('id').eq('device_id', deviceId).eq('command_type', 'ota').in('status', ['pending', 'claimed']).maybeSingle()`.
7. Menyisipkan baris dengan `command_type: 'ota'`, `payload: { url: absoluteUrl, sha256, version: version || null, requested_by: user.id }`, `status: 'pending'`, `created_by: user.id`, `expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()`.
8. Mencatat `activity_events` dengan `event_type: 'mode_change'`, `metadata: { action: 'firmware_update_requested', version, sha256: sha256.slice(0, 12), url_host: new URL(absoluteUrl).host, changed_by: user.id }`.
9. Membalas feedback: `Perintah update firmware ke v<versi> dijadwalkan. MewBot akan mengunduh saat polling berikutnya.`

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `node dashboard/tests/verify-ota.mjs`
Expected: seluruh assertion `API:` PASS, tidak ada regresi pada assertion manifest.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/api/dashboard/device/route.ts dashboard/tests/verify-ota.mjs
git commit -m "feat(ota): enqueue firmware update command from dashboard api"
```

---

### Task 3: Hasil OTA yang jujur (ACK berstatus)

**Files:**
- Modify: `dashboard/src/app/api/device/v1/commands/[id]/ack/route.ts`
- Modify: `firmware/MewBot_ESP32C3/cloud_client.h:61`
- Modify: `firmware/MewBot_ESP32C3/cloud_client.cpp:498-516`
- Modify: `firmware/MewBot_ESP32C3/MewBot_ESP32C3.ino:280-310`
- Test: `dashboard/tests/verify-ota.mjs`

**Interfaces:**
- Consumes: `getSupabaseAdmin()`, `hashDeviceToken()`, tabel `device_commands` (`id`, `status`, `device_id`, `payload`), `activity_events`.
- Produces:
  - `POST /api/device/v1/commands/[id]/ack` menerima body opsional `{ status?: 'applied' | 'failed', error?: string }`; default `applied`.
  - `bool CloudClient::sendCommandAck(const String& commandId, bool success = true, const String& errorMessage = "")` — mengirim `{"status":"applied"|"failed","error":"..."}`.

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan ke `dashboard/tests/verify-ota.mjs`:

```js
const ackRoute = readFileSync(path.join(rootDir, 'dashboard/src/app/api/device/v1/commands/[id]/ack/route.ts'), 'utf-8');
const cloudHeader = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/cloud_client.h'), 'utf-8');
const cloudCpp = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/cloud_client.cpp'), 'utf-8');
const mainIno = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/MewBot_ESP32C3.ino'), 'utf-8');

assert(/bool sendCommandAck\(const String& commandId, bool success = true/.test(cloudHeader), 'ACK: sendCommandAck menerima status hasil');
assert(cloudCpp.includes('"failed"') && cloudCpp.includes('"applied"'), 'ACK: firmware mengirim status applied/failed');
assert(ackRoute.includes("'failed'") && ackRoute.includes("'applied'"), 'ACK: endpoint menerima status applied/failed dari perangkat');
assert(ackRoute.includes('ota_result'), 'ACK: endpoint menyimpan hasil update ke payload');
assert(ackRoute.includes('firmware_update_failed'), 'ACK: kegagalan update tercatat di linimasa');

const otaIdx = mainIno.indexOf('otaManager.executeOtaUpdate');
const ackAfterIdx = mainIno.indexOf('cloudClient.sendCommandAck', otaIdx);
assert(otaIdx !== -1 && ackAfterIdx > otaIdx, 'ACK: firmware melaporkan hasil setelah percobaan update, bukan sebelumnya');
assert(!mainIno.includes('sendCommandAck(res.commandId);\n\n        String otaError;'), 'ACK: tidak ada lagi ACK sebelum update dijalankan');
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `node dashboard/tests/verify-ota.mjs`
Expected: 7 FAIL baru pada bagian `ACK:`.

- [ ] **Step 3: Implementasikan endpoint ACK**

Di `ack/route.ts`:

1. Baca body: `const body = await req.json().catch(() => ({}));`
2. `const resultStatus = body?.status === 'failed' ? 'failed' : 'applied';`
3. `const resultError = typeof body?.error === 'string' ? body.error.slice(0, 200) : null;`
4. Saat update, kirim `status: resultStatus` dan gabungkan metadata:
   `payload` diperbarui menjadi `{ ...(cmd.payload || {}), ota_result: { ok: resultStatus === 'applied', error: resultError, reported_at: new Date().toISOString() } }` — sertakan `payload` pada `select` di langkah pengecekan.
5. Bila `resultStatus === 'failed'`, sisipkan `activity_events` (`event_type: 'mode_change'`, `metadata: { action: 'firmware_update_failed', error: resultError }`).
6. Respons: `{ status: 'ok', command_id, event: resultStatus }`.
7. Idempotensi: bila `cmd.status` sudah `applied` **atau** `failed`, kembalikan `event: 'already_acknowledged'` tanpa menulis ulang.

- [ ] **Step 4: Implementasikan sisi firmware**

`cloud_client.h`:
```cpp
bool sendCommandAck(const String& commandId, bool success = true, const String& errorMessage = "");
```

`cloud_client.cpp` — bangun body JSON dengan `ArduinoJson` (`JsonDocument doc; doc["status"] = success ? "applied" : "failed";` dan `doc["error"] = errorMessage;` bila tidak kosong), lalu `http.POST(serialized)`. Definisi di `.cpp` **tidak boleh** mengulang nilai default parameter (cukup `const String& errorMessage`), karena default hanya ditulis di deklarasi `.h` — kalau diulang, kompilasi gagal.

`MewBot_ESP32C3.ino` cabang OTA: hapus `cloudClient.sendCommandAck(res.commandId)` sebelum update; setelah `executeOtaUpdate` selesai panggil `cloudClient.sendCommandAck(res.commandId, otaSuccess, otaError)` — untuk sukses kirim ACK lalu `delay(1000)` dan `ESP.restart()`; untuk gagal kirim ACK gagal lalu jalankan blok error yang sudah ada.

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `node dashboard/tests/verify-ota.mjs`
Expected: seluruh assertion `ACK:` PASS.

- [ ] **Step 6: Compile firmware**

Run: perintah build di Global Constraints.
Expected: `Sketch uses` di bawah 1.835.008 byte, tanpa error.

- [ ] **Step 7: Commit**

```bash
git add "dashboard/src/app/api/device/v1/commands/[id]/ack/route.ts" firmware/MewBot_ESP32C3/cloud_client.h firmware/MewBot_ESP32C3/cloud_client.cpp firmware/MewBot_ESP32C3/MewBot_ESP32C3.ino dashboard/tests/verify-ota.mjs
git commit -m "fix(ota): report real update outcome instead of always applied"
```

---

### Task 4: Kartu Settings & linimasa

**Files:**
- Modify: `dashboard/src/app/settings/page.tsx:403-424` (ganti kartu "Firmware & Pemulihan USB")
- Modify: `dashboard/src/lib/activity-helper.ts` (tambah cabang di dalam `if (type === 'mode_change')`)
- Test: `dashboard/tests/verify-ota.mjs`

**Interfaces:**
- Consumes: aksi `ota` (Task 2), `cancel_command` yang sudah ada, `/api/dashboard/overview` (`device.firmware_version`, `pending_commands`, `recent_activities`), `/firmware/manifest.json` (Task 1).
- Produces: —

- [ ] **Step 1: Tulis tes yang gagal**

```js
const settingsPage = readFileSync(path.join(rootDir, 'dashboard/src/app/settings/page.tsx'), 'utf-8');
const activityHelper = readFileSync(path.join(rootDir, 'dashboard/src/lib/activity-helper.ts'), 'utf-8');

assert(settingsPage.includes('/firmware/manifest.json'), 'Settings: memuat daftar build dari manifest');
assert(settingsPage.includes("action: 'ota'"), 'Settings: mengirim aksi ota ke API');
assert(settingsPage.includes('showOtaModal'), 'Settings: memakai modal konfirmasi sebelum update');
assert(settingsPage.includes("action: 'cancel_command'"), 'Settings: bisa membatalkan perintah update yang menunggu');
assert(settingsPage.includes('Update Firmware (OTA)'), 'Settings: kartu OTA berlabel jelas');
assert(settingsPage.includes('expires_at') && settingsPage.includes('Kedaluwarsa'), 'Settings: perintah menunggu yang lewat masa berlaku ditandai kedaluwarsa');
assert(activityHelper.includes('firmware_update_applied'), 'Linimasa: menampilkan update berhasil');
assert(activityHelper.includes('firmware_update_failed'), 'Linimasa: menampilkan update gagal beserta alasan');
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `node dashboard/tests/verify-ota.mjs`
Expected: 7 FAIL baru pada bagian `Settings:`/`Linimasa:`.

- [ ] **Step 3: Implementasikan kartu Settings**

Ganti kartu statis "Firmware & Pemulihan USB" dengan kartu `Update Firmware (OTA)` yang berisi:

- State lokal: `otaBuilds`, `selectedBuild`, `manualUrl`, `manualSha`, `manualVersion`, `showOtaModal`, `sendingOta`, `otaError`.
- `useEffect` mengambil `/firmware/manifest.json` (abaikan kegagalan dengan daftar kosong).
- Daftar build: versi, ukuran (`(size/1024/1024).toFixed(2)` MB), 12 karakter pertama SHA. Tombol `Pilih` mengisi `selectedBuild`.
- Mode manual: input URL + SHA + versi, dengan catatan bahwa SHA harus 64 karakter heksadesimal.
- Tombol `Kirim Perintah Update` membuka modal; modal menjelaskan alat harus online, proses 1-2 menit, layar menampilkan progres, alat reboot sendiri, recovery USB tetap tersedia.
- Konfirmasi memanggil `POST /api/dashboard/device` dengan `action: 'ota'` dan payload dari pilihan aktif; tampilkan `feedback` atau `error` lewat `setToast`; panggil `fetchSettings()` setelah berhasil.
- Panel perintah menunggu: filter `data.pending_commands` untuk `command_type === 'ota'`, tampilkan waktu dibuat dan tombol `Batalkan` yang memanggil `action: 'cancel_command'` dengan `command_id`. Bandingkan `new Date(command.expires_at)` dengan waktu sekarang: yang sudah lewat ditandai label **Kedaluwarsa** dan dijelaskan bahwa perangkat harus online sebelum batas waktu agar perintah dijalankan.
- Baris "Terpasang": `dev?.firmware_version`, dengan catatan bahwa versi baru muncul setelah perangkat melapor.

- [ ] **Step 4: Implementasikan cabang linimasa**

Di `activity-helper.ts`, dalam blok `mode_change`, tambah tiga cabang `meta.action`:

- `firmware_update_requested` → judul "Menjadwalkan Update Firmware", badge "Firmware", deskripsi menyebut `meta.version`.
- `firmware_update_applied` → judul "Firmware Diperbarui", badge "Berhasil".
- `firmware_update_failed` → judul "Update Firmware Gagal", badge "Gagal", deskripsi menyertakan `meta.error` bila ada.

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `node dashboard/tests/verify-ota.mjs`
Expected: seluruh assertion `Settings:` dan `Linimasa:` PASS.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/app/settings/page.tsx dashboard/src/lib/activity-helper.ts dashboard/tests/verify-ota.mjs
git commit -m "feat(ota): firmware update card in settings and timeline entries"
```

---

### Task 5: Versi 1.8.0, manifest nyata, dan dokumentasi

**Files:**
- Modify: `firmware/MewBot_ESP32C3/config.h` (`FIRMWARE_VERSION`)
- Create: `dashboard/public/firmware/mewbot-1.8.0.bin`
- Create: `dashboard/public/firmware/manifest.json`
- Modify: `docs/PANDUAN_PENGGUNAAN.md`
- Modify: `docs/CHANGELOG.md`
- Test: `dashboard/tests/verify-ota.mjs`

**Interfaces:**
- Consumes: perintah build firmware, `buildManifest` (Task 1).
- Produces: binary siap dideploy beserta manifest yang cocok.

- [ ] **Step 1: Tulis tes yang gagal**

```js
const configH = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/config.h'), 'utf-8');
const panduan = readFileSync(path.join(rootDir, 'docs/PANDUAN_PENGGUNAAN.md'), 'utf-8');
const changelog = readFileSync(path.join(rootDir, 'docs/CHANGELOG.md'), 'utf-8');

assert(/FIRMWARE_VERSION\s+"1\.8\.0"/.test(configH), 'Rilis: versi firmware naik ke 1.8.0');
assert(!panduan.includes('OTA belum tersedia'), 'Dokumen: panduan tidak lagi menyatakan OTA belum tersedia');
assert(panduan.includes('Update Firmware (OTA)'), 'Dokumen: panduan menjelaskan cara update lewat dashboard');
assert(changelog.includes('[1.8.0]'), 'Dokumen: changelog mencatat rilis 1.8.0');
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `node dashboard/tests/verify-ota.mjs`
Expected: 4 FAIL baru pada bagian `Rilis:`/`Dokumen:`.

- [ ] **Step 3: Naikkan versi dan build**

Ubah `config.h`: `#define FIRMWARE_VERSION "1.8.0"`. Jalankan perintah build di Global Constraints. Pastikan output `Sketch uses` di bawah 1.835.008 byte, lalu salin artefak ke `dashboard/public/firmware/mewbot-1.8.0.bin`:

```powershell
$bin = Get-ChildItem "$env:LOCALAPPDATA\arduino\sketches" -Recurse -Filter "MewBot_ESP32C3.ino.bin" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
Copy-Item $bin.FullName "dashboard/public/firmware/mewbot-1.8.0.bin"
```

- [ ] **Step 4: Buat manifest**

Run: `cd dashboard; node scripts/build-firmware-manifest.mjs`
Expected: `dashboard/public/firmware/manifest.json` berisi satu entri `1.8.0` dengan `sha256` 64 karakter dan `size` sama dengan ukuran file.

Verifikasi: `node -e "const m=require('./dashboard/public/firmware/manifest.json'); console.log(m.firmware)"`

- [ ] **Step 5: Perbarui dokumentasi**

- `PANDUAN_PENGGUNAAN.md`: ganti baris "OTA belum tersedia" pada tabel troubleshooting dan batasan; tambah bagian **Update Firmware (OTA)** berisi: cara membangun binary, menaruhnya di `public/firmware`, menjalankan `npm run firmware:manifest`, deploy, lalu memilih versi di Settings; syarat alat online; perkiraan durasi 1-2 menit; peringatan bahwa 1.8.0 harus di-flash USB sekali; dan catatan bahwa perintah kedaluwarsa 30 menit.
- `CHANGELOG.md`: tambah entri `[1.8.0] — 2026-11-18` berisi fitur OTA, perbaikan ACK yang jujur, manifest SHA-256, dan catatan flash USB sekali.

- [ ] **Step 6: Jalankan seluruh tes**

Run: `Get-ChildItem "dashboard\tests\verify-*.mjs" | ForEach-Object { node $_.FullName }`
Expected: semua suite exit 0, termasuk `verify-firmware-readiness.mjs` (12/12), `verify-phase1-security.mjs` (17/17), `verify-phase5-dual-ota.mjs` (19/19), dan `verify-ota.mjs` (semua assertion PASS).

- [ ] **Step 7: Commit**

```bash
git add firmware/MewBot_ESP32C3/config.h dashboard/public/firmware docs/PANDUAN_PENGGUNAAN.md docs/CHANGELOG.md dashboard/tests/verify-ota.mjs
git commit -m "release: firmware 1.8.0 with dashboard OTA updates"
```

---

### Task 6: Verifikasi pasca-deploy (manual, setelah `git push`)

**Files:**
- Modify: —

**Interfaces:**
- Consumes: hasil deploy Vercel.
- Produces: bukti bahwa host firmware memenuhi syarat `Update.begin()`.

- [ ] **Step 1: Pastikan file binary disajikan dengan Content-Length**

Run: `curl -I https://mew-frog.vercel.app/firmware/mewbot-1.8.0.bin`
Expected: `200`, ada header `content-length` = ukuran file dan `content-type: application/octet-stream`; **tidak ada** `content-encoding` (kompresi akan membuat `getSize()` salah).

- [ ] **Step 2: Pastikan manifest bisa diakses**

Run: `curl https://mew-frog.vercel.app/firmware/manifest.json`
Expected: JSON dengan entri `1.8.0` dan `sha256` yang sama dengan hasil `npm run firmware:manifest`.

- [ ] **Step 3: Uji OTA pertama dari perangkat**

Lakukan setelah firmware 1.8.0 terpasang lewat USB. Buka Settings, pilih build yang lebih baru, konfirmasi, lalu pantau Serial Monitor: `[OTA] Mengunduh: ...%`, `[OTA] SHA-256 Hasil Unduhan`, `[OTA] Update firmware sukses`, reboot, dan `devices.firmware_version` berubah di dashboard.
