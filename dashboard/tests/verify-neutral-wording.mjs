/**
 * MewBot — Neutral Wording Suite
 *
 * Mengunci redesain netral:
 *  1. Migrasi kategori template (data dipetakan sebelum constraint diganti)
 *  2. API template bisa diubah & dihapus
 *  3. Rute /love-mail pindah ke /pesan dengan redirect
 *  4. Istilah, ikon, dan warna bebas unsur romantis
 *  5. Template contoh bisa disimpan
 *  6. Header OLED firmware netral
 *  7. Dokumentasi ikut diperbarui
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let passed = 0;
let total = 0;

function assert(cond, msg) {
  total++;
  if (cond) {
    console.log(`[PASS] ${msg}`);
    passed++;
  } else {
    console.error(`[FAIL] ${msg}`);
  }
}

console.log('================================================================');
console.log(' MewBot Neutral Wording Suite');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. Migrasi Kategori Template
// -----------------------------------------------------------------------------
const migrationPath = path.join(
  rootDir,
  'supabase/migrations/20261118000000_neutral_template_categories.sql'
);

assert(existsSync(migrationPath), 'Migrasi: file migrasi kategori netral ada');

const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf-8') : '';

for (const [oldCat, newCat] of [
  ['Affection', 'Umum'],
  ['Caring', 'Pengingat'],
  ['Missing', 'Sapaan'],
  ['Encouragement', 'Semangat'],
  ['Random', 'Lainnya'],
]) {
  const pairPattern = new RegExp(
    `'${oldCat}'\\s*,\\s*'${newCat}'|WHEN\\s+'${oldCat}'\\s+THEN\\s+'${newCat}'`
  );
  assert(pairPattern.test(migration), `Migrasi: memetakan ${oldCat} -> ${newCat}`);
}

const updateIdx = migration.search(/UPDATE\s+message_templates/i);
const dropIdx = migration.search(/DROP\s+CONSTRAINT/i);

assert(
  updateIdx !== -1 && dropIdx !== -1 && updateIdx < dropIdx,
  'Migrasi: data dipetakan SEBELUM constraint diganti'
);

assert(/DEFAULT\s+'Umum'/.test(migration), 'Migrasi: DEFAULT kolom kategori menjadi Umum');
assert(
  /ADD\s+CONSTRAINT\s+message_templates_category_check/i.test(migration),
  'Migrasi: constraint baru ditambahkan'
);
assert(/IF\s+EXISTS/i.test(migration), 'Migrasi: idempoten (memakai IF EXISTS)');

// -----------------------------------------------------------------------------
// 2. API Template: Ubah & Hapus
// -----------------------------------------------------------------------------
const templatesRoute = readFileSync(
  path.join(rootDir, 'dashboard/src/app/api/dashboard/templates/route.ts'),
  'utf-8'
);

assert(/export async function PATCH/.test(templatesRoute), 'API: menyediakan PATCH untuk mengubah template');
assert(/export async function DELETE/.test(templatesRoute), 'API: menyediakan DELETE untuk menghapus template');
assert(!/'Affection'/.test(templatesRoute), 'API: tidak lagi memakai kategori Affection');
assert(/'Umum'/.test(templatesRoute), 'API: memakai kategori default Umum');
assert(templatesRoute.includes('is_example'), 'API: menandai template contoh dengan is_example');
assert(/\.update\(/.test(templatesRoute), 'API: PATCH benar-benar memperbarui baris');
assert(/\.delete\(/.test(templatesRoute), 'API: DELETE benar-benar menghapus baris');
assert(
  (templatesRoute.match(/MAX_BODY_LENGTH\s*=\s*80/g) || []).length >= 1 &&
    (templatesRoute.match(/length\s*>\s*MAX_BODY_LENGTH/g) || []).length >= 2,
  'API: batas 80 karakter divalidasi di POST dan PATCH'
);
assert(templatesRoute.includes('status: 404'), 'API: id yang tidak ditemukan dibalas 404');

// -----------------------------------------------------------------------------
// 3. Rute: /love-mail -> /pesan
// -----------------------------------------------------------------------------
assert(
  existsSync(path.join(rootDir, 'dashboard/src/app/pesan/page.tsx')),
  'Rute: halaman /pesan ada'
);
assert(
  !existsSync(path.join(rootDir, 'dashboard/src/app/love-mail/page.tsx')),
  'Rute: halaman /love-mail lama sudah dihapus'
);

const nextConfigFile = ['next.config.ts', 'next.config.mjs', 'next.config.js']
  .map((f) => path.join(rootDir, 'dashboard', f))
  .find((f) => existsSync(f));

assert(Boolean(nextConfigFile), 'Rute: file next.config ditemukan');

if (nextConfigFile) {
  const nextConfig = readFileSync(nextConfigFile, 'utf-8');
  assert(/source:\s*'\/love-mail'/.test(nextConfig), 'Rute: redirect dari /love-mail didefinisikan');
  assert(/destination:\s*'\/pesan'/.test(nextConfig), 'Rute: redirect menuju /pesan');
  assert(/permanent:\s*true/.test(nextConfig), 'Rute: redirect bersifat permanen');
}

// -----------------------------------------------------------------------------
// 4. Istilah, Ikon, Warna, dan Manifest PWA
// -----------------------------------------------------------------------------
function scanSrc(dir, pattern) {
  const hits = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) hits.push(...scanSrc(full, pattern));
    else if (/\.(tsx?|css)$/.test(entry.name)) {
      const text = readFileSync(full, 'utf-8');
      if (new RegExp(pattern, 'gi').test(text)) hits.push(full.replace(rootDir + path.sep, ''));
    }
  }
  return hits;
}

const srcDir = path.join(rootDir, 'dashboard/src');

const loveHits = scanSrc(srcDir, 'love mail|cinta|sayang|messageSquareHeart');
assert(
  loveHits.length === 0,
  `Wording: tidak ada istilah romantis (ditemukan di: ${loveHits.join(', ') || 'tidak ada'})`
);

const heartHits = scanSrc(srcDir, '\\bHeart\\b');
assert(
  heartHits.length === 0,
  `Ikon: tidak ada ikon Heart (ditemukan di: ${heartHits.join(', ') || 'tidak ada'})`
);

const roseHits = scanSrc(srcDir, 'rose-[0-9]');
assert(
  roseHits.length === 0,
  `Warna: tidak ada kelas rose-* (ditemukan di: ${roseHits.join(', ') || 'tidak ada'})`
);

const staticManifest = readFileSync(path.join(rootDir, 'dashboard/public/manifest.json'), 'utf-8');
assert(!/love/i.test(staticManifest), 'PWA: manifest statis bebas dari kata love');
assert(staticManifest.includes('/pesan'), 'PWA: shortcut mengarah ke /pesan');
assert(
  !existsSync(path.join(rootDir, 'dashboard/src/app/manifest.ts')),
  'PWA: manifest.ts yang tidak terpakai sudah dihapus'
);

// -----------------------------------------------------------------------------
// 4b. Shell: navigasi tidak tampil di halaman login
// -----------------------------------------------------------------------------
const appShellPath = path.join(rootDir, 'dashboard/src/components/AppShell.tsx');
assert(existsSync(appShellPath), 'Shell: komponen AppShell ada');

if (existsSync(appShellPath)) {
  const appShell = readFileSync(appShellPath, 'utf-8');
  assert(/usePathname/.test(appShell), 'Shell: memakai usePathname');
  assert(
    /pathname\s*===\s*'\/login'/.test(appShell) || /'\/login'\s*===\s*pathname/.test(appShell),
    'Shell: mengenali rute /login'
  );
  assert(/DesktopNavigation/.test(appShell), 'Shell: navigasi desktop dirender oleh shell');
  assert(/MobileNavigation/.test(appShell), 'Shell: navigasi ponsel dirender oleh shell');
}

const rootLayout = readFileSync(path.join(rootDir, 'dashboard/src/app/layout.tsx'), 'utf-8');
assert(rootLayout.includes('AppShell'), 'Shell: root layout memakai AppShell');
assert(!rootLayout.includes('<DesktopNavigation'), 'Shell: layout tidak merender nav langsung');
assert(!rootLayout.includes('<MobileNavigation'), 'Shell: layout tidak merender bar bawah langsung');

// -----------------------------------------------------------------------------
// 5. Template: Edit, Hapus, dan Simpan Contoh
// -----------------------------------------------------------------------------
const notesPage = readFileSync(path.join(rootDir, 'dashboard/src/app/notes/page.tsx'), 'utf-8');

assert(/method:\s*isEdit\s*\?\s*'PATCH'\s*:\s*'POST'/.test(notesPage), 'Template: UI mengirim PATCH untuk mengubah');
assert(/method:\s*'DELETE'/.test(notesPage), 'Template: UI mengirim DELETE untuk menghapus');
assert(notesPage.includes('is_example'), 'Template: UI membedakan template contoh');
assert(notesPage.includes('Simpan sebagai template'), 'Template: contoh punya tombol simpan');
assert(notesPage.includes('deleteTarget'), 'Template: hapus memakai modal konfirmasi');
assert(notesPage.includes('editingId'), 'Template: form yang sama dipakai untuk mode ubah');
assert(notesPage.includes('LayoutTemplate'), 'Template: memakai ikon LayoutTemplate');
assert(!/Sparkles/.test(notesPage), 'Template: ikon Sparkles sudah tidak dipakai');

// -----------------------------------------------------------------------------
// 6. Firmware: Header OLED Netral
// -----------------------------------------------------------------------------
const displayCpp = readFileSync(
  path.join(rootDir, 'firmware/MewBot_ESP32C3/display_manager.cpp'),
  'utf-8'
);
const configH = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/config.h'), 'utf-8');

assert(!/LOVE MAIL/.test(displayCpp), 'Firmware: header OLED tidak lagi menulis LOVE MAIL');
assert(displayCpp.includes('PESAN [%d/%d]'), 'Firmware: header halaman menulis PESAN [n/m]');
assert(displayCpp.includes('PESAN (15s)'), 'Firmware: header tunggal menulis PESAN (15s)');
assert(/FIRMWARE_VERSION\s+"1\.9\.0"/.test(configH), 'Firmware: versi naik ke 1.9.0');
assert(
  displayCpp.includes('drawLoveMail'),
  'Firmware: nama fungsi internal drawLoveMail sengaja dipertahankan'
);

// -----------------------------------------------------------------------------
// 7. Dokumentasi
// -----------------------------------------------------------------------------
const panduan = readFileSync(path.join(rootDir, 'docs/PANDUAN_PENGGUNAAN.md'), 'utf-8');
const changelog = readFileSync(path.join(rootDir, 'docs/CHANGELOG.md'), 'utf-8');

assert(!/Love Mail/i.test(panduan), 'Dokumen: panduan tidak lagi memakai istilah Love Mail');
assert(panduan.includes('/pesan'), 'Dokumen: panduan menyebut rute /pesan');
assert(panduan.includes('Template Pesan'), 'Dokumen: panduan menyebut Template Pesan');
assert(changelog.includes('[1.9.0]'), 'Dokumen: changelog mencatat rilis 1.9.0');

console.log(`\nResults: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%)\n`);

if (passed === total) {
  console.log('>>> [SUCCESS] Semua pengujian netral lulus!\n');
  process.exit(0);
} else {
  console.error('>>> [FAILURE] Masih ada pengujian netral yang gagal!\n');
  process.exit(1);
}
