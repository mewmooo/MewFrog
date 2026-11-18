# Redesain Dashboard Netral — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghapus seluruh pembingkaian romantis dari dashboard dan layar OLED perangkat, serta menambahkan kemampuan mengedit dan menghapus template pesan.

**Architecture:** Tiga lapisan berubah bersamaan: (1) migrasi Postgres memetakan nilai kategori lama ke baru lalu mengganti constraint, (2) API template mendapat `PATCH`/`DELETE`, (3) UI mengganti istilah, ikon, dan warna, memindahkan `/love-mail` ke `/pesan` dengan redirect, dan menambah tombol Edit/Hapus. Firmware hanya berubah pada dua string header OLED.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind, Supabase Postgres, Arduino/ESP32-C3, Node ESM untuk tes.

**Spec:** `docs/superpowers/specs/2026-11-18-neutral-dashboard-design.md`

## Global Constraints

- Batas isi pesan **80 karakter**; batas antrean **10 pesan** — tidak berubah.
- Kategori template baru: `Umum`, `Pengingat`, `Sapaan`, `Semangat`, `Lainnya`.
- Pemetaan: `Affection`→`Umum`, `Caring`→`Pengingat`, `Missing`→`Sapaan`, `Encouragement`→`Semangat`, `Random`→`Lainnya`.
- Migrasi harus **idempoten** dan memetakan data **sebelum** mengganti constraint.
- `DEFAULT 'Affection'` pada kolom dan fallback `category || 'Affection'` di route POST harus ikut menjadi `Umum`.
- Hak akses template: **semua pengguna login** boleh `PATCH` dan `DELETE`.
- Tidak boleh ada `Love Mail`, `cinta`, `sayang`, `MessageSquareHeart`, ikon `Heart`, emoji 💌, atau `rose-` dekoratif di `dashboard/src`.
- `rose-*` yang menandakan **bahaya** dipindah ke `red-*` (makna tetap, nama berubah).
- `Heart` diperiksa dengan batas kata (ada "Heartbeat" di komentar `overview/route.ts:52`).
- Firmware naik ke **1.9.0**; header OLED menjadi `PESAN [n/m]` dan `PESAN (15s)`.
- Nama internal yang **tidak** diubah: `enqueue_love_mail`, `claim_next_love_mail`, `drawLoveMail`, `getLoveMailPageCount`, kolom `messages`/`message_templates`.
- `docs/CHANGELOG.md` untuk versi lama **tidak** ditulis ulang; hanya entri baru ditambahkan.
- Semua teks berbahasa Indonesia. Tidak ada emoji kodok.
- Baseline suite saat ini: **160 assertion** di 9 suite, semuanya hijau.

## Review Focus

- **Template contoh disimpan lalu diedit**: setelah `POST` dari kartu contoh, baris baru harus punya `id` sehingga tombol Edit/Hapus muncul — dan keempat contoh lain tetap tampil sampai tabel terisi.
- **Migrasi dijalankan pada database yang sudah berisi template**: kelima nilai lama harus terpetakan tanpa kehilangan satu baris pun, dan insert baru tanpa kategori harus tetap berhasil (`DEFAULT` sudah `Umum`).
- **`PATCH`/`DELETE` dengan `id` yang tidak ada**: harus 404 dengan pesan jelas, bukan 500.
- **Isi template lebih dari 80 karakter saat `PATCH`**: harus ditolak 400, sama seperti `POST`.
- **Halaman `/love-mail` lama dibuka dari bookmark**: harus sampai ke `/pesan`, bukan 404.
- **Layar OLED setelah firmware 1.9.0**: header menampilkan `PESAN`, dan tata letak 128×64 tidak rusak karena string lebih pendek.

---

### Task 1: Migrasi kategori template

**Files:**
- Create: `supabase/migrations/20261118000000_neutral_template_categories.sql`
- Test: `dashboard/tests/verify-neutral-wording.mjs`

**Interfaces:**
- Consumes: tabel `message_templates` (`category`, `title`, `body`, `created_by`).
- Produces: constraint `message_templates_category_check` dengan lima nilai baru; `DEFAULT 'Umum'`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `dashboard/tests/verify-neutral-wording.mjs` dengan helper `assert(cond, msg)` dan penghitung `passed`/`total` seperti suite lain, lalu bagian pertama:

