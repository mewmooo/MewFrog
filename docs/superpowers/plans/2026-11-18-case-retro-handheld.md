# Case MewBot "Retro Handheld" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat case OpenSCAD parametrik 4-part untuk MewBot (front shell, back shell, bezel, cradle) yang dapat dicetak FDM dan memuat seluruh elektronika.

**Architecture:** Satu file parameter (`mewbot_case_params.scad`) menjadi satu-satunya tempat angka yang bisa berubah; setiap part meng-`include`-nya. Modul bersama (rounded box, lip, boss sekrup, kantong komponen) hidup di `mewbot_case_common.scad`. Setiap part adalah file `.scad` mandiri yang bisa dirender sendiri menjadi STL. Verifikasi berupa skrip Node yang merender tiap part lewat OpenSCAD CLI lalu mengukur STL-nya (bounding box, volume, manifold).

**Tech Stack:** OpenSCAD 2021+ (`C:\Program Files\OpenSCAD\openscad.exe`), Node.js 20+ ESM untuk skrip verifikasi, STL ASCII sebagai format antara.

**Spec:** `docs/superpowers/specs/2026-11-18-case-retro-handheld-design.md`

## Global Constraints

- Dimensi luar: **±58 (W) × 44 (D) × 66 (H) mm**; toleransi ±1 mm pada verifikasi.
- Tebal dinding luar **1,8 mm**; rel internal **1,2 mm**; tidak ada fitur < **1,2 mm**.
- Clearance lip **0,25 mm**; lip engagement **1,4 mm**; tebal lip **0,9 mm**.
- Sekrup **4× M2.5×10**, boss OD **5,4 mm**, pilot Ø**2,2 mm** (depan), clearance Ø**2,8 mm** + counterbore Ø**5,2 mm** (belakang), masuk **dari belakang**.
- Posisi boss: bawah **X = ±17,5 / Z = 8 mm**, atas **X = ±14,8 / Z = 46 mm**.
- Parting plane **planar di Y = 0**; cangkang depan hanya Y ≤ 0, belakang hanya Y ≥ 0.
- Kemiringan layar **12°**.
- Jendela layar **30,2 × 15,2 mm** (untuk modul 1,3").
- Baterai Li-Po: bilik **42 × 34 × 9 mm**, antena ≥ **10 mm** dari baterai.
- Semua part muat build plate **220 × 220 mm**, tinggi < **250 mm**.
- Semua komentar dan dokumentasi **berbahasa Indonesia**.
- Tidak ada emoji kodok.
- Target berat total **< 75 g PLA** (densitas 1,24 g/cm³).

## Review Focus

- **Modul OLED ternyata 0,96"**: `bezel_096` (lubang dalam 23 × 12 mm) + `oled_shim` harus menutup celah tanpa menyisakan celah terlihat; cangkang tidak boleh perlu dicetak ulang.
- **Port USB-C TP4056 lebih tinggi dari nominal**: lubang 12 × 7 mm harus tetap bisa dimasuki colokan; boss sekrup bawah tidak boleh memakan area lubang.
- **Baterai lebih tebal dari 9 mm**: bilik harus tetap bisa menampung lewat parameter `batt_h` tanpa mengubah dimensi luar.
- **Antena terhalang baterai**: jarak vertikal antena ke bilik baterai ≥ 10 mm harus terbukti dari geometri, bukan dari niat.
- **Cangkang tidak bisa ditutup**: lip dan boss sekrup harus benar-benar bertemu di Y = 0 tanpa saling menembus.

---

### Task 0: Simpan desain yang sudah disetujui

**Files:**
- Modify: (index git)

**Interfaces:**
- Consumes: —
- Produces: baseline commit sehingga diff case mudah ditinjau.

- [ ] **Step 1: Cek status**

Run: `git status --short`
Expected: hanya `docs/superpowers/specs/2026-11-18-case-retro-handheld-design.md` yang belum ter-commit (plus `.vscode/` yang memang diabaikan).

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-11-18-case-retro-handheld-design.md
git commit -m "docs: add retro handheld case design spec"
```

---

### Task 1: Parameter, modul bersama, dan harness verifikasi geometri

**Files:**
- Create: `hardware/case/mewbot_case_params.scad`
- Create: `hardware/case/mewbot_case_common.scad`
- Create: `dashboard/tests/verify-case-geometry.mjs`
- Create: `hardware/case/README.md`

**Interfaces:**
- Consumes: —
- Produces:
  - `mewbot_case_params.scad` berisi variabel global: `case_w`, `case_d`, `case_h`, `wall`, `lip_clearance`, `lip_thickness`, `lip_engagement`, `screw_positions` (array `[[x,z],...]`), `boss_od`, `boss_pilot_d`, `boss_clear_d`, `boss_cbore_d`, `display_tilt`, `oled_win_w`, `oled_win_h`, `batt_w`, `batt_d`, `batt_h`, `bezel_open_w`, `bezel_open_h`.
  - `mewbot_case_common.scad` menyediakan modul: `rounded_box(w, d, h, r)` (berpusat di XY, dari Z=0), `screw_boss_front(x, z)`, `screw_hole_back(x, z)`, `perimeter_lip(inset)`, `perimeter_groove()`.
  - Skrip verifikasi: `renderPart(scadPath) -> { vertices, triangles, bbox, volume }`, dan helper `assertBBox(stl, w, d, h, tol, label)`, `assertManifold(stl, label)`, `assertMass(stl, maxGrams, label)`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `dashboard/tests/verify-case-geometry.mjs`:

```js
import { execFileSync } from 'child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const OPENSCAD = 'C:\\Program Files\\OpenSCAD\\openscad.exe';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const caseDir = path.join(rootDir, 'hardware/case');

let passed = 0, total = 0;
function assert(cond, msg) {
  total++;
  if (cond) { console.log(`[PASS] ${msg}`); passed++; }
  else console.error(`[FAIL] ${msg}`);
}

export function renderPart(scadPath, extraArgs = []) {
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'mewbot-stl-')), 'part.stl');
  execFileSync(OPENSCAD, ['-o', out, '--export-format', 'asciistl', ...extraArgs, scadPath], { stdio: 'pipe' });
  const text = readFileSync(out, 'utf-8');
  const verts = [];
  const tris = [];
  const re = /vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g;
  let m;
  while ((m = re.exec(text))) verts.push([+m[1], +m[2], +m[3]]);
  for (let i = 0; i + 2 < verts.length; i += 3) tris.push([verts[i], verts[i+1], verts[i+2]]);
  rmSync(path.dirname(out), { recursive: true, force: true });
  return { triangles: tris };
}

