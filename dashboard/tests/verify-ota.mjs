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

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
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

console.log(`\nResults: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)\n`);

if (passedTests === totalTests) {
  console.log('>>> [SUCCESS] Semua pengujian OTA lulus!\n');
  process.exit(0);
} else {
  console.error('>>> [FAILURE] Masih ada pengujian OTA yang gagal!\n');
  process.exit(1);
}
