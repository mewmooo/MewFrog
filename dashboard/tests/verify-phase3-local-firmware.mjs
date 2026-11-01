/**
 * MewBot Phase 3 — Local Firmware Hardening & Resiliency Test Suite
 * 
 * Verifikasi:
 * 1. NVS Flash Wear Mitigation & Epoch Caching logic
 * 2. Offline Clock Fallback & WIB Epoch formulas
 * 3. Alarm Independence from Wi-Fi/Cloud status
 * 4. Touch Debounce & Touch-Motion Conflict Lockout window
 * 5. Sensor I2C Auto-Recovery & Bus Timeout Protection
 * 6. Zero Blocking Delays in Main Loop
 * 7. Bitmap 155 Frames PROGMEM Hash Integrity
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
console.log('  MewBot Phase 3 Local Firmware Hardening Test Suite  ');
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

// 2. Verifikasi NVS Wear Mitigation di LocalStorage
const localStorageCpp = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/local_storage.cpp'), 'utf8');
const localStorageH = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/local_storage.h'), 'utf8');

assert(
  localStorageH.includes('uint32_t getLastKnownEpoch()') &&
  localStorageH.includes('void saveLastKnownEpoch(uint32_t epoch, bool force'),
  'LocalStorage: Declares getLastKnownEpoch and saveLastKnownEpoch with force option'
);

assert(
  localStorageCpp.includes('epoch - _cachedEpoch >= 3600') &&
  localStorageCpp.includes('epoch < 1700000000'),
  'LocalStorage: NVS Wear mitigation limits write to max 1x per hour and checks valid epoch'
);

// 3. Verifikasi Timekeeping Offline Fallback di CloudClient
const cloudClientCpp = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/cloud_client.cpp'), 'utf8');
const cloudClientH = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/cloud_client.h'), 'utf8');

assert(
  cloudClientH.includes('bool isClockRunning()') &&
  cloudClientCpp.includes('_fallbackBaseEpoch = savedEpoch'),
  'CloudClient: Fallback base epoch restored from NVS on boot'
);

assert(
  cloudClientCpp.includes('_fallbackBaseEpoch + ((millis() - _fallbackBaseMillis) / 1000)'),
  'CloudClient: Fallback clock advances smoothly using millis() elapsed offset'
);

assert(
  cloudClientCpp.includes('OFF 00/00') &&
  cloudClientCpp.includes('OFF %02d/%02d'),
  'CloudClient: Clearly marks date string as OFFLINE / UNSYNCED when running on fallback'
);

// 4. Verifikasi Alarm Lokal & Mandiri
const mainIno = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/MewBot_ESP32C3.ino'), 'utf8');

assert(
  mainIno.includes('void handleAlarmCheck(unsigned long now)') &&
  !mainIno.includes('!cloudClient.isConnected()') &&
  mainIno.includes('cloudClient.isClockRunning()'),
  'Alarm: Operates 100% offline without requiring active Wi-Fi connection'
);

assert(
  mainIno.includes('currentMode = MODE_EYES;') &&
  mainIno.includes('petAnimation.triggerInterrupt(PET_HAPPY);'),
  'Alarm: Triggers joyful frog animation even if user was previously in CLOCK mode'
);

// 5. Verifikasi Sensor Debounce & Lockout Window
const sensorCpp = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/sensor_manager.cpp'), 'utf8');

assert(
  sensorCpp.includes('Wire.setTimeOut(40);'),
  'Sensor: Sets I2C timeout to 40ms to prevent bus lockups'
);

assert(
  sensorCpp.includes('now - _lastTouchTriggeredMs < 350'),
  'Sensor: Touch-motion conflict lockout window (350ms) suppresses false shakes during touch'
);

assert(
  sensorCpp.includes('now - _lastAdxlProbeMs >= 5000') &&
  sensorCpp.includes('Wire.beginTransmission(ADXL345_I2C_ADDR)'),
  'Sensor: Auto-recovery periodic probe (5s) implemented for disconnected ADXL345'
);

// 6. Verifikasi Zero Blocking Delay di Loop
const loopSection = mainIno.substring(mainIno.indexOf('void loop()'));
assert(
  !loopSection.includes('delay('),
  'Firmware Loop: 100% Non-blocking, contains 0 delay() calls in loop execution'
);

console.log('\n======================================================');
console.log(`Hasil Pengujian: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('======================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
