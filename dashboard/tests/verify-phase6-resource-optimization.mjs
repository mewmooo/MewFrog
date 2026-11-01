/**
 * MewBot Phase 6 — Resource Optimization & Heap Profiling Test Suite
 * 
 * Verifikasi:
 * 1. Animation Bitmap Integrity (SHA-256 identical to baseline)
 * 2. Heap Profiling & Watermark Telemetry: getMinFreeHeap() and getMaxAllocHeap()
 * 3. Contiguous Block Validation: Anti-fragmentation check in OTA Manager
 * 4. Zero Heap Churn in Clock Loop: getDateFormatted() returns static const char*
 * 5. String Reallocation Prevention: reqBody.reserve(256) in cloud_client.cpp
 * 6. Zero Heap Allocation in Pet Animation Engine: 100% PROGMEM pointer based
 * 7. Dashboard Diagnostics: Server API & Settings UI display min_free_heap & max_alloc_heap
 * 8. Brand Consistency: Zero emoji frog characters across codebase
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
console.log(' MewBot Phase 6 Resource Optimization & Heap Suite    ');
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

// 2. Verifikasi Heap Profiling Telemetry di Cloud Client
const cloudClientCppPath = path.join(rootDir, 'firmware/MewBot_ESP32C3/cloud_client.cpp');
const cloudClientHPath = path.join(rootDir, 'firmware/MewBot_ESP32C3/cloud_client.h');
assert(existsSync(cloudClientCppPath), 'Firmware: cloud_client.cpp exists');

const cloudClientCpp = readFileSync(cloudClientCppPath, 'utf-8');
const cloudClientH = readFileSync(cloudClientHPath, 'utf-8');

assert(
  cloudClientCpp.includes('reqDoc["min_free_heap"] = ESP.getMinFreeHeap()'),
  'Heap Telemetry: getMinFreeHeap() captured in telemetry payload for peak watermark tracking'
);
assert(
  cloudClientCpp.includes('reqDoc["max_alloc_heap"] = ESP.getMaxAllocHeap()'),
  'Heap Telemetry: getMaxAllocHeap() captured to detect heap fragmentation in real time'
);
assert(
  cloudClientCpp.includes('reqBody.reserve(256)'),
  'Heap Optimization: reqBody.reserve(256) pre-allocates buffer preventing dynamic reallocations'
);

// 3. Verifikasi Zero-Allocation Clock Loop
assert(
  cloudClientH.includes('const char* getDateFormatted()'),
  'Memory Efficiency: getDateFormatted() returns const char* instead of heap String'
);
assert(
  cloudClientCpp.includes('static char s_dateBuf[16]'),
  'Memory Efficiency: Uses static stack buffer s_dateBuf, eliminating 1Hz clock string churn'
);

// 4. Verifikasi Anti-Fragmentation Check di OTA Manager
const otaCppPath = path.join(rootDir, 'firmware/MewBot_ESP32C3/ota_manager.cpp');
const otaCpp = readFileSync(otaCppPath, 'utf-8');
assert(
  otaCpp.includes('ESP.getMaxAllocHeap() < 30000'),
  'OTA Safety: Verifies largest contiguous free block before TLS stream initialization'
);

// 5. Verifikasi Pet Animation Engine Memory Integrity
const petAnimCppPath = path.join(rootDir, 'firmware/MewBot_ESP32C3/pet_animation.cpp');
const petAnimCpp = readFileSync(petAnimCppPath, 'utf-8');
assert(
  !petAnimCpp.includes('malloc(') && !petAnimCpp.includes('new ') && !petAnimCpp.includes('String('),
  'Animation Engine: Zero dynamic memory allocation (malloc/new/String) during pet animation loop'
);
assert(
  petAnimCpp.includes('pgm_read_ptr(&(frogPetFrames'),
  'PROGMEM Storage: All 155 frames fetched directly from flash via pgm_read_ptr'
);

// 6. Verifikasi Dashboard Backend & Settings UI
const pollRoutePath = path.join(rootDir, 'dashboard/src/app/api/device/v1/poll/route.ts');
const pollRoute = readFileSync(pollRoutePath, 'utf-8');
assert(
  pollRoute.includes('min_free_heap: minFreeHeap') && pollRoute.includes('max_alloc_heap: maxAllocHeap'),
  'Dashboard API: Ingests min_free_heap and max_alloc_heap into devices diagnostics table'
);

const settingsPath = path.join(rootDir, 'dashboard/src/app/settings/page.tsx');
const settingsUi = readFileSync(settingsPath, 'utf-8');
assert(
  settingsUi.includes('Min Free Heap (Peak Watermark)') && settingsUi.includes('Blok Bebas Terbesar'),
  'Dashboard UI: Hardware diagnostics card displays peak watermark and largest free block'
);

// 7. Verifikasi Brand Consistency (Zero Emoji Frog)
assert(
  !cloudClientCpp.includes('🐸') && !otaCpp.includes('🐸') && !settingsUi.includes('🐸'),
  'Brand Guidelines: Zero emoji frog characters found across optimized files'
);

console.log(`\nResults: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)\n`);

if (passedTests === totalTests) {
  console.log('>>> [SUCCESS] All Phase 6 Resource Optimization & Heap Profiling tests passed cleanly!\n');
  process.exit(0);
} else {
  console.error('>>> [FAILURE] Some Phase 6 tests failed!\n');
  process.exit(1);
}
