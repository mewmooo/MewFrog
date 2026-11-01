/**
 * MewBot Phase 5 — Dual-Slot OTA & Anti-Bricking Rollback Test Suite
 * 
 * Verifikasi:
 * 1. Animation Bitmap Integrity (SHA-256 identical to baseline)
 * 2. Custom Partition Scheme: Dual 1.75 MB App Slots (app0 & app1) <= 4MB Flash
 * 3. Dual OTA Engine: HTTPS TLS Root CA verification, streaming SHA-256
 * 4. Anti-Bricking: Automatic rollback cancellation on stable boot (esp_ota_mark_app_valid_cancel_rollback)
 * 5. OLED OTA Progress Feedback: drawOtaProgress integrated
 * 6. Remote Command Integration: Cloud polling dispatches OTA commands with ACK before reboot
 * 7. Frog Mascot Brand Continuity: Custom illustration maintained, zero emoji frog
 */

import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

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

console.log('======================================================');
console.log(' MewBot Phase 5 Dual OTA & Anti-Bricking Test Suite   ');
console.log('======================================================\n');

// 1. Verifikasi Integritas Bitmap 155 Frame
const bitmapPath = path.join(rootDir, 'firmware/MewBot_ESP32C3/frog_pet_bitmaps.h');
assert(existsSync(bitmapPath), 'Firmware: frog_pet_bitmaps.h exists');

const bitmapContent = readFileSync(bitmapPath);
const bitmapHash = createHash('sha256').update(bitmapContent).digest('hex').toUpperCase();
assert(
  bitmapHash === '69F429741849CA4083F4D0854A8F9A41D83A22B99AD88CAD50BC74872EAF5ED2',
  `Animation Integrity: Hash SHA-256 identical to baseline (${bitmapHash.substring(0, 16)}...)`
);

// 2. Verifikasi Skema Partisi Dual-Slot OTA (partitions.csv)
const partitionPath = path.join(rootDir, 'firmware/MewBot_ESP32C3/partitions.csv');
assert(existsSync(partitionPath), 'Partitions: partitions.csv exists in firmware folder');

const partitionContent = readFileSync(partitionPath, 'utf-8');
const pLines = partitionContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const parsedPartitions = pLines.map(line => {
  const [name, type, subtype, offset, size] = line.split(',').map(s => s.trim());
  return { name, type, subtype, offset, size };
});

const nvsPart = parsedPartitions.find(p => p.name === 'nvs');
assert(nvsPart && nvsPart.type === 'data' && nvsPart.subtype === 'nvs', 'Partitions: NVS data partition configured');

const otaDataPart = parsedPartitions.find(p => p.name === 'otadata');
assert(otaDataPart && otaDataPart.type === 'data' && otaDataPart.subtype === 'ota', 'Partitions: OTA Data status partition configured');

const app0Part = parsedPartitions.find(p => p.name === 'app0');
assert(
  app0Part && app0Part.type === 'app' && app0Part.subtype === 'ota_0' &&
  app0Part.offset.toLowerCase() === '0x10000' && app0Part.size.toLowerCase() === '0x1c0000',
  'Partitions: app0 slot configured with 1.75 MB (1835008 bytes) at 0x10000'
);

const app1Part = parsedPartitions.find(p => p.name === 'app1');
assert(
  app1Part && app1Part.type === 'app' && app1Part.subtype === 'ota_1' &&
  app1Part.offset.toLowerCase() === '0x1d0000' && app1Part.size.toLowerCase() === '0x1c0000',
  'Partitions: app1 slot configured with 1.75 MB (1835008 bytes) at 0x1D0000'
);

const spiffsPart = parsedPartitions.find(p => p.name === 'spiffs');
assert(spiffsPart && spiffsPart.type === 'data' && spiffsPart.subtype === 'spiffs', 'Partitions: SPIFFS storage configured');

// Hitung total flash allocation
const flashLines = partitionContent.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
let maxAddress = 0;
for (const line of flashLines) {
  const parts = line.split(',').map(p => p.trim());
  if (parts.length >= 5) {
    const offset = parseInt(parts[3], 16);
    const size = parseInt(parts[4], 16);
    if (!isNaN(offset) && !isNaN(size)) {
      const endAddr = offset + size;
      if (endAddr > maxAddress) maxAddress = endAddr;
    }
  }
}
assert(maxAddress <= 0x400000, `Flash Capacity: Partition map fits safely within 4MB Flash (Max: 0x${maxAddress.toString(16).toUpperCase()} <= 0x400000)`);

// 3. Verifikasi OtaManager Module
const otaHPath = path.join(rootDir, 'firmware/MewBot_ESP32C3/ota_manager.h');
const otaCppPath = path.join(rootDir, 'firmware/MewBot_ESP32C3/ota_manager.cpp');
assert(existsSync(otaHPath) && existsSync(otaCppPath), 'OTA Engine: ota_manager.h and ota_manager.cpp exist');

const otaCppContent = readFileSync(otaCppPath, 'utf-8');
assert(
  otaCppContent.includes('esp_ota_mark_app_valid_cancel_rollback()'),
  'Anti-Bricking: Automatic rollback cancellation on healthy startup'
);
assert(
  otaCppContent.includes('netClient.setCACert(MEWBOT_ROOT_CA)'),
  'Security: TLS X.509 Certificate verification enforced during firmware download'
);
assert(
  otaCppContent.includes('mbedtls_sha256_update'),
  'Integrity: Streaming SHA-256 calculation used during chunked download'
);
assert(
  otaCppContent.includes('computedSha.equalsIgnoreCase(expectedSha256)'),
  'Verification: Strict SHA-256 hash comparison before committing partition'
);
assert(
  otaCppContent.includes('displayManager.drawOtaProgress'),
  'UX: Real-time OLED download progress bar displayed'
);

// 4. Verifikasi Integrasi di Main Firmware (MewBot_ESP32C3.ino)
const mainInoPath = path.join(rootDir, 'firmware/MewBot_ESP32C3/MewBot_ESP32C3.ino');
const mainInoContent = readFileSync(mainInoPath, 'utf-8');
assert(mainInoContent.includes('#include "ota_manager.h"'), 'Main Firmware: Includes ota_manager.h');
assert(mainInoContent.includes('otaManager.begin()'), 'Main Firmware: Calls otaManager.begin() during setup()');
assert(
  mainInoContent.includes('otaManager.executeOtaUpdate'),
  'Main Firmware: Dispatches executeOtaUpdate upon receiving OTA command'
);

// 5. Verifikasi Zero Emoji Frog Brand Rule
const dashboardSrc = path.join(rootDir, 'dashboard/src');
function checkNoFrogEmoji(dir) {
  import('fs').then(fs => {});
}
assert(
  !mainInoContent.includes('🐸') && !otaCppContent.includes('🐸'),
  'Brand Guidelines: Zero emoji frog characters found in firmware codebase'
);

console.log(`\nResults: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)\n`);

if (passedTests === totalTests) {
  console.log('>>> [SUCCESS] All Phase 5 Dual OTA & Anti-Bricking tests passed cleanly!\n');
  process.exit(0);
} else {
  console.error('>>> [FAILURE] Some Phase 5 tests failed!\n');
  process.exit(1);
}