const PARAMS = readFileSync(path.join(caseDir, 'mewbot_case_params.scad'), 'utf-8');
const COMMON = readFileSync(path.join(caseDir, 'mewbot_case_common.scad'), 'utf-8');

assert(PARAMS.includes('case_w'), 'Param: case_w didefinisikan');
assert(/case_w\s*=\s*58/.test(PARAMS), 'Param: case_w = 58 mm');
assert(/case_d\s*=\s*44/.test(PARAMS), 'Param: case_d = 44 mm');
assert(/case_h\s*=\s*66/.test(PARAMS), 'Param: case_h = 66 mm');
assert(/boss_low_x\s*=\s*17\.5/.test(PARAMS), 'Param: boss bawah X = 17,5 mm');
assert(/boss_od\s*=\s*5\.4/.test(PARAMS), 'Param: boss OD = 5,4 mm');
assert(/wall\s*=\s*1\.8/.test(PARAMS), 'Param: tebal dinding 1,8 mm');
assert(/lip_clearance\s*=\s*0\.25/.test(PARAMS), 'Param: clearance lip 0,25 mm');
assert(/batt_h\s*=\s*9/.test(PARAMS), 'Param: tinggi bilik baterai 9 mm');
assert(COMMON.includes('module rounded_box'), 'Common: menyediakan rounded_box');
assert(COMMON.includes('module screw_boss_front'), 'Common: menyediakan screw_boss_front');
assert(COMMON.includes('module screw_hole_back'), 'Common: menyediakan screw_hole_back');