```js
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

let passed = 0, total = 0;
function assert(cond, msg) {
  total++;
  if (cond) { console.log(`[PASS] ${msg}`); passed++; }
  else console.error(`[FAIL] ${msg}`);
}

console.log('================================================================');
console.log(' MewBot Neutral Wording Suite');
console.log('================================================================\n');

const migrationPath = path.join(rootDir, 'supabase/migrations/20261118000000_neutral_template_categories.sql');
assert(existsSync(migrationPath), 'Migrasi: file migrasi kategori netral ada');

const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf-8') : '';

for (const [oldCat, newCat] of [
  ['Affection', 'Umum'],
  ['Caring', 'Pengingat'],
  ['Missing', 'Sapaan'],
  ['Encouragement', 'Semangat'],
  ['Random', 'Lainnya'],
]) {
  assert(
    new RegExp(`'${oldCat}'\\s*,\\s*'${newCat}'`).test(migration),
    `Migrasi: memetakan ${oldCat} -> ${newCat}`
  );
}

const updateIdx = migration.search(/UPDATE\s+message_templates/i);
const dropIdx = migration.search(/DROP\s+CONSTRAINT/i);
assert(
  updateIdx !== -1 && dropIdx !== -1 && updateIdx < dropIdx,
  'Migrasi: data dipetakan SEBELUM constraint diganti'
);

assert(/DEFAULT\s+'Umum'/.test(migration), 'Migrasi: DEFAULT kolom kategori menjadi Umum');
assert(/ADD\s+CONSTRAINT\s+message_templates_category_check/i.test(migration), 'Migrasi: constraint baru ditambahkan');
assert(/IF\s+EXISTS/i.test(migration), 'Migrasi: idempoten (memakai IF EXISTS)');

console.log(`\nResults: ${passed}/${total} tests passed\n`);
process.exit(passed === total ? 0 : 1);
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node dashboard/tests/verify-neutral-wording.mjs`
Expected: FAIL — file migrasi tidak ada, seluruh assertion `Migrasi:` gagal.

- [ ] **Step 3: Tulis migrasi**

Buat `supabase/migrations/20261118000000_neutral_template_categories.sql`:

- Blok `UPDATE message_templates SET category = CASE category WHEN 'Affection' THEN 'Umum' ... END WHERE category IN (...)` — petakan kelima nilai lama.
- `ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS message_templates_category_check;`
- `ALTER TABLE message_templates ALTER COLUMN category SET DEFAULT 'Umum';`
- `ALTER TABLE message_templates ADD CONSTRAINT message_templates_category_check CHECK (category IN ('Umum','Pengingat','Sapaan','Semangat','Lainnya'));`
- Komentar di atas file menjelaskan urutan wajib ini dan alasannya.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node dashboard/tests/verify-neutral-wording.mjs`
Expected: seluruh assertion `Migrasi:` PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261118000000_neutral_template_categories.sql dashboard/tests/verify-neutral-wording.mjs
git commit -m "feat(db): migrate template categories to neutral names"
```

---

### Task 2: API template — PATCH dan DELETE

**Files:**
- Modify: `dashboard/src/app/api/dashboard/templates/route.ts`
- Modify: `dashboard/tests/verify-neutral-wording.mjs`

**Interfaces:**
- Consumes: `getAuthenticatedUser()`, `getSupabaseAdmin()`, tabel `message_templates`.
- Produces:
  - `PATCH /api/dashboard/templates` dengan body `{ id, title?, body?, category? }` → `{ template }` atau 400/404.
  - `DELETE /api/dashboard/templates?id=<uuid>` → `{ status: 'ok', deleted_id }` atau 400/404.
  - `POST` menerima `category` default `'Umum'`; `GET` mengembalikan contoh dengan kategori baru dan field `is_example: true`.

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan ke `dashboard/tests/verify-neutral-wording.mjs` sebelum baris `console.log` penutup:

