# Desain: Redesain Dashboard Netral + Template Pesan yang Bisa Diedit

Tanggal: 2026-11-18
Status: revisi 2 — disetujui, siap direncanakan
Menggantikan: revisi 1 (menganggap firmware di luar cakupan — keliru)

## 1. Kenapa

Dashboard MewBot dibingkai sebagai aplikasi surat cinta: halaman `/love-mail` berjudul
"Love Mail Studio", arsip "Message Memories", template "Quick Love Notes", ikon hati
di mana-mana, aksen rose/pink. **Layar OLED perangkat pun menulis "LOVE MAIL"** setiap
kali pesan masuk.

Pemilik menginginkan pembingkaian itu hilang dari web **dan** dari alat. Fiturnya sendiri
— mengirim pesan pendek yang tampil di layar OLED — tetap dipertahankan.

Selain itu, template pesan saat ini **hanya bisa ditambah**, tidak bisa diubah atau dihapus.

## 2. Sasaran

- Tidak ada kata "love"/"cinta"/"sayang" maupun ikon hati di antarmuka **dan di layar OLED**.
- Fitur kirim pesan, riwayat pesan, dan template tetap berfungsi seperti sekarang.
- Template bisa **ditambah, diubah, dihapus** dari UI.
- Data lama (pesan & template) tidak hilang.

## 3. Bukan sasaran

- Mengubah mekanisme pengiriman, antrean FIFO, atau batas 80 karakter.
- Mengubah protokol perangkat atau format payload.
- Mengganti nama fungsi database internal (`enqueue_love_mail`, `claim_next_love_mail`).
- Mengubah skema kolom tabel (hanya nilai kategori yang berubah).
- Menulis ulang `docs/CHANGELOG.md` secara historis — riwayat tetap apa adanya, entri
  baru ditambahkan di atas.

## 4. Anti-sasaran (dianggap gagal walau berfungsi)

- Pesan lama di database menjadi tidak terbaca setelah migrasi.
- Template lama hilang atau kategorinya tidak terpetakan.
- Bookmark / shortcut PWA ke `/love-mail` berakhir 404.
- Alur pesan rusak karena ikut mengganti nama fungsi database atau kunci payload.
- Tombol Hapus tanpa konfirmasi.
- Tombol hapus / status error kehilangan warna bahaya sehingga terlihat seperti aksi biasa.

## 5. Keputusan yang sudah diambil

### 5.1 Pendekatan

| Arah | Isi | Keputusan |
|---|---|---|
| **A. Netral** | Pertahankan fitur, ganti seluruh pembingkaian | **Dipilih** — fungsi teruji utuh, skema tidak berubah struktural |
| B. Catatan pribadi | Bingkai sebagai memo pribadi | Terlalu sempit |
| C. Hapus fiturnya | Hapus ketiga halaman | Menghilangkan fungsi utama alat |

### 5.2 Istilah

| Sekarang | Menjadi |
|---|---|
| Love Mail | Pesan |
| Love Mail Studio | Kirim Pesan |
| Tulis Surat Cinta | Tulis Pesan |
| Riwayat Love Mail Terkini | Riwayat Pesan Terkini |
| Message Memories | Riwayat Pesan |
| Quick Love Notes | Template Pesan |
| Pesan cinta / surat cinta | Pesan |
| Menerima Pesan Love Mail | Menerima Pesan |
| Private Companion & Love Mail Portal | Portal Dashboard MewBot |

### 5.3 Layar OLED perangkat ikut diubah

`display_manager.cpp` baris 217 dan 220 mencetak `"LOVE MAIL [%d/%d]"` dan
`"LOVE MAIL (15s)"`. Keduanya diganti menjadi `"PESAN [%d/%d]"` dan `"PESAN (15s)"`.

Konsekuensi: **firmware naik ke 1.9.0** dan harus dipasang ke perangkat. Kalau 1.8.0
sudah terpasang lewat USB, pembaruan ke 1.9.0 bisa lewat OTA dari dashboard.

Nama fungsi internal `drawLoveMail` / `getLoveMailPageCount` **tidak diubah** — tidak
terlihat pengguna, dan mengganti namanya menyentuh jalur render yang sudah teruji.

### 5.4 Kategori template

| Lama | Baru |
|---|---|
| `Affection` | `Umum` |
| `Caring` | `Pengingat` |
| `Missing` | `Sapaan` |
| `Encouragement` | `Semangat` |
| `Random` | `Lainnya` |

Migrasi berurutan: **petakan baris lama dulu**, lalu ganti constraint. Kalau dibalik,
`ALTER TABLE` gagal karena baris lama tidak memenuhi aturan baru.

`DEFAULT 'Affection'` pada kolom **dan** fallback `category || 'Affection'` di route POST
harus ikut berubah ke `Umum` dalam migrasi yang sama — kalau tidak, setiap insert yang
tidak menyebut kategori akan gagal setelah constraint diganti.

### 5.5 Halaman dan URL