console.log(`\nResults: ${passed}/${total} tests passed\n`);
process.exit(passed === total ? 0 : 1);
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node dashboard/tests/verify-case-geometry.mjs`
Expected: FAIL dengan `ENOENT` pada `mewbot_case_params.scad`.

- [ ] **Step 3: Buat parameter dan modul bersama**

`mewbot_case_params.scad` — semua angka dari Global Constraints, dengan komentar satu baris per variabel menjelaskan apa yang berubah kalau nilainya diubah. Sertakan blok komentar di atas berisi tabel "ukur sebelum cetak" dari §9 spec.

`mewbot_case_common.scad` — `include <mewbot_case_params.scad>` lalu:
- `rounded_box(w, d, h, r)`: hull 4 silinder.
- `screw_boss_front(x, z)`: silinder `boss_od` tinggi 7,5 dari Y=0 ke arah −Y, dikurangi pilot Ø2,2 sedalam 7,0, plus gusset 1,2 mm ke dinding.
- `screw_hole_back(x, z)`: silinder clearance Ø2,8 tembus, ditambah counterbore Ø5,2 sedalam 2,5 dari permukaan luar.
- `perimeter_lip(inset)`, `perimeter_groove()`: memakai `offset()` pada profil 2D badan; keduanya harus memakai `case_w`/`case_d` yang sama agar selisihnya tepat 0,5 mm.

Buat `hardware/case/README.md` kerangka: judul, daftar part, perintah render, dan bagian kosong "Daftar Belanja" serta "Panduan Cetak" untuk diisi Task 6.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node dashboard/tests/verify-case-geometry.mjs`
Expected: `Results: 12/12`.

- [ ] **Step 5: Buktikan OpenSCAD benar-benar bisa merender modul bersama**

Buat file sementara `hardware/case/_smoke.scad` berisi `include <mewbot_case_common.scad> rounded_box(20, 20, 10, 3);`, render lewat CLI, pastikan keluar tanpa error, lalu hapus file itu.

Run: `& "C:\Program Files\OpenSCAD\openscad.exe" -o "$env:TEMP\smoke.stl" "hardware/case/_smoke.scad"`
Expected: tidak ada pesan `ERROR`/`WARNING`.

- [ ] **Step 6: Commit**

```bash
git add hardware/case dashboard/tests/verify-case-geometry.mjs
git commit -m "feat(case): parametric params, shared modules, geometry test harness"
```

---

### Task 2: Cangkang depan

**Files:**
- Create: `hardware/case/mewbot_case_front.scad`
- Modify: `dashboard/tests/verify-case-geometry.mjs`

**Interfaces:**
- Consumes: `mewbot_case_params.scad`, `mewbot_case_common.scad` (Task 1).
- Produces: modul `mewbot_front_shell()` yang menghasilkan solid dengan Y ≤ 0, plus variabel `tts_pocket_*` dan `adxl_*` yang dipakai Task 6 untuk pengecekan tabrakan.

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan ke `dashboard/tests/verify-case-geometry.mjs` sebelum baris `console.log` penutup:

```js
const frontStl = renderPart(path.join(caseDir, 'mewbot_case_front.scad'));
const fb = bboxOf(frontStl);
assert(Math.abs(fb.w - 58) <= 1.0, `Front: lebar ${fb.w.toFixed(1)} mm mendekati 58`);
assert(Math.abs(fb.d - 22) <= 1.5, `Front: kedalaman ${fb.d.toFixed(1)} mm mendekati 22 (setengah 44)`);
assert(Math.abs(fb.h - 66) <= 1.0, `Front: tinggi ${fb.h.toFixed(1)} mm mendekati 66`);
assert(fb.maxY <= 0.01, 'Front: seluruh geometri di Y <= 0 (parting plane planar)');
assert(isManifold(frontStl), 'Front: mesh tertutup (manifold)');
assert(massGrams(frontStl) < 40, `Front: massa ${massGrams(frontStl).toFixed(1)} g di bawah 40 g`);
```

Tambahkan helper `bboxOf`, `isManifold`, `massGrams` di bagian atas file (setelah `renderPart`):