```js
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
  /textBody\.length\s*>\s*80/.test(templatesRoute) &&
    (templatesRoute.match(/length\s*>\s*80/g) || []).length >= 2,
  'API: batas 80 karakter divalidasi di POST dan PATCH'
);
assert(
  templatesRoute.includes("status: 404"),
  'API: id yang tidak ditemukan dibalas 404'
);
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node dashboard/tests/verify-neutral-wording.mjs`
Expected: assertion `API:` gagal.

- [ ] **Step 3: Implementasikan PATCH dan DELETE**

Di `route.ts`:

- `POST`: ganti fallback `category || 'Affection'` menjadi `category || 'Umum'`; tambahkan `device_id`? **Tidak** — skema tidak berubah. Validasi `category` terhadap lima nilai baru, tolak 400 bila di luar daftar.
- `GET`: template contoh memakai kategori baru dan ditambah `is_example: true`.
- `PATCH`: baca body, wajib `id`. Ambil baris via `.select('*').eq('id', id).maybeSingle()`; bila kosong → 404 `{ error: 'Template tidak ditemukan' }`. Validasi `title`/`body` bila dikirim (body ≤ 80 karakter → 400). Jalankan `.update({...}).eq('id', id).select().single()`, kembalikan `{ template }`.
- `DELETE`: ambil `id` dari `req.nextUrl.searchParams.get('id')`; bila kosong → 400. Ambil baris dulu untuk memastikan ada; bila tidak ada → 404. Lalu `.delete().eq('id', id)`, kembalikan `{ status: 'ok', deleted_id: id }`.
- Keduanya memakai `getAuthenticatedUser()` dan menolak 401 bila tidak login. Tidak ada pembatasan per-pembuat (keputusan spec §5.6).

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node dashboard/tests/verify-neutral-wording.mjs`
Expected: seluruh assertion `API:` PASS.

- [ ] **Step 5: Typecheck**

Run: `cd dashboard; npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/app/api/dashboard/templates/route.ts dashboard/tests/verify-neutral-wording.mjs
git commit -m "feat(api): edit and delete message templates"
```

---

### Task 3: Pindahkan `/love-mail` ke `/pesan` + redirect

**Files:**
- Create: `dashboard/src/app/pesan/page.tsx` (hasil pindah dari `love-mail/page.tsx`)
- Delete: `dashboard/src/app/love-mail/page.tsx`
- Modify: `next.config.*` (tambahkan `redirects()`)
- Modify: `dashboard/tests/verify-neutral-wording.mjs`

**Interfaces:**
- Consumes: `POST /api/dashboard/messages`.
- Produces: rute `/pesan`; redirect permanen `/love-mail` → `/pesan`.

- [ ] **Step 1: Tulis tes yang gagal**

```js
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
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node dashboard/tests/verify-neutral-wording.mjs`
Expected: assertion `Rute:` gagal.

- [ ] **Step 3: Pindahkan halaman dan tambah redirect**

Pindahkan isi `love-mail/page.tsx` ke `pesan/page.tsx` (ganti nama komponen menjadi `MessagePage`), hapus file lama. Tambahkan `async redirects()` pada `next.config.ts` yang memetakan `/love-mail` → `/pesan` dengan `permanent: true`. Perubahan teks di dalam halaman dikerjakan di Task 5.

Perbarui juga kedua tautan internal yang menunjuk rute lama agar tidak bergantung pada redirect:
`MainNavigation.tsx:33` dan `page.tsx:305` (`href="/love-mail"`) menjadi `/pesan`.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node dashboard/tests/verify-neutral-wording.mjs`
Expected: assertion `Rute:` PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/pesan dashboard/src/app/love-mail dashboard/next.config.* dashboard/tests/verify-neutral-wording.mjs
git commit -m "refactor(ui): move love-mail route to /pesan with permanent redirect"
```

---

### Task 4: Istilah, ikon, dan warna di seluruh UI

**Files:**
- Modify: `dashboard/src/components/MainNavigation.tsx`
- Modify: `dashboard/src/lib/activity-helper.ts`
- Modify: `dashboard/src/app/page.tsx`
- Modify: `dashboard/src/app/pesan/page.tsx`
- Modify: `dashboard/src/app/memories/page.tsx`
- Modify: `dashboard/src/app/notes/page.tsx`
- Modify: `dashboard/src/app/timeline/page.tsx`
- Modify: `dashboard/src/app/login/page.tsx`
- Modify: `dashboard/src/app/layout.tsx`
- Modify: `dashboard/src/app/globals.css`
- Modify: `dashboard/src/app/api/dashboard/messages/route.ts`
- Modify: `dashboard/src/app/api/dashboard/overview/route.ts`
- Modify: `dashboard/public/manifest.json`
- Delete: `dashboard/src/app/manifest.ts`
- Modify: `dashboard/tests/verify-neutral-wording.mjs`

**Interfaces:**
- Consumes: rute `/pesan` (Task 3), kategori baru (Task 1).
- Produces: tidak ada API baru; hanya teks, ikon, warna, dan manifest.

- [ ] **Step 1: Tulis tes yang gagal**

```js
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
assert(loveHits.length === 0, `Wording: tidak ada istilah romantis (ditemukan di: ${loveHits.join(', ') || 'tidak ada'})`);

