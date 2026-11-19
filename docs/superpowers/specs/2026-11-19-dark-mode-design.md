# Mode Gelap MewBot — Desain

Tanggal: 2026-11-19
Status: menunggu persetujuan
Cakupan: seluruh dashboard, sistem token warna, satu tombol di header

---

## 1. Maksud

Pemilik ingin dashboard bisa digelapkan. Syarat utamanya: **tampilan terang
yang sekarang tidak boleh berubah sama sekali** — versi terang sudah disetujui
dan dipakai.

Yang menghalangi bukan selera, tapi struktur kode. Warnanya ditulis manual di
setiap elemen:

| Ukuran | Nilai |
|---|---|
| Pemakaian warna langsung di `src` | 703 |
| Nilai warna **berbeda** | 81 (22 hex + 59 kelas palet) |
| Pemakaian `bg-white` | 46 |
| Pemakaian utilitas palet (`emerald-`, `amber-`, `red-`, `slate-`, …) | 279 |
| `darkMode` di `tailwind.config.ts` | belum ada |

Artinya: tanpa mengangkat warna jadi token, mode gelap hanya bisa dibuat dengan
menulis ulang 703 titik satu per satu — dan setiap titik adalah peluang tampilan
terang berubah tanpa sengaja.

Satu hal yang perlu ditegaskan di awal, karena menentukan seluruh bentuk
pekerjaan: **"tampilan terang tidak berubah" dan "palet disederhanakan jadi enam
token" tidak bisa keduanya benar.** Palet sekarang memakai 59 kombinasi warna
berbeda; menyatukannya menjadi enam pasti mengubah terang. Yang saya pilih:
terang menang. Setiap nilai terang mendapat token sendiri, sehingga render terang
identik byte demi byte, dan mode gelap hanya menimpa token itu.

---

## 2. Sasaran dan Batas

**Sasaran**
- Mode gelap hangat (bukan hitam pekat) untuk seluruh 7 halaman + login.
- Tombol di header, pilihan diingat browser.
- Tampilan terang **byte-identik** dengan yang sekarang.
- Nol dependensi baru, nol font unduhan.
- Tidak ada kedipan putih saat halaman dimuat dalam mode gelap.

**Bukan sasaran**
- Tidak mengubah tata letak, teks, alur, API, atau rute.
- Tidak menyentuh firmware atau Supabase.
- Tidak membuat mode gelap otomatis mengikuti OS (dipilih manual oleh pemilik).

**Anti-sasaran**
- Latar hitam pekat `#000` — aksen olive jadi tidak terbaca.
- Tombol tema yang menyebabkan *flash of wrong theme* saat refresh.
- Warna gelap yang "kira-kira mirip" tapi gagal kontras.
- Mengubah tampilan terang, sekecil apa pun.

---

## 3. Pendekatan

Tiga cara dipertimbangkan:

**A. Token CSS variable + kelas `dark` di `<html>`** — 22 warna diangkat jadi
variable, mode gelap hanya menimpa nilai variable. *Dipilih.*

**B. `dark:` di setiap elemen** — menulis `bg-white dark:bg-[#201D17]` di 424
titik. Tidak perlu mengangkat token, tapi menggandakan setiap baris styling,
sulit dirawat, dan hampir pasti ada titik yang terlewat.

**C. Filter CSS `invert()`** — satu baris, seluruh halaman terbalik. Murah, tapi
fotonya kodok jadi negatif, olive jadi magenta, dan tidak ada kontrol.

B tidak dipilih karena 424 titik × 2 = 848 deklarasi warna yang harus
diverifikasi manual. C tidak dipilih karena merusak gambar dan identitas warna.

---

## 4. Sistem Token

### 4.1 Cara kerja

`globals.css` mendefinisikan 22 token. Mode terang memakai nilai **persis**
seperti hex yang digantikan, sehingga hasil render tidak berubah. Mode gelap
menimpa token yang sama di bawah selektor `.dark`.

```css
:root {
  --bg-primary: #fcfbf7;   /* sama persis dengan hex lama */
  --text-main:  #1e241f;
  /* … 20 lainnya */
}

.dark {
  --bg-primary: #16140F;   /* hangat, bukan hitam */
  --text-main:  #EFEAE0;
  /* … */
}
```

Halaman memakai `bg-[var(--bg-primary)]` atau kelas Tailwind yang dipetakan ke
variable — bukan nilai hex.

### 4.2 Token permukaan dan teks

Setiap token terang memakai nilai **persis** seperti hex yang digantikan.
`#cbdbca` (21 pemakaian, garis chip olive) dan `#d8ceba` (nol pemakaian) sempat
tertukar di draf awal; yang benar ada di tabel ini.