```js
function bboxOf(stl) {
  const xs = stl.triangles.flatMap(t => t.map(v => v[0]));
  const ys = stl.triangles.flatMap(t => t.map(v => v[1]));
  const zs = stl.triangles.flatMap(t => t.map(v => v[2]));
  return {
    w: Math.max(...xs) - Math.min(...xs),
    d: Math.max(...ys) - Math.min(...ys),
    h: Math.max(...zs) - Math.min(...zs),
    maxY: Math.max(...ys),
    minZ: Math.min(...zs),
  };
}

function massGrams(stl) {
  let vol = 0;
  for (const [a, b, c] of stl.triangles) {
    vol += (a[0]*(b[1]*c[2] - b[2]*c[1]) - a[1]*(b[0]*c[2] - b[2]*c[0]) + a[2]*(b[0]*c[1] - b[1]*c[0])) / 6;
  }
  return (Math.abs(vol) / 1000) * 1.24;
}

function isManifold(stl) {
  const edges = new Map();
  const key = (v) => v.map(n => n.toFixed(3)).join(',');
  for (const tri of stl.triangles) {
    for (let i = 0; i < 3; i++) {
      const a = key(tri[i]), b = key(tri[(i + 1) % 3]);
      const e = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(e, (edges.get(e) || 0) + 1);
    }
  }
  return [...edges.values()].every(n => n === 2);
}
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node dashboard/tests/verify-case-geometry.mjs`
Expected: FAIL — file `mewbot_case_front.scad` tidak ada.

- [ ] **Step 3: Implementasikan cangkang depan**

`mewbot_case_front.scad` berisi `include <mewbot_case_common.scad>` lalu:

- `front_outer_solid()`: `rounded_box(case_w, case_d/2, case_h, 8)` diiris `Y <= 0`, ditambah pelebaran sudut atas (siluet kepala kodok) berupa `hull()` antara dua penampang di Z = 46 dan Z = 62 dengan lebar bertambah 4 mm.
- `front_inner_cavity()`: `rounded_box(case_w - 2*wall, case_d/2 - wall, case_h - wall, 8 - wall)` diiris `Y <= 0`, digeser 0,5 mm ke +Y agar dinding punggung tidak nol.
- `oled_window()`: pada bidang miring 12° di `Z = oled_center_z`, lubang `oled_win_w × oled_win_h` menembus dinding, plus kantong bezel sedalam 1,1 mm memakai poligon bertingkat `stepped_bezel_2d()` (salin dari Olive Egg, sesuaikan ukuran).
- `oled_bosses()`: 4 boss M2 pitch `30.5 × 29.0`, OD 4,4, pilot Ø1,8, tinggi 3,8, menempel dinding dalam pada bidang miring.
- `ttp_pocket()`: kantong 15,5 × 11,5 × 2,5 di **mahkota atas** (Z = `case_h - 1.3 - 2.5`), berpusat X = 0, Y = −6,5, dengan dinding atas 1,3 mm.
- `adxl_bosses()`: 2 boss M2 pitch 15 mm di lantai (Z = wall), OD 4,5, pilot Ø2,0.
- `screw_boss_front()` untuk tiap `screw_positions`.
- Dispatcher: `RENDER_MODE = "PART"` → tampilkan `mewbot_front_shell()`; `"PRINT_READY"` → `rotate([90,0,0])`.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node dashboard/tests/verify-case-geometry.mjs`
Expected: seluruh assertion `Front:` PASS.

- [ ] **Step 5: Commit**

```bash
git add hardware/case/mewbot_case_front.scad dashboard/tests/verify-case-geometry.mjs
git commit -m "feat(case): front shell with screen window, touch pocket, adxl bosses"
```

---

### Task 3: Cangkang belakang

**Files:**
- Create: `hardware/case/mewbot_case_back.scad`
- Modify: `dashboard/tests/verify-case-geometry.mjs`

**Interfaces:**
- Consumes: Task 1 modules, `screw_positions` dari params.
- Produces: modul `mewbot_back_shell()` dengan Y ≥ 0; variabel `batt_bay_top_z` (batas atas bilik baterai) dan `mcu_rail_bottom_z` yang dipakai Task 6.

- [ ] **Step 1: Tulis tes yang gagal**

```js
const backStl = renderPart(path.join(caseDir, 'mewbot_case_back.scad'));
const bb = bboxOf(backStl);
assert(Math.abs(bb.w - 58) <= 1.0, `Back: lebar ${bb.w.toFixed(1)} mm mendekati 58`);
assert(Math.abs(bb.d - 22) <= 1.5, `Back: kedalaman ${bb.d.toFixed(1)} mm mendekati 22`);
assert(bb.minY >= -0.01, 'Back: seluruh geometri di Y >= 0 (parting plane planar)');
assert(isManifold(backStl), 'Back: mesh tertutup (manifold)');
assert(massGrams(backStl) < 35, `Back: massa ${massGrams(backStl).toFixed(1)} g di bawah 35 g`);