const heartHits = scanSrc(srcDir, '\\bHeart\\b');
assert(heartHits.length === 0, `Ikon: tidak ada ikon Heart (ditemukan di: ${heartHits.join(', ') || 'tidak ada'})`);

const roseHits = scanSrc(srcDir, 'rose-[0-9]');
assert(roseHits.length === 0, `Warna: tidak ada kelas rose-* (ditemukan di: ${roseHits.join(', ') || 'tidak ada'})`);

const staticManifest = readFileSync(path.join(rootDir, 'dashboard/public/manifest.json'), 'utf-8');
assert(!/love/i.test(staticManifest), 'PWA: manifest statis bebas dari kata love');
assert(staticManifest.includes('/pesan'), 'PWA: shortcut mengarah ke /pesan');
assert(
  !existsSync(path.join(rootDir, 'dashboard/src/app/manifest.ts')),
  'PWA: manifest.ts yang tidak terpakai sudah dihapus'
);
```

Tambahkan `readdirSync` pada import `fs` di bagian atas file.

**Penting:** pola `love mail` sengaja memakai spasi, bukan `_`, agar nama fungsi database
`enqueue_love_mail` / `claim_next_love_mail` dan tipe event `love_mail` di
`activity-helper.ts:37` tidak ikut tertangkap — keduanya sengaja dipertahankan.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node dashboard/tests/verify-neutral-wording.mjs`
Expected: assertion `Wording:`, `Ikon:`, `Warna:`, `PWA:` gagal dengan daftar file.

- [ ] **Step 3: Ganti istilah, ikon, dan warna**

Terapkan tabel istilah spec §5.2 dan tabel ikon §5.9 di seluruh file yang terdaftar. Aturan warna:

- `rose-*` yang dekoratif (aksen romantis, badge Love Mail, kartu surat) → `#466743` / `#5e6b5f`.
- `rose-*` yang menandakan bahaya (tombol Hapus, banner error, modal konfirmasi) → `red-*`.
- Hapus `--accent-rose` dan `--accent-rose-subtle` dari `globals.css` bila setelah penggantian tidak ada yang memakainya.
- Hapus emoji 💌 di `api/dashboard/messages/route.ts`.
- `layout.tsx`: perbarui `description`.
- `public/manifest.json`: perbarui `description`, `short_name`, dan `url` shortcut menjadi `/pesan`.
- Hapus `src/app/manifest.ts`.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node dashboard/tests/verify-neutral-wording.mjs`
Expected: seluruh assertion `Wording:`, `Ikon:`, `Warna:`, `PWA:` PASS.

- [ ] **Step 5: Perbarui suite phase7 yang mengunci istilah lama**

`dashboard/tests/verify-phase7-e2e-integration.mjs` memuat assertion tentang `/love-mail` dan ikon hati. Perbarui assertion itu agar menunjuk `/pesan` dan ikon baru — **jangan hapus** assertion-nya.

Run: `node dashboard/tests/verify-phase7-e2e-integration.mjs`
Expected: exit 0.

- [ ] **Step 6: Typecheck dan build**

Run: `cd dashboard; npx tsc --noEmit; npm run build`
Expected: keduanya exit 0.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src dashboard/public/manifest.json dashboard/tests
git commit -m "refactor(ui): neutral wording, icons, and danger colour separation"
```

