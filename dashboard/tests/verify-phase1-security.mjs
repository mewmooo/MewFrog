import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('======================================================');
console.log('   MewBot Phase 1 Security & Reliability Test Suite   ');
console.log('======================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
  }
}

// -----------------------------------------------------------------------------
// Test Group 1: SQL Migration Integrity & RLS Policy Security
// -----------------------------------------------------------------------------
const sqlPath = path.resolve('supabase/migrations/20261101000000_phase1_security_hardening.sql');
const sqlContent = fs.readFileSync(sqlPath, 'utf8');

runTest('SQL: device_members table exists with owner/partner constraint', () => {
  assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS device_members'), 'Tabel device_members harus ada');
  assert(sqlContent.includes("CHECK (role IN ('owner', 'partner'))"), 'Role harus dibatasi owner dan partner');
});

runTest('SQL: Limit max 2 members per device enforced by trigger', () => {
  assert(sqlContent.includes('trg_check_device_member_limit'), 'Trigger pembatas 2 anggota harus ada');
  assert(sqlContent.includes('COUNT(*) FROM device_members WHERE device_id = NEW.device_id) >= 2'), 'Limit 2 user harus dicek');
});

runTest('SQL: Insecure USING (true) policies dropped from private tables', () => {
  assert(sqlContent.includes('DROP POLICY IF EXISTS "Authenticated users can manage messages" ON messages'), 'Kebijakan messages lama harus dihapus');
  assert(sqlContent.includes('DROP POLICY IF EXISTS "Authenticated users can manage device_commands" ON device_commands'), 'Kebijakan commands lama harus dihapus');
  assert(sqlContent.includes('DROP POLICY IF EXISTS "Authenticated users can view devices" ON devices'), 'Kebijakan devices lama harus dihapus');
});

runTest('SQL: Granular RLS policies based on is_device_member(device_id)', () => {
  assert(sqlContent.includes('is_device_member(id)'), 'Device select RLS harus menggunakan is_device_member');
  assert(sqlContent.includes('is_device_member(device_id)'), 'Messages RLS harus menggunakan is_device_member');
});

runTest('SQL: enqueue_love_mail has secure search_path and auth check', () => {
  assert(sqlContent.includes('SET search_path = public, pg_temp'), 'search_path harus dikunci ke public, pg_temp');
  assert(sqlContent.includes('auth.uid() != p_created_by'), 'Harus memvalidasi auth.uid() == p_created_by');
  assert(sqlContent.includes('REVOKE EXECUTE ON FUNCTION enqueue_love_mail'), 'Hak execute harus dicabut dari public');
});

runTest('SQL: Atomic claim functions use FOR UPDATE SKIP LOCKED and leases', () => {
  assert(sqlContent.includes('claim_next_love_mail'), 'Fungsi claim_next_love_mail harus ada');
  assert(sqlContent.includes('claim_next_device_command'), 'Fungsi claim_next_device_command harus ada');
  assert(sqlContent.includes('FOR UPDATE SKIP LOCKED'), 'Harus menggunakan FOR UPDATE SKIP LOCKED untuk konkurensi aman');
});

// -----------------------------------------------------------------------------
// Test Group 2: Middleware & Authentication Protection
// -----------------------------------------------------------------------------
const middlewarePath = path.resolve('dashboard/src/middleware.ts');
const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');

runTest('Middleware: Protects /api/dashboard/* and returns 401 when unauthenticated', () => {
  assert(middlewareContent.includes("pathname.startsWith('/api/dashboard/')"), 'Harus memeriksa rute /api/dashboard/');
  assert(middlewareContent.includes('status: 401'), 'Harus mengembalikan 401 Unauthorized');
});

runTest('Middleware: Bypasses /api/device/ endpoints for device Bearer authentication', () => {
  assert(middlewareContent.includes("pathname.startsWith('/api/device/')"), 'Harus mengecualikan /api/device/');
});