const BACK = readFileSync(path.join(caseDir, 'mewbot_case_back.scad'), 'utf-8');
assert(/usbc_open_w\s*=\s*12/.test(BACK), 'Back: lubang USB-C 12 mm (longgar untuk TP4056)');
assert(/usbc_open_h\s*=\s*7/.test(BACK), 'Back: lubang USB-C 7 mm (longgar untuk tinggi port)');
assert(BACK.includes('batt_bay_top_z') && BACK.includes('mcu_rail_bottom_z'), 'Back: mengekspos batas bilik baterai & rel MCU');
assert(
  Number(BACK.match(/batt_bay_top_z\s*=\s*([\d.]+)/)?.[1]) + 10 <=
    Number(BACK.match(/mcu_rail_bottom_z\s*=\s*([\d.]+)/)?.[1]),
  'Back: jarak antena ke bilik baterai >= 10 mm'
);
assert(BACK.includes('back_perimeter_lip'), 'Back: memiliki lip perimeter untuk mengunci kedua cangkang');

const FRONT = readFileSync(path.join(caseDir, 'mewbot_case_front.scad'), 'utf-8');
assert(FRONT.includes('front_perimeter_groove'), 'Front: memiliki groove yang menerima lip belakang');

const bossX = Number(PARAMS.match(/boss_low_x\s*=\s*([\d.]+)/)?.[1]);
const usbcX = Number(BACK.match(/tp4056_offset_x\s*=\s*(-?[\d.]+)/)?.[1]);
const usbcW = Number(BACK.match(/usbc_open_w\s*=\s*([\d.]+)/)?.[1]);
const bossOd = Number(PARAMS.match(/boss_od\s*=\s*([\d.]+)/)?.[1]);
assert(
  Math.abs(bossX) - bossOd / 2 > Math.abs(usbcX) + usbcW / 2,
  'Back: boss sekrup bawah tidak menabrak lubang USB-C'
);
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node dashboard/tests/verify-case-geometry.mjs`
Expected: FAIL — file `mewbot_case_back.scad` tidak ada.

- [ ] **Step 3: Implementasikan cangkang belakang**

- `back_outer_solid()`: cermin dari depan, diiris `Y >= 0`, plus relief kodok 0,8 mm (dua mata + mulut) di punggung atas memakai `difference()` dengan `hull()` bola, dan slot lanyard cekung 12 × 4 × 3 mm di Z = 56.
- `back_inner_cavity()`: cermin dari cavity depan.
- `battery_bay()`: rel samping 1,2 mm + shelf bawah pada `Z = batt_floor_z`, lebar `batt_w`, dalam `batt_d`, tinggi `batt_h`. Ekspos `batt_bay_top_z = batt_floor_z + batt_h`.
- `mcu_rails()`: dua rel 1,2 mm membentuk slot `mcu_w` di dinding punggung atas, `mcu_rail_bottom_z` di atas `batt_bay_top_z + 10`.
- `tp4056_cutout()`: lubang 12 × 7 mm dengan chamfer, di `X = tp4056_offset_x`, `Z = tp4056_center_z`.
- `switch_cutout()`: slot 5 × 2,8 mm + kantong jari 9,5 × 5,8 mm.
- `screw_hole_back()` untuk tiap `screw_positions`.
- `back_perimeter_lip()`: lip 0,9 mm menonjol 1,4 mm ke −Y.
- Dispatcher `RENDER_MODE`.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node dashboard/tests/verify-case-geometry.mjs`
Expected: seluruh assertion `Back:` PASS.

- [ ] **Step 5: Verifikasi lip benar-benar bertemu**

Render kedua cangkang, hitung `bboxOf(front).w - bboxOf(back).w` dan pastikan selisihnya < 0,5 mm (menandakan keduanya memakai profil dasar yang sama).

- [ ] **Step 6: Commit**

```bash
git add hardware/case/mewbot_case_back.scad dashboard/tests/verify-case-geometry.mjs
git commit -m "feat(case): back shell with battery bay, mcu rails, ports, frog relief"
```

---

### Task 4: Bezel dua ukuran dan shim OLED

**Files:**
- Create: `hardware/case/mewbot_case_bezel.scad`
- Create: `hardware/case/mewbot_case_shim.scad`
- Modify: `dashboard/tests/verify-case-geometry.mjs`

**Interfaces:**
- Consumes: Task 1 modules.
- Produces: `mewbot_bezel(open_w, open_h)` yang dirender dua kali lewat `-D 'bezel_variant="130"'` dan `-D 'bezel_variant="096"'`.

