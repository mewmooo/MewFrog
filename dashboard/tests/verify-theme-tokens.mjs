/**
 * MewBot — Theme Token Suite
 *
 * Mengunci mode gelap tanpa mengubah mode terang:
 *  1. Token terang memakai nilai hex persis seperti sebelumnya
 *  2. Setiap token punya pasangan gelap
 *  3. Tailwind memetakan token dan mengaktifkan darkMode: 'class'
 *  4. Kontras WCAG mode gelap
 *  5. Kontras 59 pasangan palet status
 *  6. Tidak ada warna langsung di src (kecuali pratinjau OLED)
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
console.log(' MewBot Theme Token Suite');
console.log('================================================================\n');

const globalsPath = path.join(rootDir, 'dashboard/src/app/globals.css');
const tailwindPath = path.join(rootDir, 'dashboard/tailwind.config.ts');
const globalsCss = readFileSync(globalsPath, 'utf-8');
const tailwindConfig = readFileSync(tailwindPath, 'utf-8');

// -----------------------------------------------------------------------------
// 1. Token terang (harus identik dengan nilai lama)
// -----------------------------------------------------------------------------
const LIGHT_TOKENS = {
  'bg-primary': '#fcfbf7',
  'bg-surface': '#ffffff',
  'bg-surface-subtle': '#f6f3eb',
  'bg-raised': '#ffffff',
  'border-subtle': '#eae4d5',
  'border-chip': '#cbdbca',
  'text-main': '#1e241f',
  'text-muted': '#5e6b5f',
  'text-dim': '#8b998c',
  'olive-primary': '#466743',
  'olive-hover': '#385336',
  'olive-subtle': '#eef4ea',
  'olive-deep': '#273826',
  'olive-accent': '#5a8257',
  'on-olive': '#ffffff',
  'on-danger': '#ffffff',
};

for (const [name, value] of Object.entries(LIGHT_TOKENS)) {
  assert(
    new RegExp(`--${name}:\\s*${value};`, 'i').test(globalsCss),
    `Token terang: --${name} = ${value}`
  );
}

// -----------------------------------------------------------------------------
// 2. Token gelap
// -----------------------------------------------------------------------------
const DARK_TOKENS = {
  'bg-primary': '#16140F',
  'bg-surface': '#201D17',
  'bg-surface-subtle': '#2A2620',
  'bg-raised': '#2E2921',
  'border-subtle': '#332E26',
  'border-chip': '#3C4A38',
  'text-main': '#EFEAE0',
  'text-muted': '#A8A092',
  'text-dim': '#928A7B',
  'olive-primary': '#8FB08A',
  'olive-hover': '#A3C29E',
  'olive-subtle': '#2A3527',
  'olive-deep': '#D6E3D2',
  'olive-accent': '#9BBE96',
  'on-olive': '#16140F',
  'on-danger': '#16140F',
};

const darkBlockMatch = globalsCss.match(/\.dark\s*\{([\s\S]*?)\}/);
assert(Boolean(darkBlockMatch), 'Token gelap: blok .dark ada');
const darkBlock = darkBlockMatch ? darkBlockMatch[1] : '';

for (const [name, value] of Object.entries(DARK_TOKENS)) {
  assert(
    new RegExp(`--${name}:\\s*${value};`, 'i').test(darkBlock),
    `Token gelap: --${name} = ${value}`
  );
}

// Kontrol bawaan browser (input, scrollbar, autofill) harus ikut tema aktif,
// bukan tema sistem operasi.
assert(
  /(^|\s)color-scheme:\s*light;/.test(globalsCss),
  'Token: color-scheme terang di :root'
);
assert(
  /color-scheme:\s*dark;/.test(darkBlock),
  'Token: color-scheme gelap di .dark'
);

// -----------------------------------------------------------------------------
// 3. Pemetaan Tailwind
// -----------------------------------------------------------------------------
assert(/darkMode:\s*'class'/.test(tailwindConfig), "Tailwind: darkMode: 'class'");
for (const name of Object.keys(LIGHT_TOKENS)) {
  assert(tailwindConfig.includes(`var(--${name})`), `Tailwind: memetakan ${name}`);
}
assert(/prefers-reduced-motion:\s*reduce/.test(globalsCss), 'Aksesibilitas: reduced motion dihormati');
assert(/:focus-visible/.test(globalsCss), 'Aksesibilitas: fokus keyboard terlihat');

// -----------------------------------------------------------------------------
// 4. Kontras mode gelap
// -----------------------------------------------------------------------------
function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const h = hex.replace('#', '');
  return (
    0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16))
  );
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const D = DARK_TOKENS;
const DARK_PAIRS = [
  ['text-main/bg-primary', D['text-main'], D['bg-primary'], 4.5],
  ['text-main/bg-surface', D['text-main'], D['bg-surface'], 4.5],
  ['text-muted/bg-surface', D['text-muted'], D['bg-surface'], 4.5],
  ['text-muted/bg-primary', D['text-muted'], D['bg-primary'], 4.5],
  ['text-dim/bg-surface', D['text-dim'], D['bg-surface'], 4.5],
  ['olive-primary/bg-surface', D['olive-primary'], D['bg-surface'], 4.5],
  ['olive-primary/olive-subtle', D['olive-primary'], D['olive-subtle'], 4.5],
  ['olive-deep/olive-subtle', D['olive-deep'], D['olive-subtle'], 4.5],
  ['olive-accent/olive-subtle', D['olive-accent'], D['olive-subtle'], 4.5],
  ['amber-600/bg-surface', '#D9A45B', D['bg-surface'], 4.5],
  ['amber-600/amber-50', '#D9A45B', '#3A2E1B', 4.5],
  ['emerald-600/bg-surface', '#7FB77A', D['bg-surface'], 4.5],
  ['red-600/bg-surface', '#E88078', D['bg-surface'], 4.5],
  ['red-600/red-50', '#E88078', '#3A2320', 4.5],
  ['blue-600/bg-surface', '#7FB6D4', D['bg-surface'], 4.5],
  ['on-olive/olive-primary', D['on-olive'], D['olive-primary'], 4.5],
  ['on-danger/red-600', D['on-danger'], '#E88078', 4.5],
];

for (const [label, fg, bg, min] of DARK_PAIRS) {
  const ratio = contrast(fg, bg);
  assert(ratio >= min, `Kontras gelap: ${label} ${ratio.toFixed(2)}:1 ≥ ${min}:1`);
}

// -----------------------------------------------------------------------------
// 5. Kontras palet status (59 pasangan)
// -----------------------------------------------------------------------------
const DARK_PALETTE = {
  amber: { 50: '#3A2E1B', 100: '#453722', 200: '#5A4726', 300: '#6B552D', 400: '#C79A55', 500: '#D3A45F', 600: '#D9A45B', 700: '#E5B36F', 800: '#EFC98F', 900: '#F5DDB4' },
  blue: { 50: '#1D2733', 200: '#2F4159', 500: '#6FA8DC', 600: '#7FB6D4', 700: '#9CC9E3' },
  emerald: { 50: '#1E2E1D', 200: '#2F4A2C', 300: '#3E5F39', 400: '#6FB569', 500: '#7FB77A', 600: '#7FB77A', 700: '#95C98F', 800: '#B0D9AA', 900: '#C9E6C3', 950: '#0B0F17' },
  gray: { 100: '#2E2921', 200: '#3A342B', 300: '#4A4238', 400: '#7E7768', 500: '#A8A092', 600: '#B8B0A2', 700: '#CBC3B4', 800: '#DED7C9' },
  orange: { 50: '#3A2A1B', 200: '#54402A', 600: '#E39B62', 700: '#EFB37F' },
  purple: { 50: '#2C2338', 200: '#453457', 500: '#B79BE0', 600: '#C4ADE8', 700: '#D4C2F0' },
  red: { 50: '#3A2320', 100: '#452A26', 200: '#543430', 500: '#E88078', 600: '#E88078', 700: '#F09A93', 900: '#F7C4BF' },
  slate: { 50: '#242830', 200: '#363B45', 400: '#7E8794', 500: '#98A1AE', 600: '#A8B0BC', 700: '#BCC4CF' },
  teal: { 50: '#172C2A', 200: '#254440', 600: '#6FC3BC', 700: '#8AD4CE' },
};

const TEXT_SHADES = [500, 600, 700, 800, 900];
for (const [family, shades] of Object.entries(DARK_PALETTE)) {
  for (const shade of TEXT_SHADES) {
    const fg = shades[shade];
    if (!fg) continue;
    const bg = shades[50];
    if (bg) {
      const ratio = contrast(fg, bg);
      assert(ratio >= 4.5, `Palet gelap: ${family}-${shade} di ${family}-50 ${ratio.toFixed(2)}:1`);
    }
    const onSurface = contrast(fg, D['bg-surface']);
    assert(onSurface >= 4.5, `Palet gelap: ${family}-${shade} di surface ${onSurface.toFixed(2)}:1`);
  }
}

for (const [family, shades] of Object.entries(DARK_PALETTE)) {
  for (const [shade, value] of Object.entries(shades)) {
    assert(
      new RegExp(`--${family}-${shade}:\\s*${value};`, 'i').test(darkBlock),
      `Token palet gelap: --${family}-${shade} = ${value}`
    );
  }
}

// -----------------------------------------------------------------------------
// 6. Pemindai warna langsung
// -----------------------------------------------------------------------------
const FORBIDDEN = /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b|(?:emerald|amber|blue|purple|slate|rose|teal|orange|red|gray)-[0-9]/i;
const SCAN_EXEMPT_FILES = new Set(['globals.css']);

// Token kita sendiri ditulis `var(--amber-50)`. Lookbehind dengan panjang
// variabel tidak didukung JavaScript, jadi rujukan token dinetralkan dulu
// sebelum pemindaian supaya tidak dianggap kelas palet Tailwind.
function stripTokenRefs(text) {
  return text.replace(/var\(\s*--[a-z0-9-]+\s*\)/gi, 'TOKEN');
}

function stripOledExempt(text) {
  return text.replace(
    /\/\*\s*oled-exempt:start\s*\*\/[\s\S]*?\/\*\s*oled-exempt:end\s*\*\//g,
    ''
  ).replace(
    /\{\/\*\s*oled-exempt:start\s*\*\/\}[\s\S]*?\{\/\*\s*oled-exempt:end\s*\*\/\}/g,
    ''
  );
}

function scanForbidden(dir) {
  const hits = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      hits.push(...scanForbidden(full));
      continue;
    }
    if (!/\.(tsx?|css)$/.test(entry.name) || SCAN_EXEMPT_FILES.has(entry.name)) continue;
    const lines = stripTokenRefs(stripOledExempt(readFileSync(full, 'utf-8'))).split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/^\s*themeColor:\s*'#[0-9a-f]{6}',\s*$/i.test(line)) return;
      // theme-color tidak menerima var(); satu-satunya hex yang sah adalah
      // pembaruan meta saat tema ditukar.
      if (/meta\.setAttribute\('content'.*isDark.*'#[0-9a-f]{6}'.*'#[0-9a-f]{6}'\)/i.test(line)) return;
      if (FORBIDDEN.test(line)) {
        hits.push(`${path.relative(rootDir, full).replaceAll('\\', '/')}:${i + 1}`);
      }
    });
  }
  return hits;
}

const scanRoots = [
  path.join(rootDir, 'dashboard/src/app'),
  path.join(rootDir, 'dashboard/src/components'),
  path.join(rootDir, 'dashboard/src/lib'),
];
const violations = scanRoots.flatMap((dir) => (existsSync(dir) ? scanForbidden(dir) : []));

// Ratchet: migrasi berjalan bertahap di Task 5–9. Angka hanya boleh turun,
// dan Task 9 menetapkannya ke 0.
// Migrasi warna selesai: nol warna langsung di src (kecuali pratinjau OLED).
const MAX_VIOLATIONS = 0;

assert(
  violations.length <= MAX_VIOLATIONS,
  `Warna: pelanggaran warna langsung ${violations.length} ≤ ${MAX_VIOLATIONS} (target 0)${
    violations.length ? ' — ' + violations.slice(0, 5).join(', ') : ''
  }`
);

// -----------------------------------------------------------------------------
// 7. Pratinjau OLED: identik di kedua tema
// -----------------------------------------------------------------------------
const pesanSource = readFileSync(path.join(rootDir, 'dashboard/src/app/pesan/page.tsx'), 'utf-8');
assert(pesanSource.includes('oled-exempt:start'), 'OLED: blok pratinjau ditandai exempt');
assert(pesanSource.includes('oled-screen-preview'), 'OLED: pratinjau memakai kelas layar');
const oledBlock = pesanSource.slice(
  pesanSource.indexOf('oled-exempt:start'),
  pesanSource.indexOf('oled-exempt:end')
);
assert(
  oledBlock.length > 0 && !/var\(--/.test(oledBlock),
  'OLED: pratinjau tidak memakai token tema (identik di kedua mode)'
);
assert(
  /text-\[#34d399\]/.test(oledBlock),
  'OLED: warna layar memakai nilai tetap, bukan token'
);

// -----------------------------------------------------------------------------
// 8. Skrip anti-kedip dan tombol tema
// -----------------------------------------------------------------------------
const themeScriptPath = path.join(rootDir, 'dashboard/src/components/ThemeScript.tsx');
const themeScript = existsSync(themeScriptPath) ? readFileSync(themeScriptPath, 'utf-8') : '';
assert(themeScript.includes('localStorage'), 'Tema: skrip membaca localStorage');
assert(themeScript.includes("classList.add('dark')"), 'Tema: skrip menambah kelas dark');
assert(themeScript.includes('mewbot-theme'), 'Tema: kunci penyimpanan bernama');

const rootLayoutSource = readFileSync(path.join(rootDir, 'dashboard/src/app/layout.tsx'), 'utf-8');
assert(rootLayoutSource.includes('ThemeScript'), 'Tema: layout memakai ThemeScript');
assert(
  rootLayoutSource.includes('bg-page') && rootLayoutSource.includes('text-body'),
  'Tema: body memakai token, bukan warna tetap'
);
assert(
  !/<body[^>]*bg-\[#/.test(rootLayoutSource),
  'Tema: body tidak menimpa token dengan hex'
);
assert(
  rootLayoutSource.includes('<ThemeScript') &&
    rootLayoutSource.indexOf('<ThemeScript') < rootLayoutSource.indexOf('<body'),
  'Tema: skrip berada sebelum body agar tidak berkedip'
);

const togglePath = path.join(rootDir, 'dashboard/src/components/ThemeToggle.tsx');
const toggle = existsSync(togglePath) ? readFileSync(togglePath, 'utf-8') : '';
assert(toggle.includes("'mewbot-theme'"), 'Tema: tombol memakai kunci penyimpanan yang sama');
assert(toggle.includes('localStorage.setItem'), 'Tema: tombol menyimpan pilihan');
assert(toggle.includes('classList.toggle'), 'Tema: tombol menukar kelas dark');
assert(toggle.includes('aria-label'), 'Tema: tombol punya label aksesibel');
assert(toggle.includes('min-h-11') && toggle.includes('min-w-11'), 'Tema: target sentuh ≥44px');
assert(toggle.includes("addEventListener('storage'"), 'Tema: perubahan antar-tab disinkronkan');

const shellSource = readFileSync(path.join(rootDir, 'dashboard/src/components/AppShell.tsx'), 'utf-8');
assert(shellSource.includes('ThemeToggle'), 'Tema: tombol dipasang di header');
assert(
  shellSource.includes('<ThemeToggle') &&
    shellSource.indexOf('<ThemeToggle') < shellSource.indexOf('<UserNav'),
  'Tema: tombol berada sebelum menu pengguna'
);

// Item terpilih di atas track butuh permukaan lebih terang, bukan lebih gelap.
const navSource = readFileSync(
  path.join(rootDir, 'dashboard/src/components/MainNavigation.tsx'),
  'utf-8'
);
assert(
  navSource.includes("bg-[var(--bg-raised)]"),
  'Tema: item navigasi aktif memakai permukaan terangkat'
);

// -----------------------------------------------------------------------------
// 9. Integritas tokenisasi
// -----------------------------------------------------------------------------
// Penggantian teks bisa meninggalkan sisa angka saat satu kelas menjadi awalan
// kelas lain (`blue-50` di dalam `blue-500`). Sisa seperti itu tidak menghasilkan
// kelas apa pun, jadi warnanya diam-diam jatuh ke nilai warisan.
function collectSources(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSources(full));
    else if (/\.(tsx?)$/.test(entry.name)) out.push([full, readFileSync(full, 'utf-8')]);
  }
  return out;
}

const tokenSources = collectSources(path.join(rootDir, 'dashboard/src'));
const mangled = tokenSources.filter(([, text]) => /var\(--[a-z0-9-]+\)\]\d/.test(text));
assert(mangled.length === 0, `Token utuh: tidak ada sisa angka (${mangled.length} file bermasalah)`);

const duplicateRefs = tokenSources.filter(([, text]) => /var\(--[^)]*\)\]var\(/.test(text));
assert(duplicateRefs.length === 0, 'Token utuh: tidak ada rujukan bertumpuk');

// Titik timeline punya latar dari iconBg; latar putih harus menang agar tampilan
// terang tetap sama, karena itu memakai !important.
const timelineSource = readFileSync(
  path.join(rootDir, 'dashboard/src/app/timeline/page.tsx'),
  'utf-8'
);
assert(
  timelineSource.includes('!bg-[var(--bg-surface)]'),
  'Timeline: latar titik menang atas warna ikon'
);

console.log(`\nResults: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%)\n`);

if (passed === total) {
  console.log('>>> [SUCCESS] Sistem token tema lulus!\n');
  process.exit(0);
} else {
  console.error('>>> [FAILURE] Masih ada pengujian token tema yang gagal!\n');
  process.exit(1);
}