---

### Task 5: Tombol Edit, Hapus, dan simpan template contoh

**Files:**
- Modify: `dashboard/src/app/notes/page.tsx`
- Modify: `dashboard/tests/verify-neutral-wording.mjs`

**Interfaces:**
- Consumes: `PATCH`/`DELETE` (Task 2), `is_example` dari `GET`.
- Produces: —

- [ ] **Step 1: Tulis tes yang gagal**

```js
const notesPage = readFileSync(path.join(rootDir, 'dashboard/src/app/notes/page.tsx'), 'utf-8');

assert(/method:\s*'PATCH'/.test(notesPage), 'Template: UI mengirim PATCH untuk menyimpan perubahan');
assert(/method:\s*'DELETE'/.test(notesPage), 'Template: UI mengirim DELETE untuk menghapus');
assert(notesPage.includes('is_example'), 'Template: UI membedakan template contoh');
assert(notesPage.includes('Simpan sebagai template'), 'Template: contoh punya tombol simpan');
assert(/showDeleteConfirm|confirmDelete/.test(notesPage), 'Template: hapus memakai konfirmasi');
assert(notesPage.includes('editingId'), 'Template: form yang sama dipakai untuk mode ubah');
assert(notesPage.includes('LayoutTemplate'), 'Template: memakai ikon LayoutTemplate, bukan Sparkles');
assert(!/Sparkles/.test(notesPage), 'Template: ikon Sparkles sudah tidak dipakai');
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node dashboard/tests/verify-neutral-wording.mjs`
Expected: assertion `Template:` gagal.

- [ ] **Step 3: Implementasikan pengeditan template**

Di `notes/page.tsx`:

- State baru: `editingId: string | null`, `showDeleteConfirm: string | null`.
- Form tambah dipakai ulang: bila `editingId` terisi, tombol submit mengirim `PATCH` dengan `{ id, title, body, category }`; bila kosong, `POST` seperti sekarang.
- Tiap kartu yang punya `id` menampilkan tombol **Edit** (mengisi form dan set `editingId`) dan **Hapus** (set `showDeleteConfirm`).
- Modal konfirmasi hapus menyebut judul template, dengan tombol Batal dan Hapus.
- Kartu dengan `is_example` **tidak** menampilkan Edit/Hapus, melainkan tombol **Simpan sebagai template** yang memanggil `POST` biasa lalu `fetchTemplates()`.
- Kategori: ganti `CATEGORIES` menjadi `['Semua','Umum','Pengingat','Sapaan','Semangat','Lainnya']`.
- Ganti `Sparkles` → `LayoutTemplate`, judul "Quick Love Notes" → "Template Pesan", deskripsi netral.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node dashboard/tests/verify-neutral-wording.mjs`
Expected: seluruh assertion `Template:` PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/notes/page.tsx dashboard/tests/verify-neutral-wording.mjs
git commit -m "feat(ui): edit, delete, and save example templates"
```

---

### Task 6: Header OLED firmware 1.9.0

**Files:**
- Modify: `firmware/MewBot_ESP32C3/display_manager.cpp:217,220`
- Modify: `firmware/MewBot_ESP32C3/config.h`
- Modify: `dashboard/tests/verify-neutral-wording.mjs`

**Interfaces:**
- Consumes: —
- Produces: firmware `FIRMWARE_VERSION "1.9.0"` dengan header OLED `PESAN`.

- [ ] **Step 1: Tulis tes yang gagal**

```js
const displayCpp = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/display_manager.cpp'), 'utf-8');
const configH = readFileSync(path.join(rootDir, 'firmware/MewBot_ESP32C3/config.h'), 'utf-8');

assert(!/LOVE MAIL/.test(displayCpp), 'Firmware: header OLED tidak lagi menulis LOVE MAIL');
assert(displayCpp.includes('PESAN [%d/%d]'), 'Firmware: header halaman menulis PESAN [n/m]');
assert(displayCpp.includes('PESAN (15s)'), 'Firmware: header tunggal menulis PESAN (15s)');
assert(/FIRMWARE_VERSION\s+"1\.9\.0"/.test(configH), 'Firmware: versi naik ke 1.9.0');
assert(
  displayCpp.includes('drawLoveMail'),
  'Firmware: nama fungsi internal drawLoveMail sengaja dipertahankan'
);
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node dashboard/tests/verify-neutral-wording.mjs`
Expected: assertion `Firmware:` gagal.