- [ ] **Step 1: Tulis tes yang gagal**

```js
const bezel130 = renderPart(path.join(caseDir, 'mewbot_case_bezel.scad'), ['-D', 'bezel_variant="130"']);
const bezel096 = renderPart(path.join(caseDir, 'mewbot_case_bezel.scad'), ['-D', 'bezel_variant="096"']);
const b130 = bboxOf(bezel130), b096 = bboxOf(bezel096);

assert(Math.abs(b130.w - 38.4) <= 0.6, `Bezel 1.3": lebar luar ${b130.w.toFixed(1)} mm = 38,4`);
assert(Math.abs(b096.w - 38.4) <= 0.6, 'Bezel 0.96": lebar luar sama agar masuk kantong yang sama');
assert(b130.h < 4, 'Bezel: tinggi total < 4 mm (keping tipis)');
assert(isManifold(bezel130) && isManifold(bezel096), 'Bezel: kedua varian manifold');
assert(massGrams(bezel130) < 4, `Bezel: massa ${massGrams(bezel130).toFixed(1)} g di bawah 4 g`);

const shim = renderPart(path.join(caseDir, 'mewbot_case_shim.scad'));
const sh = bboxOf(shim);
assert(sh.w >= 27 && sh.w <= 36, `Shim: lebar ${sh.w.toFixed(1)} mm menjembatani PCB 27 mm ke cradle 35 mm`);
assert(isManifold(shim), 'Shim: manifold');
```

`renderPart` perlu menerima argumen tambahan `-D`; ubah signature menjadi `renderPart(scadPath, extraArgs = [])`.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node dashboard/tests/verify-case-geometry.mjs`
Expected: FAIL — file bezel & shim tidak ada.

- [ ] **Step 3: Implementasikan bezel dan shim**

`mewbot_case_bezel.scad`: `bezel_variant` memilih pasangan `(open_w, open_h)`: `"130"` → `30.2 × 15.2`, `"096"` → `23.0 × 12.0`. Tiga tier bertingkat (38,4 → 35,5 → 33,5 lebar luar), tinggi total 2,5 mm, dengan 4 indentasi sekrup dekoratif Ø2,0. Semua tier memakai poligon bertingkat yang sama (`stepped_bezel_2d`) agar gayanya konsisten.

`mewbot_case_shim.scad`: pelat 35,0 × 31,5 × 1,2 mm dengan 4 lubang M2 di pitch besar (30,5 × 29,0) dan 4 lubang M2 di pitch kecil (23,0 × 23,0), ditambah bibir penahan PCB 0,8 mm.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node dashboard/tests/verify-case-geometry.mjs`
Expected: seluruh assertion `Bezel:` dan `Shim:` PASS.

- [ ] **Step 5: Commit**

```bash
git add hardware/case/mewbot_case_bezel.scad hardware/case/mewbot_case_shim.scad dashboard/tests/verify-case-geometry.mjs
git commit -m "feat(case): stepped bezel for both OLED sizes and pcb shim"
```

---

### Task 5: Cradle meja

**Files:**
- Create: `hardware/case/mewbot_case_cradle.scad`
- Modify: `dashboard/tests/verify-case-geometry.mjs`

**Interfaces:**
- Consumes: `case_w`, `case_d` dari params.
- Produces: modul `mewbot_cradle()` dengan sudut sandar 10°.

- [ ] **Step 1: Tulis tes yang gagal**

```js
const cradle = renderPart(path.join(caseDir, 'mewbot_case_cradle.scad'));
const cb = bboxOf(cradle);
assert(cb.w >= 58 && cb.w <= 75, `Cradle: lebar ${cb.w.toFixed(1)} mm menampung case 58 mm`);
assert(isManifold(cradle), 'Cradle: manifold');
assert(massGrams(cradle) < 25, `Cradle: massa ${massGrams(cradle).toFixed(1)} g di bawah 25 g`);
assert(bboxOf(cradle).minZ >= -0.01, 'Cradle: duduk rata di Z = 0');

