#!/usr/bin/env node
/**
 * MewBot — Generator Manifest Firmware
 *
 * Memindai `dashboard/public/firmware/` untuk file `mewbot-<versi>.bin`,
 * menghitung SHA-256 dan ukurannya, lalu menulis `manifest.json` di folder
 * yang sama. Manifest inilah yang dibaca halaman Settings supaya pemilik
 * tidak perlu menyalin hash secara manual (salah ketik hash = OTA gagal).
 *
 * Jalankan dari folder `dashboard`:
 *   npm run firmware:manifest
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const FIRMWARE_PATTERN = /^mewbot-(\d+\.\d+\.\d+)\.bin$/;

function compareVersionDesc(a, b) {
  const partA = a.split('.').map(Number);
  const partB = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (partA[i] !== partB[i]) return partB[i] - partA[i];
  }
  return 0;
}

/**
 * @param {string} firmwareDir direktori berisi file .bin
 * @returns {{ generated_at: string, firmware: Array<{version: string, file: string, url: string, sha256: string, size: number}> }}
 */
export function buildManifest(firmwareDir) {
  const firmware = readdirSync(firmwareDir)
    .map((file) => {
      const match = file.match(FIRMWARE_PATTERN);
      if (!match) return null;

      const buffer = readFileSync(path.join(firmwareDir, file));
      return {
        version: match[1],
        file,
        url: `/firmware/${file}`,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        size: buffer.length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => compareVersionDesc(a.version, b.version));

  return { generated_at: new Date().toISOString(), firmware };
}

/**
 * @param {string} firmwareDir
 * @param {string} manifestPath
 */
export function writeManifest(firmwareDir, manifestPath) {
  const manifest = buildManifest(firmwareDir);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const dir = path.join(process.cwd(), 'public', 'firmware');
  mkdirSync(dir, { recursive: true });
  const manifest = writeManifest(dir, path.join(dir, 'manifest.json'));

  console.log(`[MANIFEST] ${manifest.firmware.length} build tercatat di public/firmware/manifest.json`);
  for (const fw of manifest.firmware) {
    console.log(`  - v${fw.version}  ${(fw.size / 1024).toFixed(0)} KB  sha256 ${fw.sha256.slice(0, 12)}...`);
  }
}
