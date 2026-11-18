/**
 * MewBot — Firmware First-Flash Readiness Test Suite
 *
 * Menguji 3 blocker yang ditemukan saat audit kesiapan sebelum perangkat
 * pertama kali di-flash, agar tidak terulang:
 *
 * 1. Config Revision Persistence
 *    Firmware wajib menyimpan `config_revision` dari gateway. Tanpa ini
 *    gateway mengirim `desired_state` di setiap poll sehingga mode yang
 *    dipilih lewat sentuhan langsung ditimpa balik oleh dashboard.
 *
 * 2. Command Type Case-Insensitivity
 *    Database hanya mengizinkan nilai lowercase ('restart', 'ota'), sehingga
 *    firmware tidak boleh membandingkan dengan literal uppercase saja.
 *
 * 3. Wi-Fi Placeholder Guard
 *    Template `secrets.example.h` berisi SSID placeholder. Firmware tidak
 *    boleh menyimpannya sebagai profil nyata maupun mencoba connect ke
 *    SSID placeholder tersebut.
 */

import { readFileSync } from 'fs';
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

console.log('================================================================');
console.log(' MewBot Firmware First-Flash Readiness Suite');
console.log('================================================================\n');

const fwDir = path.join(rootDir, 'firmware/MewBot_ESP32C3');
const mainIno = readFileSync(path.join(fwDir, 'MewBot_ESP32C3.ino'), 'utf-8');
const cloudClientH = readFileSync(path.join(fwDir, 'cloud_client.h'), 'utf-8');
const cloudClientCpp = readFileSync(path.join(fwDir, 'cloud_client.cpp'), 'utf-8');
const localStorageCpp = readFileSync(path.join(fwDir, 'local_storage.cpp'), 'utf-8');
const configH = readFileSync(path.join(fwDir, 'config.h'), 'utf-8');

// -----------------------------------------------------------------------------
// 1. Config Revision Persistence
// -----------------------------------------------------------------------------
assert(
  cloudClientH.includes('configRevision'),
  'Revision: CloudPollResult membawa field configRevision dari gateway'
);

assert(
  /res\.configRevision\s*=\s*respDoc\["config_revision"\]/.test(cloudClientCpp),
  'Revision: cloud_client.cpp mem-parse config_revision dari response poll'
);

assert(
  /localStorage\.setConfigRevision\(\s*res\.configRevision\s*\)/.test(mainIno),
  'Revision: firmware menyimpan config_revision agar desired_state tidak dikirim berulang'
);

const revSaveIdx = mainIno.indexOf('setConfigRevision');
const stateApplyIdx = mainIno.indexOf('if (res.hasNewState)');
assert(
  revSaveIdx !== -1 && stateApplyIdx !== -1 && revSaveIdx < stateApplyIdx,
  'Revision: config_revision disimpan sebelum desired_state diterapkan'
);

assert(
  mainIno.includes('deferRevision') &&
    mainIno.indexOf('bool deferRevision') < mainIno.indexOf('setConfigRevision(res.configRevision)'),
  'Revision: perubahan mode ditunda (revision tidak dikonsumsi) selama Love Mail tampil agar tidak hilang'
);

// -----------------------------------------------------------------------------
// 2. Command Type Case-Insensitivity
// -----------------------------------------------------------------------------
assert(
  !/commandType\s*==\s*"RESTART"/.test(mainIno),
  'Command: tidak ada perbandingan case-sensitive "RESTART" lagi'
);

assert(
  /commandType\.equalsIgnoreCase\(\s*"restart"\s*\)/.test(mainIno),
  'Command: tipe restart dicocokkan case-insensitive (sesuai constraint DB lowercase)'
);

assert(
  /commandType\.equalsIgnoreCase\(\s*"ota"\s*\)/.test(mainIno),
  'Command: tipe ota dicocokkan case-insensitive (sesuai constraint DB lowercase)'
);

// -----------------------------------------------------------------------------
// 3. Wi-Fi Placeholder Guard
// -----------------------------------------------------------------------------
assert(
  /NAMA_WIFI_RUMAH_ANDA/.test(localStorageCpp),
  'Wi-Fi: firmware mengenali SSID placeholder template sebagai "belum dikonfigurasi"'
);

assert(
  /isPlaceholderSsid\s*\(/.test(localStorageCpp) &&
    localStorageCpp.indexOf('isPlaceholderSsid') < localStorageCpp.indexOf('saveWiFiProfile(WIFI_SSID'),
  'Wi-Fi: profil default hanya di-seed jika SSID bukan placeholder'
);

assert(
  cloudClientCpp.includes('Belum ada profil Wi-Fi'),
  'Wi-Fi: boot tanpa profil tersimpan melewati connect ke SSID placeholder & memberi petunjuk SoftAP'
);

// -----------------------------------------------------------------------------
// 4. Identitas Versi Firmware
// -----------------------------------------------------------------------------
assert(
  !/FIRMWARE_VERSION\s+"1\.4\.0"/.test(configH),
  'Version: FIRMWARE_VERSION dinaikkan dari 1.4.0 agar telemetri dashboard akurat'
);

console.log(`\nResults: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)\n`);

if (passedTests === totalTests) {
  console.log('>>> [SUCCESS] Firmware siap untuk first-flash sesuai audit!\n');
  process.exit(0);
} else {
  console.error('>>> [FAILURE] Masih ada blocker kesiapan firmware!\n');
  process.exit(1);
}