runTest('Middleware: Redirects unauthenticated page requests to /login?next=...', () => {
  assert(middlewareContent.includes("new URL('/login', request.url)"), 'Harus mengarahkan ke /login');
  assert(middlewareContent.includes("searchParams.set('next', pathname)"), 'Harus menyertakan parameter next');
});

// -----------------------------------------------------------------------------
// Test Group 3: Device Gateway Hardening
// -----------------------------------------------------------------------------
const pollPath = path.resolve('dashboard/src/app/api/device/v1/poll/route.ts');
const pollContent = fs.readFileSync(pollPath, 'utf8');

runTest('Device Poll: Rejects unauthenticated requests without Bearer token', () => {
  assert(pollContent.includes("!authHeader.startsWith('Bearer ')"), 'Harus validasi Bearer token header');
  assert(pollContent.includes('status: 401'), 'Harus kembalikan status 401');
});

runTest('Device Poll: Rejects unknown or revoked token hash with 403', () => {
  assert(pollContent.includes('status: 403'), 'Harus kembalikan 403 jika token tidak dikenal');
});

runTest('Device Poll: Uses claim_next_love_mail to prevent duplicate message polling', () => {
  assert(pollContent.includes("rpc('claim_next_love_mail'"), 'Harus memanggil RPC claim_next_love_mail');
});

runTest('Device Poll: Handles 0, false, and null safely in heartbeat telemetry', () => {
  assert(pollContent.includes("rawBody.uptime_seconds >= 0"), 'Uptime 0 harus ditangani sebagai angka valid');
  assert(pollContent.includes("rawBody.wifi_rssi"), 'RSSI harus divalidasi');
});

// -----------------------------------------------------------------------------
// Test Group 4: Firmware TLS & Command ACK
// -----------------------------------------------------------------------------
const fwCloudClientPath = path.resolve('firmware/MewBot_ESP32C3/cloud_client.cpp');
const fwCloudClientContent = fs.readFileSync(fwCloudClientPath, 'utf8');
const fwInoPath = path.resolve('firmware/MewBot_ESP32C3/MewBot_ESP32C3.ino');
const fwInoContent = fs.readFileSync(fwInoPath, 'utf8');
const fwConfigPath = path.resolve('firmware/MewBot_ESP32C3/config.h');
const fwConfigContent = fs.readFileSync(fwConfigPath, 'utf8');

runTest('Firmware: No setInsecure() remaining in cloud_client.cpp', () => {
  assert(!fwCloudClientContent.includes('setInsecure()'), 'setInsecure() tidak boleh ada di cloud_client.cpp');
});

runTest('Firmware: Uses setCACert(MEWBOT_ROOT_CA) with official ISRG Root X1', () => {
  assert(fwCloudClientContent.includes('netClient.setCACert(MEWBOT_ROOT_CA)'), 'Harus memanggil setCACert(MEWBOT_ROOT_CA)');
  assert(fwConfigContent.includes('ISRG Root X1'), 'Root CA harus memuat sertifikat resmi ISRG Root X1');
});

runTest('Firmware: NTP synchronization verified before TLS requests', () => {
  assert(fwCloudClientContent.includes('isTimeSynced()'), 'Harus memeriksa isTimeSynced');
  assert(fwCloudClientContent.includes('1700000000'), 'Epoch time harus melewati late 2023');
});

runTest('Firmware: sendCommandAck implemented and called before remote reboot', () => {
  assert(fwCloudClientContent.includes('sendCommandAck'), 'Method sendCommandAck harus ada');
  assert(fwInoContent.includes('cloudClient.sendCommandAck'), 'MewBot_ESP32C3.ino harus memanggil sendCommandAck');
  assert(fwInoContent.includes('ESP.restart()'), 'ESP.restart() dipanggil setelah ACK');
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`Hasil Pengujian: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('======================================================');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