| Token | Terang (tidak berubah) | Gelap | Dipakai untuk |
|---|---|---|---|
| `--bg-primary` | `#fcfbf7` | `#16140F` | Latar halaman |
| `--bg-surface` | `#ffffff` | `#201D17` | Kartu, panel, modal |
| `--bg-surface-subtle` | `#f6f3eb` | `#2A2620` | Input, track, area tenggelam |
| `--bg-raised` | `#ffffff` | `#2E2921` | Item terpilih di atas track (lihat 4.5) |
| `--border-subtle` | `#eae4d5` | `#332E26` | Garis pemisah |
| `--border-chip` | `#cbdbca` | `#3C4A38` | Garis chip olive (21 pemakaian) |
| `--text-main` | `#1e241f` | `#EFEAE0` | Teks utama |
| `--text-muted` | `#5e6b5f` | `#A8A092` | Teks sekunder |
| `--text-dim` | `#8b998c` | `#928A7B` | Teks tersier, ikon redup |
| `--text-on-dark` | `#ffffff` | `#EFEAE0` | Teks di atas latar gelap apa pun |
| `--olive-primary` | `#466743` | `#8FB08A` | Aksi utama, tautan |
| `--olive-hover` | `#385336` | `#A3C29E` | Hover aksi utama |
| `--olive-subtle` | `#eef4ea` | `#2A3527` | Chip/badge olive |
| `--olive-deep` | `#273826` | `#D6E3D2` | Teks di atas chip olive |
| `--olive-accent` | `#5a8257` | `#9BBE96` | Ikon aksen olive |
| `--on-olive` | `#ffffff` | `#16140F` | Teks di atas tombol olive solid |

### 4.2a Sisa 11 nilai hex

Sebelas nilai ini jarang dipakai tapi tetap butuh token agar terang identik:

| Nilai | Pemakaian | Token | Gelap |
|---|---|---|---|
| `#556b2f` | 6 (login) | `--legacy-olive` | `#8FB08A` |
| `#6b756a` | 1 (nav) | `--nav-idle` | `#A8A092` |
| `#7d8c7e` | 1 (nav) | `--nav-idle-mobile` | `#A8A092` |
| `#b8cfb7` | 1 (PWA) | `--pwa-chip-border` | `#3C4A38` |
| `#385435` | 1 (PWA) | `--pwa-btn-hover` | `#A3C29E` |
| `#465826` | 1 (login) | `--login-btn-hover` | `#A3C29E` |
| `#e2e8f0` | 1 (login) | `--login-card-border` | `#332E26` |
| `#4b5563` | 1 (timeline) | `--timeline-body` | `#A8A092` |
| `#fdfbf7` | 1 (login) | `--login-canvas` | `#16140F` |
| `#ffffff` (alpha) | 3 | `--scrim` | tetap `rgb(0 0 0 / .4)` |
| `#556b2f` (alpha) | 2 | `--legacy-olive-soft` | `rgb(143 176 138 / .12)` |

Nilai ber-opacity (`bg-[#556b2f]/10`, `bg-[#eef4ea]/80`, `bg-[#ffffff]/90`,
`bg-white/50`, `bg-white/95`, `bg-black/40`, `ring-[#466743]/15`) menjadi token
`rgb()` utuh, bukan hex + modifier. Terang memakai angka RGB yang sama persis,
sehingga hasilnya identik.

### 4.3 Warna status: satu token per nilai, bukan per peran

Draf awal menyebut enam token status. Itu mustahil tanpa mengubah terang: palet
sekarang memakai **59 kombinasi** berbeda (mis. `amber-50/200/300/400/500/600/700/800/900`).
Karena itu aturannya berubah:

- Setiap kombinasi `warna-shade` yang dipakai mendapat token sendiri, diberi nama
  menurut peran **dan** shade: `--amber-50`, `--amber-200`, … `--amber-900`.
- Nilai terangnya persis nilai Tailwind (mis. `--amber-600: #d97706`).
- Nilai gelapnya dipilih per keluarga, bukan per shade: `--amber-50` → `#3A2E1B`,
  `--amber-200` → `#4A3B22`, `--amber-600` → `#D9A45B`, `--amber-700` → `#E5B36F`,
  `--amber-900` → `#F0D9B0`. Shade muda menjadi latar, shade tua menjadi teks.
- Pola sama untuk `emerald`, `red`, `slate`, `gray`, `blue`, `purple`, `teal`,
  `orange`. Pemetaan lengkap 59 pasangan ada di rencana.

**Konsekuensi yang harus diterima:** mode gelap memakai 59 token tambahan. Ini
bukan pemborosan — ini harga dari syarat "terang tidak berubah". Alternatifnya
(menyederhanakan palet) mengubah terang.

### 4.4 Pengecualian: pratinjau OLED

