/**
 * MewBot — OTA Firmware Suite
 *
 * Mengunci fitur update firmware dari dashboard:
 *
 *  1. Manifest firmware  : skrip menghitung SHA-256 & ukuran, urut versi terbaru
 *  2. API dashboard      : aksi `ota` dengan validasi + penolakan antrean ganda
 *  3. ACK jujur          : hasil update dilaporkan `applied` / `failed`, bukan selalu sukses
 *  4. UI & linimasa      : kartu Settings, perintah menunggu, entri aktivitas
 *  5. Rilis & dokumentasi: versi 1.8.0 dan panduan pemakaian
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { buildManifest, writeManifest } from '../scripts/build-firmware-manifest.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

console.log('================================================================');
console.log(' MewBot OTA Firmware Suite');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. Manifest Firmware
// -----------------------------------------------------------------------------
const tmp = mkdtempSync(path.join(tmpdir(), 'mewbot-fw-'));
const binBaru = Buffer.from('firmware-baru');
const binLama = Buffer.from('firmware-lama');
writeFileSync(path.join(tmp, 'mewbot-1.8.0.bin'), binBaru);
writeFileSync(path.join(tmp, 'mewbot-1.7.7.bin'), binLama);
writeFileSync(path.join(tmp, 'catatan.txt'), 'abaikan');

const manifest = buildManifest(tmp);

assert(
  manifest.firmware.length === 2,
  'Manifest: hanya file mewbot-<versi>.bin yang dihitung'
);

assert(
  manifest.firmware[0].version === '1.8.0',
  'Manifest: build terbaru berada di urutan pertama'
);

assert(
  manifest.firmware[0].url === '/firmware/mewbot-1.8.0.bin',
  'Manifest: url berbentuk /firmware/<file>'
);

assert(
  manifest.firmware[0].sha256 === createHash('sha256').update(binBaru).digest('hex'),
  'Manifest: sha256 cocok dengan isi file'
);

assert(
  manifest.firmware[0].size === binBaru.length,
  'Manifest: size sama dengan ukuran file'
);

const written = writeManifest(tmp, path.join(tmp, 'manifest.json'));

assert(
  JSON.parse(readFileSync(path.join(tmp, 'manifest.json'), 'utf-8')).firmware[0].sha256 ===
    written.firmware[0].sha256,
  'Manifest: writeManifest menulis JSON yang bisa dibaca kembali'
);

rmSync(tmp, { recursive: true, force: true });

// -----------------------------------------------------------------------------
// 2. API Dashboard: Aksi `ota`
// -----------------------------------------------------------------------------
const deviceRoute = readFileSync(
  path.join(rootDir, 'dashboard/src/app/api/dashboard/device/route.ts'),
  'utf-8'
);

assert(deviceRoute.includes("action === 'ota'"), 'API: menangani aksi ota');

assert(deviceRoute.includes("command_type: 'ota'"), 'API: menyimpan perintah dengan tipe ota');

assert(
  /\/\^\[a-f0-9\]\{64\}\$\/i\.test\(sha256\)/.test(deviceRoute),
  'API: sha256 wajib 64 karakter heksadesimal'
);

assert(deviceRoute.includes("startsWith('https://')"), 'API: URL manual wajib HTTPS');

assert(
  deviceRoute.includes("command_type', 'ota'") &&
    deviceRoute.includes(".in('status', ['pending', 'claimed'])"),
  'API: menolak perintah ota ganda yang masih menunggu'
);

assert(deviceRoute.includes('30 * 60 * 1000'), 'API: perintah ota kedaluwarsa 30 menit');

assert(
  deviceRoute.includes('/firmware/manifest.json'),
  'API: memverifikasi hash URL internal terhadap manifest'
);

assert(
  deviceRoute.includes('firmware_update_requested'),
  'API: mencatat permintaan update ke linimasa'
);

// -----------------------------------------------------------------------------
// 3. ACK Jujur: Hasil OTA Dilaporkan, Bukan Diasumsikan
// -----------------------------------------------------------------------------
const ackRoute = readFileSync(
  path.join(rootDir, 'dashboard/src/app/api/device/v1/commands/[id]/ack/route.ts'),
  'utf-8'
);
const cloudHeader = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/cloud_client.h'), 'utf-8');
const cloudCpp = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/cloud_client.cpp'), 'utf-8');
const mainIno = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/MewBot_ESP32C3.ino'), 'utf-8');

assert(
  /bool sendCommandAck\(const String& commandId, bool success = true/.test(cloudHeader),
  'ACK: sendCommandAck menerima status hasil'
);

assert(
  cloudCpp.includes('"failed"') && cloudCpp.includes('"applied"'),
  'ACK: firmware mengirim status applied/failed'
);

assert(
  ackRoute.includes("'failed'") && ackRoute.includes("'applied'"),
  'ACK: endpoint menerima status applied/failed dari perangkat'
);

assert(ackRoute.includes('ota_result'), 'ACK: endpoint menyimpan hasil update ke payload');

assert(ackRoute.includes('firmware_update_failed'), 'ACK: kegagalan update tercatat di linimasa');

const otaIdx = mainIno.indexOf('otaManager.executeOtaUpdate');
const ackAfterIdx = mainIno.indexOf('cloudClient.sendCommandAck', otaIdx);

assert(
  otaIdx !== -1 && ackAfterIdx > otaIdx,
  'ACK: firmware melaporkan hasil setelah percobaan update, bukan sebelumnya'
);

assert(
  !mainIno.includes('sendCommandAck(res.commandId);\n\n        String otaError;'),
  'ACK: tidak ada lagi ACK sebelum update dijalankan'
);

// -----------------------------------------------------------------------------
// 4. Kartu Settings & Linimasa
// -----------------------------------------------------------------------------
const settingsPage = readFileSync(path.join(rootDir, 'dashboard/src/app/settings/page.tsx'), 'utf-8');
const activityHelper = readFileSync(path.join(rootDir, 'dashboard/src/lib/activity-helper.ts'), 'utf-8');

assert(
  settingsPage.includes('/firmware/manifest.json'),
  'Settings: memuat daftar build dari manifest'
);

assert(settingsPage.includes("action: 'ota'"), 'Settings: mengirim aksi ota ke API');

assert(settingsPage.includes('showOtaModal'), 'Settings: memakai modal konfirmasi sebelum update');

assert(
  settingsPage.includes("action: 'cancel_command'"),
  'Settings: bisa membatalkan perintah update yang menunggu'
);

assert(settingsPage.includes('Update Firmware (OTA)'), 'Settings: kartu OTA berlabel jelas');

assert(
  settingsPage.includes('expires_at') && settingsPage.includes('Kedaluwarsa'),
  'Settings: perintah menunggu yang lewat masa berlaku ditandai kedaluwarsa'
);

assert(activityHelper.includes('firmware_update_applied'), 'Linimasa: menampilkan update berhasil');

assert(
  activityHelper.includes('firmware_update_failed'),
  'Linimasa: menampilkan update gagal beserta alasan'
);

// -----------------------------------------------------------------------------
// 5. Rilis & Dokumentasi
// -----------------------------------------------------------------------------
const configH = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/config.h'), 'utf-8');
const panduan = readFileSync(path.join(rootDir, 'docs/PANDUAN_PENGGUNAAN.md'), 'utf-8');
const changelog = readFileSync(path.join(rootDir, 'docs/CHANGELOG.md'), 'utf-8');

assert(/FIRMWARE_VERSION\s+"1\.8\.0"/.test(configH), 'Rilis: versi firmware naik ke 1.8.0');

assert(
  !panduan.includes('OTA belum tersedia') &&
    !panduan.includes('OTA belum bisa dipakai') &&
    !panduan.includes('Belum tersedia.'),
  'Dokumen: panduan tidak lagi menyatakan OTA belum tersedia'
);

assert(panduan.includes('Update Firmware (OTA)'), 'Dokumen: panduan menjelaskan cara update lewat dashboard');

assert(changelog.includes('[1.8.0]'), 'Dokumen: changelog mencatat rilis 1.8.0');

// -----------------------------------------------------------------------------
// 6. Kesiapan Deploy: Binary yang Dirujuk Manifest Benar-Benar Ikut Terkirim
// -----------------------------------------------------------------------------
// Regresi nyata: `.gitignore` berisi `*.bin` sehingga binary firmware tidak pernah
// ter-commit, padahal manifest menunjuk ke sana. Vercel lalu menyajikan manifest
// tanpa file, dan setiap OTA gagal 404 di perangkat.
const deployedManifest = JSON.parse(
  readFileSync(path.join(rootDir, 'dashboard/public/firmware/manifest.json'), 'utf-8')
);

for (const fw of deployedManifest.firmware || []) {
  const relPath = `dashboard/public/firmware/${fw.file}`;

  let ignored = false;
  try {
    execFileSync('git', ['check-ignore', '-q', relPath], { cwd: rootDir });
    ignored = true;
  } catch {
    ignored = false;
  }
  assert(!ignored, `Deploy: ${fw.file} tidak diabaikan .gitignore (OTA butuh file ini terkirim)`);

  let tracked = true;
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', relPath], {
      cwd: rootDir,
      stdio: 'ignore',
    });
  } catch {
    tracked = false;
  }
  assert(tracked, `Deploy: ${fw.file} ter-track git sehingga ikut ter-deploy`);

  const onDisk = path.join(rootDir, 'dashboard/public/firmware', fw.file);
  assert(existsSync(onDisk), `Deploy: ${fw.file} benar-benar ada di folder publik`);
}

console.log(`\nResults: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)\n`);

if (passedTests === totalTests) {
  console.log('>>> [SUCCESS] Semua pengujian OTA lulus!\n');
  process.exit(0);
} else {
  console.error('>>> [FAILURE] Masih ada pengujian OTA yang gagal!\n');
  process.exit(1);
}