const CRADLE = readFileSync(path.join(caseDir, 'mewbot_case_cradle.scad'), 'utf-8');
assert(/cradle_angle\s*=\s*10/.test(CRADLE), 'Cradle: sudut 10 derajat');
assert(CRADLE.includes('usbc_notch'), 'Cradle: punya potongan agar USB-C bisa dicolok saat didudukkan');
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node dashboard/tests/verify-case-geometry.mjs`
Expected: FAIL — file cradle tidak ada.

- [ ] **Step 3: Implementasikan cradle**

L-shaped: alas 70 × 50 × 4 mm dengan bibir depan 8 mm tinggi, permukaan sandar miring `cradle_angle` derajat, dua dinding samping 3 mm setinggi 30 mm untuk menahan case agar tidak jatuh ke samping, dan `usbc_notch` berupa potongan 20 × 12 mm di tengah bibir depan.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node dashboard/tests/verify-case-geometry.mjs`
Expected: seluruh assertion `Cradle:` PASS.

- [ ] **Step 5: Commit**

```bash
git add hardware/case/mewbot_case_cradle.scad dashboard/tests/verify-case-geometry.mjs
git commit -m "feat(case): desk cradle with usb-c notch"
```

---

### Task 6: Preview rakitan, panduan cetak, dan daftar belanja

**Files:**
- Create: `hardware/case/mewbot_case_assembly.scad`
- Modify: `hardware/case/README.md`
- Modify: `dashboard/tests/verify-case-geometry.mjs`

**Interfaces:**
- Consumes: keempat part dari Task 2–5.
- Produces: file preview rakitan dan dokumentasi cetak.

- [ ] **Step 1: Tulis tes yang gagal**

```js
const assembly = path.join(caseDir, 'mewbot_case_assembly.scad');
assert(existsSync(assembly), 'Assembly: file preview rakitan ada');
const asm = renderPart(assembly);
const ab = bboxOf(asm);
assert(Math.abs(ab.w - 58) <= 1.5, `Assembly: lebar rakitan ${ab.w.toFixed(1)} mm = case tertutup`);
assert(Math.abs(ab.d - 44) <= 1.5, `Assembly: kedalaman rakitan ${ab.d.toFixed(1)} mm = 44`);
assert(Math.abs(ab.h - 66) <= 1.5, `Assembly: tinggi rakitan ${ab.h.toFixed(1)} mm = 66`);

const README = readFileSync(path.join(caseDir, 'README.md'), 'utf-8');
assert(README.includes('Daftar Belanja'), 'README: memuat daftar belanja');
assert(README.includes('Panduan Cetak'), 'README: memuat panduan cetak');
assert(README.includes('M2.5'), 'README: menyebut ukuran sekrup');
assert(README.includes('bezel_096'), 'README: menjelaskan varian bezel 0,96 inci');
assert(README.includes('ukur'), 'README: memuat tabel ukur sebelum cetak');
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node dashboard/tests/verify-case-geometry.mjs`
Expected: FAIL pada assertion `Assembly:`.

- [ ] **Step 3: Implementasikan preview rakitan**

`mewbot_case_assembly.scad` meng-`use` ketiga file part, menampilkan cangkang depan + belakang pada posisinya (tanpa sekrup), dan `bezel_130` di kantongnya. Sediakan `VIEW_MODE = "CLOSED" | "EXPLODED"`.

- [ ] **Step 4: Lengkapi README**

Isi `hardware/case/README.md`:
- Daftar part + waktu cetak perkiraan.
- **Daftar Belanja**: 4× sekrup M2.5×10, 4× sekrup M2×5 (OLED), 1× Li-Po 500 mAh, 1× TP4056 USB-C, 1× SS12D, kabel AWG26, busa tipis.
- **Panduan Cetak**: orientasi tiap part, layer 0,2 mm, 3 perimeter, infill 20%, tanpa support untuk cangkang; suhu PLA 205 °C.
- **Tabel ukur sebelum cetak** (dari §9 spec) dengan nama variabel OpenSCAD yang harus disesuaikan.
- Cara memilih varian bezel dan memasang `oled_shim`.

- [ ] **Step 5: Jalankan seluruh suite**

Run: `Get-ChildItem "dashboard\tests\verify-*.mjs" | ForEach-Object { node $_.FullName }`
Expected: semua exit 0, termasuk `verify-ota.mjs` dan `verify-case-geometry.mjs`.

- [ ] **Step 6: Commit**

```bash
git add hardware/case dashboard/tests/verify-case-geometry.mjs
git commit -m "feat(case): assembly preview, print guide, and bill of materials"
```
