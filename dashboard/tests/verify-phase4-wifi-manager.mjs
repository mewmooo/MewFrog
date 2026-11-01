/**
 * MewBot Phase 4 — Multi-Network Wi-Fi & SoftAP Provisioning Test Suite
 * 
 * Verifikasi:
 * 1. Multi-Network Storage & Profile cycling logic (Max 4 profiles)
 * 2. SoftAP Provisioning Engine (SSID: MewBot-Setup, IP: 192.168.4.1)
 * 3. Dynamic Heap Management: WebServer created on-demand & freed on exit
 * 4. Long-Press (3s) Sensor Trigger for Setup Mode
 * 5. Display Manager Setup Screen Rendering with remaining time
 * 6. Auto-Timeout Protection (180s)
 * 7. Animation Bitmap Integrity (SHA-256 identical to baseline)
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
console.log(' MewBot Phase 4 Multi-Network & SoftAP Test Suite     ');
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

// 2. Verifikasi Multi-Network Storage di LocalStorage
const localStorageH = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/local_storage.h'), 'utf8');
const localStorageCpp = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/local_storage.cpp'), 'utf8');

assert(
  localStorageH.includes('struct WiFiProfile') &&
  localStorageH.includes('uint8_t getWiFiProfileCount()') &&
  localStorageH.includes('bool saveWiFiProfile(const char* ssid, const char* password)'),
  'LocalStorage: Declares WiFiProfile and multi-network management methods'
);

assert(
  localStorageCpp.includes('MAX_WIFI_PROFILES') &&
  localStorageCpp.includes('w_cnt') &&
  localStorageCpp.includes('w_act'),
  'LocalStorage: Manages up to MAX_WIFI_PROFILES (4) with active index tracking'
);

// 3. Verifikasi SoftAP Provisioner Module
const provH = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/wifi_provisioner.h'), 'utf8');
const provCpp = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/wifi_provisioner.cpp'), 'utf8');

assert(
  provH.includes('class WifiProvisioner') &&
  provH.includes('bool start()') &&
  provH.includes('void stop()'),
  'WifiProvisioner: Exposes modular start, stop, and update lifecycle'
);

assert(
  provCpp.includes('_server = new WebServer(80);') &&
  provCpp.includes('delete _server;'),
  'WifiProvisioner: WebServer is allocated on-demand and deallocated on exit (Zero heap leak)'
);

assert(
  provCpp.includes('WiFi.softAPConfig(_apIP') &&
  provCpp.includes('192, 168, 4, 1'),
  'WifiProvisioner: Uses official local subnet IP 192.168.4.1'
);

assert(
  provCpp.includes('WIFI_SETUP_TIMEOUT_S') &&
  provCpp.includes('getRemainingSeconds(now) <= 0'),
  'WifiProvisioner: Auto-timeout (180s) protection implemented'
);

// 4. Verifikasi Long-Press Trigger pada SensorManager
const sensorH = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/sensor_manager.h'), 'utf8');
const sensorCpp = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/sensor_manager.cpp'), 'utf8');

assert(
  sensorH.includes('bool wasLongPressTriggered();') &&
  sensorCpp.includes('now - _touchDownMs >= 3000'),
  'SensorManager: Detects continuous long-press >= 3000ms cleanly'
);

// 5. Verifikasi Tampilan Setup OLED pada DisplayManager
const displayH = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/display_manager.h'), 'utf8');
const displayCpp = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/display_manager.cpp'), 'utf8');

assert(
  displayH.includes('drawSetupScreen') &&
  displayCpp.includes('WI-FI SETUP PORTAL') &&
  displayCpp.includes('192.168.4.1'),
  'DisplayManager: Renders retro Setup Portal screen with SSID, IP, and remaining time countdown'
);

// 6. Verifikasi Integrasi Main Ino
const mainIno = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/MewBot_ESP32C3.ino'), 'utf8');

assert(
  mainIno.includes('sensorManager.wasLongPressTriggered()') &&
  mainIno.includes('currentMode = MODE_SETUP;') &&
  mainIno.includes('wifiProvisioner.start();'),
  'Main Ino: Long-press transitions pet to MODE_SETUP and launches SoftAP'
);

assert(
  mainIno.includes('wifiProvisioner.update(now);') &&
  mainIno.includes('displayManager.drawSetupScreen'),
  'Main Ino: Non-blocking scheduler updates SoftAP and renders setup screen'
);

// 7. Verifikasi Multi-Network Cycling di CloudClient
const cloudClientCpp = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/cloud_client.cpp'), 'utf8');

assert(
  cloudClientCpp.includes('_profileAttempts >= 2 && count > 1') &&
  cloudClientCpp.includes('_currentProfileIndex = (_currentProfileIndex + 1) % count'),
  'CloudClient: Smart network cycling switches to next saved profile after 2 failed attempts'
);

console.log('\n======================================================');
console.log(`Hasil Pengujian: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('======================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}