`/love-mail` → `/pesan`, dengan redirect permanen agar bookmark dan shortcut PWA lama
tetap hidup. `/memories` dan `/notes` tidak berubah alamat.

### 5.6 Template bisa diedit

- `PATCH /api/dashboard/templates` — ubah `title`/`body`/`category` berdasarkan `id`.
- `DELETE /api/dashboard/templates?id=...` — hapus berdasarkan `id`.
- Validasi sama dengan `POST`: judul & isi wajib, isi ≤ 80 karakter, kategori harus salah
  satu nilai baru.
- **Hak akses: semua pengguna yang login boleh mengubah dan menghapus semua template.**
  Alasannya: tabel `message_templates` tidak punya `device_id` dan route memakai service
  role yang melewati RLS, jadi pembatasan per-pembuat akan membuat template yatim
  (`created_by` di-set NULL saat akun dihapus) tidak bisa diubah siapa pun. Pengamannya
  adalah modal konfirmasi sebelum hapus.

### 5.7 Template contoh bisa disimpan

Saat tabel kosong, `GET` mengembalikan 5 template contoh tanpa `id`. Tiap contoh
mendapat tombol **Simpan sebagai template** yang memanggil `POST` biasa; setelah tersimpan
ia menjadi baris nyata dan bisa diedit/dihapus seperti template lain.

### 5.8 Warna bahaya dipisah dari aksen romantis

`rose-*` saat ini merangkap dua peran: aksen romantis **dan** warna bahaya (tombol Hapus,
banner error, modal konfirmasi, ~30 pemakaian di 7 file).

Aturan:

- `rose-*` yang **dekoratif/romantis** → dibuang, diganti `#466743` / `#5e6b5f`.
- `rose-*` yang menandakan **bahaya** → dipindah ke `red-*` (tetap merah, makna terjaga).
- Token `--accent-rose` / `--accent-rose-subtle` di `globals.css` dihapus bila tidak
  terpakai lagi setelah penggantian.

### 5.9 Ikon

| Sekarang | Menjadi |
|---|---|
| `MessageSquareHeart` | `MessageSquare` |
| `Heart` (navigasi, login) | `Inbox` |
| `Sparkles` (template) | `LayoutTemplate` |

Pemeriksaan `Heart` harus memakai batas kata, karena ada kata "Heartbeat" di komentar
`overview/route.ts:52`.

### 5.10 Manifest PWA

`layout.tsx:13` menunjuk `/manifest.json` **statis** di `public/`, bukan
`src/app/manifest.ts` (yang tidak dirujuk siapa pun). File statis itulah yang sampai ke
PWA terpasang, jadi:

- `description`, nama shortcut, dan `short_name` di `public/manifest.json` diperbarui.
- Shortcut `url` diarahkan ke `/pesan`.
- `src/app/manifest.ts` **dihapus** karena menyesatkan: mengeditnya tidak berpengaruh apa pun.

### 5.11 Yang sengaja TIDAK diubah

- Fungsi database `enqueue_love_mail` / `claim_next_love_mail`.
- Nama kolom `messages`, `message_templates`, `metadata.message_id`.
- Nama fungsi firmware `drawLoveMail` / `getLoveMailPageCount`.
- Isi `docs/CHANGELOG.md` untuk versi lama (riwayat tidak ditulis ulang).

## 6. Yang diserahkan ke pelaksana

- Susunan kartu template dan ukuran tombol.
- Teks placeholder form.
- Nama komponen React baru.
- Apakah redirect `/love-mail` lewat `next.config` atau `redirect()` di route.

## 7. Batasan teknis

- Batas isi pesan **80 karakter**; batas antrean **10 pesan**.
- `activity_events.event_type` tidak bertambah.
- Migrasi **idempoten**.
- Tidak ada emoji kodok; tidak ada emoji 💌.
- Semua teks berbahasa Indonesia.
- `verify-phase7-e2e-integration.mjs` mengunci `/love-mail` dan ikon hati — diperbarui
  bersamaan, bukan dihapus.
- Jumlah assertion saat ini **160** di 9 suite.

## 8. Verifikasi

- Suite baru `verify-neutral-wording.mjs`:
  - tidak ada `Love Mail`, `cinta`, `sayang`, `MessageSquareHeart`, `Heart` (batas kata),
    atau `rose-` dekoratif di `dashboard/src`;
  - `/pesan` ada, `/love-mail` ter-redirect;
  - `public/manifest.json` tidak memuat "Love";
  - `display_manager.cpp` mencetak `PESAN`, bukan `LOVE MAIL`;
  - API template punya `PATCH` dan `DELETE`;
  - halaman template memuat tombol Edit, Hapus, dan modal konfirmasi.
- Migrasi diperiksa memetakan kelima kategori lama **sebelum** mengganti constraint,
  dan `DEFAULT`/fallback ikut menjadi `Umum`.
- Seluruh suite lama tetap hijau (160 assertion).
- `arduino-cli compile` untuk firmware 1.9.0.
- `npx tsc --noEmit` dan `npm run build` bersih.