- [ ] **Step 3: Ubah string dan versi**

Di `display_manager.cpp` ganti kedua literal `"LOVE MAIL ..."` menjadi `"PESAN ..."`. Di `config.h` naikkan `FIRMWARE_VERSION` menjadi `"1.9.0"`. Jangan mengubah nama fungsi.

- [ ] **Step 4: Jalankan tes dan compile**

Run: `node dashboard/tests/verify-neutral-wording.mjs`
Expected: seluruh assertion `Firmware:` PASS.

Run: perintah build firmware (`arduino-cli compile -b esp32:esp32:nologo_esp32c3_super_mini --build-property "upload.maximum_size=1835008" --build-property "build.partitions=partitions" "firmware\MewBot_ESP32C3"`)
Expected: `Sketch uses` di bawah 1.835.008 byte, tanpa error.

- [ ] **Step 5: Commit**

```bash
git add firmware/MewBot_ESP32C3/display_manager.cpp firmware/MewBot_ESP32C3/config.h dashboard/tests/verify-neutral-wording.mjs
git commit -m "feat(firmware): neutral OLED header for messages (1.9.0)"
```

---

### Task 7: Dokumentasi dan verifikasi menyeluruh

**Files:**
- Modify: `docs/PANDUAN_PENGGUNAAN.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `README.md`
- Modify: `dashboard/tests/verify-neutral-wording.mjs`

**Interfaces:**
- Consumes: seluruh perubahan Task 1–6.
- Produces: dokumentasi yang cocok dengan UI baru.

- [ ] **Step 1: Tulis tes yang gagal**

```js
const panduan = readFileSync(path.join(rootDir, 'docs/PANDUAN_PENGGUNAAN.md'), 'utf-8');
const changelog = readFileSync(path.join(rootDir, 'docs/CHANGELOG.md'), 'utf-8');

assert(!/Love Mail/i.test(panduan), 'Dokumen: panduan tidak lagi memakai istilah Love Mail');
assert(panduan.includes('/pesan'), 'Dokumen: panduan menyebut rute /pesan');
assert(panduan.includes('Template Pesan'), 'Dokumen: panduan menyebut Template Pesan');
assert(changelog.includes('[1.9.0]'), 'Dokumen: changelog mencatat rilis 1.9.0');
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node dashboard/tests/verify-neutral-wording.mjs`
Expected: assertion `Dokumen:` gagal.

- [ ] **Step 3: Perbarui dokumentasi**

- `PANDUAN_PENGGUNAAN.md`: ganti seluruh istilah lama, perbarui tabel halaman (`/pesan`, Riwayat Pesan, Template Pesan), tambah penjelasan tombol Edit/Hapus template dan cara menyimpan template contoh.
- `CHANGELOG.md`: tambah entri `[1.9.0] — 2026-11-18` di atas, menjelaskan redesain netral, template yang bisa diedit, migrasi kategori, dan header OLED baru. **Jangan** mengubah entri versi lama.
- `README.md`: perbarui deskripsi fitur agar konsisten.

- [ ] **Step 4: Jalankan seluruh suite**

Run: `Get-ChildItem "dashboard\tests\verify-*.mjs" | ForEach-Object { node $_.FullName }`
Expected: semua exit 0, termasuk `verify-neutral-wording.mjs`, `verify-ota.mjs` (51), dan `verify-phase7-e2e-integration.mjs`.

- [ ] **Step 5: Build final**

Run: `cd dashboard; npx tsc --noEmit; npm run build`
Expected: keduanya exit 0.

- [ ] **Step 6: Commit**

```bash
git add docs README.md dashboard/tests/verify-neutral-wording.mjs
git commit -m "docs: neutral wording across guide, changelog, and readme"
```
