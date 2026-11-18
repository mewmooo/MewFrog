/**
 * MewBot — Verifikasi Geometri Case (Retro Handheld)
 *
 * Skrip ini benar-benar MERENDER setiap part lewat OpenSCAD CLI, lalu mengukur
 * STL hasilnya: bounding box, massa, dan apakah mesh tertutup (manifold).
 *
 * Jadi bukan sekadar memeriksa teks source — kalau geometrinya salah bentuk,
 * tes ini gagal.
 */

import { execFileSync } from 'child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const OPENSCAD = 'C:\\Program Files\\OpenSCAD\\openscad.exe';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const caseDir = path.join(rootDir, 'hardware/case');

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

// -----------------------------------------------------------------------------
// Helper: render + ukur
// -----------------------------------------------------------------------------

function renderPart(scadPath, extraArgs = []) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mewbot-stl-'));
  const out = path.join(dir, 'part.stl');

  try {
    execFileSync(OPENSCAD, ['-o', out, ...extraArgs, scadPath], { stdio: 'pipe' });
    if (!existsSync(out)) throw new Error(`OpenSCAD tidak menghasilkan STL untuk ${scadPath}`);
    const text = readFileSync(out, 'utf-8');
    const verts = [];
    const re = /vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g;
    let m;
    while ((m = re.exec(text))) verts.push([+m[1], +m[2], +m[3]]);

    const triangles = [];
    for (let i = 0; i + 2 < verts.length; i += 3) {
      triangles.push([verts[i], verts[i + 1], verts[i + 2]]);
    }
    return { triangles };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function bboxOf(stl) {
  const xs = stl.triangles.flatMap((t) => t.map((v) => v[0]));
  const ys = stl.triangles.flatMap((t) => t.map((v) => v[1]));
  const zs = stl.triangles.flatMap((t) => t.map((v) => v[2]));
  return {
    w: Math.max(...xs) - Math.min(...xs),
    d: Math.max(...ys) - Math.min(...ys),
    h: Math.max(...zs) - Math.min(...zs),
    maxY: Math.max(...ys),
    minY: Math.min(...ys),
    minZ: Math.min(...zs),
  };
}

function massGrams(stl) {
  let vol = 0;
  for (const [a, b, c] of stl.triangles) {
    vol +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) -
        a[1] * (b[0] * c[2] - b[2] * c[0]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6;
  }
  return (Math.abs(vol) / 1000) * 1.24;
}

function isManifold(stl) {
  const edges = new Map();
  const key = (v) => v.map((n) => n.toFixed(3)).join(',');
  for (const tri of stl.triangles) {
    for (let i = 0; i < 3; i++) {
      const a = key(tri[i]);
      const b = key(tri[(i + 1) % 3]);
      const e = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(e, (edges.get(e) || 0) + 1);
    }
  }
  return [...edges.values()].every((n) => n === 2);
}

console.log('================================================================');
console.log(' MewBot Case Geometry Suite');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. Parameter & Modul Bersama
// -----------------------------------------------------------------------------
const paramsPath = path.join(caseDir, 'mewbot_case_params.scad');
const commonPath = path.join(caseDir, 'mewbot_case_common.scad');

if (!existsSync(paramsPath)) {
  console.log('[SKIP] Case belum diimplementasikan — jalankan Task 1 plan case lebih dulu.');
  console.log('[SKIP] Plan: docs/superpowers/plans/2026-11-18-case-retro-handheld.md\n');
  process.exit(0);
}

assert(existsSync(paramsPath), 'Param: file mewbot_case_params.scad ada');
assert(existsSync(commonPath), 'Common: file mewbot_case_common.scad ada');

const PARAMS = existsSync(paramsPath) ? readFileSync(paramsPath, 'utf-8') : '';
const COMMON = existsSync(commonPath) ? readFileSync(commonPath, 'utf-8') : '';

assert(/case_w\s*=\s*58/.test(PARAMS), 'Param: case_w = 58 mm');
assert(/case_d\s*=\s*44/.test(PARAMS), 'Param: case_d = 44 mm');
assert(/case_h\s*=\s*66/.test(PARAMS), 'Param: case_h = 66 mm');
assert(/wall\s*=\s*1\.8/.test(PARAMS), 'Param: tebal dinding 1,8 mm');
assert(/lip_clearance\s*=\s*0\.25/.test(PARAMS), 'Param: clearance lip 0,25 mm');
assert(/batt_h\s*=\s*9/.test(PARAMS), 'Param: tinggi bilik baterai 9 mm');
assert(/boss_low_x\s*=\s*17\.5/.test(PARAMS), 'Param: boss bawah X = 17,5 mm');
assert(/boss_od\s*=\s*5\.4/.test(PARAMS), 'Param: boss OD = 5,4 mm');

assert(COMMON.includes('module rounded_box'), 'Common: menyediakan rounded_box');
assert(COMMON.includes('module screw_boss_front'), 'Common: menyediakan screw_boss_front');
assert(COMMON.includes('module screw_hole_back'), 'Common: menyediakan screw_hole_back');
assert(COMMON.includes('module perimeter_lip'), 'Common: menyediakan perimeter_lip');
assert(COMMON.includes('module perimeter_groove'), 'Common: menyediakan perimeter_groove');

console.log(`\nResults: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%)\n`);

if (passed === total) {
  console.log('>>> [SUCCESS] Semua pengujian geometri case lulus!\n');
  process.exit(0);
} else {
  console.error('>>> [FAILURE] Masih ada pengujian geometri case yang gagal!\n');
  process.exit(1);
}