`.oled-screen-preview` di `/pesan` adalah **simulasi layar perangkat fisik** —
warnanya harus tetap sama di kedua mode, karena perangkat kerasnya tidak punya
mode gelap. Seluruh isinya (`text-emerald-300/400`, `bg-emerald-950/80`,
`border-emerald-900/60`, `border-emerald-800/40`) dikecualikan dari tokenisasi
dan dari tes "tidak ada kelas palet".

Alasan: kalau ikut ditokenkan, layar OLED palsu akan berubah warna saat mode
gelap menyala — padahal layar aslinya tidak. Ini satu-satunya pengecualian, dan
tes memeriksanya secara eksplisit agar tidak melebar.

### 4.5 Item terpilih di atas track

`bg-white` dipakai untuk dua hal berbeda: kartu, dan **item terpilih di atas
track berwarna**. Di mode terang keduanya sama-sama putih. Di mode gelap
`--bg-surface` (`#201D17`) lebih gelap dari `--bg-surface-subtle` (`#2A2620`),
sehingga item terpilih justru terlihat tenggelam — kebalikan dari maksudnya.

Karena itu ada token keempat: `--bg-raised`. Terang `#ffffff` (identik), gelap
`#2E2921` — lebih terang dari track `#2A2620`. Selisihnya hanya 1.04:1, jadi
warna saja tidak cukup: item terpilih **juga** diberi `font-semibold` dan garis
`--border-chip`, sehingga keadaannya terbaca tanpa bergantung rona.

Dipakai di: pil nav desktop, nav ponsel, dan segmented control PET/CLOCK.

### 4.6 `--text-dim` dipakai sebagai teks isi

Di kode sekarang `#8b998c` dipakai untuk paragraf kecil di 8 tempat (mis.
"Event akan muncul otomatis saat MewBot menerima pesan…"). Kontrasnya di terang
hanya 2.9:1 — sudah di bawah AA sebelum perubahan ini.

Keputusan: **nilai terangnya tidak diubah** (syarat utama), tetapi nilai
gelapnya dinaikkan ke `#928A7B` sehingga 4.9:1 di `--bg-surface`. Tes hanya
menolak pemakaian `--text-dim` untuk teks **baru**; paragraf lama dibiarkan dan
dicatat sebagai utang kontras terang yang sudah ada sebelumnya.

### 4.7 Kontras terukur (mode gelap)

| Pasangan | Rasio | Ambang |
|---|---|---|
| `--text-main` / `--bg-primary` | 15.4:1 | 4.5 |
| `--text-main` / `--bg-surface` | 14.0:1 | 4.5 |
| `--text-muted` / `--bg-surface` | 6.5:1 | 4.5 |
| `--text-muted` / `--bg-primary` | 7.1:1 | 4.5 |
| `--text-dim` / `--bg-surface` | 4.9:1 | 4.5 |
| `--olive-primary` / `--bg-surface` | 7.0:1 | 4.5 |
| `--olive-primary` / `--olive-subtle` | 5.3:1 | 4.5 |
| `--amber-600` / `--bg-surface` | 7.5:1 | 4.5 |
| `--amber-600` / `--amber-50` | 5.9:1 | 4.5 |
| `--emerald-600` / `--bg-surface` | 7.2:1 | 4.5 |
| `--red-600` / `--bg-surface` | 6.2:1 | 4.5 |
| `--red-600` / `--red-50` | 5.4:1 | 4.5 |
| `--blue-600` / `--bg-surface` | 7.6:1 | 4.5 |
| `--on-olive` / `--olive-primary` | 7.7:1 | 4.5 |
| `--on-danger` / `--red-600` | 6.8:1 | 4.5 |

### 4.8 Tombol destruktif

Tombol `bg-red-600 text-white` (2 tempat) di mode gelap menjadi `--red-600`
(`#E88078`) dengan teks `--on-danger` (`#16140F`) = 6.8:1. Kalau teksnya tetap
putih, kontrasnya 2.7:1 dan gagal. Ini simetris dengan keputusan `--on-olive`.
Nilai terang `#dc2626` + putih (4.83:1) tidak berubah.

---

## 5. Tombol Tema

### 5.1 Perilaku
- Satu tombol ikon di header, di antara indikator WIB dan menu pengguna.
- Ikon matahari saat mode terang, bulan saat gelap.
- Klik menukar mode dan menyimpan pilihan di `localStorage`.
- `aria-label` menyebut aksi berikutnya ("Aktifkan mode gelap" / "Aktifkan mode terang"), bukan keadaan sekarang.
- Target sentuh ≥44px.

### 5.2 Tanpa kedipan saat muat
Skrip kecil di `<head>` (inline, sebelum `<body>`) membaca `localStorage` dan
menambahkan kelas `dark` ke `<html>` sebelum halaman digambar. Tanpa ini, halaman
sempat tampil terang lalu berkedip gelap.

Karena skrip itu jalan sebelum React, tidak ada ketergantungan pada hidrasi.
Komponen tombol membaca keadaan awal dari `document.documentElement.classList`.

### 5.3 Warna browser
`viewport.themeColor` diberi dua nilai lewat `media` (`prefers-color-scheme`),
tetapi karena mode dipilih manual — bukan mengikuti OS — dua nilai itu tidak
cukup. Solusinya: skrip tema di §5.2 juga memperbarui `<meta name="theme-color">`
saat tombol diklik. `manifest.json` tetap satu nilai `#fcfbf7`, karena PWA
dibuka dari layar utama dan tidak membaca mode aplikasi.

---

## 6. Yang Tidak Berubah

Dijaga oleh tes, bukan ingatan:

- Setiap token terang memakai nilai hex **persis** seperti sebelumnya.
- Tidak ada elemen yang berubah ukuran, jarak, atau susunan.
- Semua teks, label, dan alur tetap.
- Rute, API, dan perilaku tetap.
- Logo kodok: PNG transparan, jadi tetap terbaca di latar gelap tanpa aset baru.

---

## 7. Verifikasi

1. `dashboard/tests/verify-theme-tokens.mjs` (baru) — setiap token terang cocok
   dengan nilai lama; setiap token punya pasangan gelap; 15 pasangan kontras gelap
   lulus; tidak ada warna langsung di `src` kecuali pratinjau OLED yang
   dikecualikan secara eksplisit.
2. Seluruh `verify-*.mjs` lama — lulus tanpa perubahan perilaku.
3. `tsc --noEmit` dan `npm run build` — bersih.
4. Tangkapan layar 7 halaman × 2 mode × 2 lebar (375px, 1280px).
5. Pemeriksaan manual: refresh dalam mode gelap tidak berkedip; pilihan bertahan
   setelah tab ditutup; tombol tema tidak muncul di halaman login; pratinjau OLED
   identik di kedua mode.
6. Pemeriksaan keyboard: tombol tema dapat dijangkau Tab, `aria-label` terbaca,
   dan item terpilih di segmented control terbaca tanpa bergantung warna.
7. Perbandingan piksel mode terang sebelum vs sesudah perubahan: harus nol
   perbedaan pada 7 halaman.

---

## 8. Keputusan yang Saya Ambil

| Pertanyaan | Keputusan | Alasan |
|---|---|---|
| Gelap otomatis atau manual | Manual, tombol di header | Pemilik memilih manual |
| Seberapa gelap | `#16140F` hangat, bukan hitam | Aksen olive tetap terbaca; nyaman malam |
| Cara teknis | Token CSS variable + kelas `.dark` | Satu titik ubah; terang bisa diverifikasi identik |
| Terang identik vs palet sederhana | Terang menang: satu token per nilai (81 token) | Syarat utama pemilik; menyederhanakan palet mengubah terang |
| Tombol di login | Tidak ditampilkan | Login tanpa chrome, sesuai keputusan sebelumnya |
| Pratinjau OLED | Dikecualikan dari tokenisasi | Simulasi perangkat fisik; layarnya tidak punya mode gelap |
| `--text-dim` sebagai teks | Nilai terang dibiarkan, gelap dinaikkan ke 4.9:1 | Kontras terang 2.9:1 adalah utang lama; memperbaikinya berarti mengubah terang |
| Item terpilih di track | Token `--bg-raised` + `font-semibold` + garis | Warna saja hanya 1.04:1 di gelap |
| Tombol destruktif di gelap | `--red-600` + teks `--on-danger` | Putih di atas `#E88078` hanya 2.7:1 |
| `themeColor` | Diperbarui oleh skrip tema saat klik | Mode manual, bukan ikut OS |

---

## 9. Ukuran Pekerjaan

Ini **bukan perubahan kecil**. Angka sebenarnya:

- 81 token baru (22 hex + 59 kombinasi palet), masing-masing butuh nilai terang dan gelap.
- 703 pemakaian warna di 13 file harus diganti ke token.
- 59 pasangan warna gelap harus dipilih dan diuji kontrasnya.
- 7 halaman × 2 mode harus diperiksa visual.

Perkiraan: 8–11 tugas, sebagian besar mekanis tapi menyentuh hampir setiap baris
styling di aplikasi.

Yang membuat ini layak dikerjakan dengan cara ini: setiap langkah punya tes yang
membuktikan terang tidak berubah. Jadi kalau ada yang salah, ketahuan saat itu
juga, bukan setelah semuanya selesai.

---

## 10. Yang Diserahkan ke Pelaksana

- Nama kelas Tailwind dan struktur file komponen tombol.
- Urutan pengerjaan halaman.
- Apakah token diletakkan langsung di `globals.css` atau juga sebagai preset
  Tailwind, asalkan halaman tidak menulis warna langsung.
- Nilai tepat padding ikon tombol, selama target sentuh ≥44px.
