# Desain: Case MewBot "Retro Handheld dengan Siluet Kodok"

Tanggal: 2026-11-18
Status: revisi 2 — menunggu persetujuan
Pengganti: MewBot Olive Egg (`newfrog/newfrog_local_archive/`, tidak ter-versi git)

## 1. Kenapa

Alat MewBot saat ini hanya berupa papan ESP32-C3 dengan OLED, sensor sentuh, dan ADXL345
yang tergeletak. Belum ada wadah yang membuatnya aman dibawa sekaligus enak dipandang
saat ditaruh di meja.

Desain lama (Olive Egg) ada di folder yang masuk `.gitignore`, jadi tidak ter-versi dan
berisiko hilang. Pemilik memilih bentuk lain karena menginginkan tampilan yang berbeda.

## 2. Sasaran

- Satu wadah yang melindungi elektronika saat dibawa dan tetap terlihat rapi di meja.
- Bagian dalam memuat: ESP32-C3 Super Mini, OLED SH1106 128x64, TTP223, ADXL345,
  Li-Po 500 mAh, TP4056 (USB-C), dan saklar SS12D.
- Dapat dicetak FDM tanpa support pada bagian utama.
- Siluet mengingatkan pada kodok MewBot tanpa tonjolan yang rawan patah.
- **Ukuran OLED yang belum diketahui tidak boleh memaksa cetak ulang cangkang.**

## 3. Bukan sasaran

- Tahan air / tahan debu (IP rating).
- Tombol tambahan di luar sensor sentuh.
- Speaker atau buzzer.
- Desain untuk resin printer.
- Modul kamera, layar warna, atau perluasan lain.

## 4. Anti-sasaran (dianggap gagal walau bentuknya bagus)

- Case yang tidak bisa ditutup rapat setelah elektronika masuk.
- Kabel yang terjepit atau tertekuk melewati batas aman (khususnya kabel baterai Li-Po).
- Layar yang terlihat miring/berbayang karena bezel tidak sejajar.
- Alat yang mudah terbuka sendiri saat dibawa.
- Baterai Li-Po yang bisa bergeser dan tertusuk komponen tajam.
- Bagian yang pecah saat dibuka-tutup lebih dari beberapa kali.
- **Antena Wi-Fi terhalang baterai sehingga jangkauan turun.**

## 5. Keputusan yang sudah diambil

### 5.1 Bentuk: bata membulat dengan siluet kodok di bagian atas

Badan utama kotak membulat (rounded box) karena memberi dua permukaan datar untuk
build plate, kokoh saat dibawa, dan tidak mudah terguling.

Siluet kodok dicapai **tanpa tonjolan**: sudut atas dibuat melebar seperti kepala kodok,
lalu diberi **relief dangkal** (0,8 mm) berbentuk dua mata dan mulut di **punggung atas**.
Relief dicetak sebagai permukaan atas saat mencetak, sehingga tidak butuh support dan
tidak bisa patah.

### 5.2 Empat part cetak, bukan dua

| Part | Fungsi | Kenapa terpisah |
|---|---|---|
| `front_shell` | Muka: jendela layar, kantong TTP223 di mahkota, dudukan ADXL345 | — |
| `back_shell` | Punggung: bilik baterai, braket TP4056 & saklar, rel ESP32, relief kodok, slot lanyard | — |
| `bezel_130` | Keping pixel-art untuk modul 1,3" | Bagian visual, ukuran tergantung layar |
| `bezel_096` | Keping pixel-art untuk modul 0,96" | Idem |
| `oled_shim` | Adaptor PCB kecil (0,96") ke cradle besar | Idem |
| `cradle` | Dudukan meja miring | Bukan bagian case |

**Cara kerja pemisahan ini.** Cangkang depan selalu dibuat untuk modul **besar**
(1,3"): jendela 30,2 × 15,2 mm, boss M2 pitch 30,5 × 29 mm. Kalau modul Anda ternyata
0,96" (PCB ±27 × 27 mm, area aktif ±21,7 × 10,9 mm):

- pasang `oled_shim` supaya PCB kecil bisa masuk cradle besar;
- pasang `bezel_096`, yang lubang dalamnya 23 × 12 mm sehingga menutup celah di sekeliling
  layar kecil.

Yang dicetak ulang hanya keping ±2 gram. Cangkang 40 gram tetap dipakai.

### 5.3 Dudukan meja terpisah

Cradle menambah kemiringan 10°, sehingga total sudut pandang saat didudukkan ±22°
(12° dari dalam case + 10° dari cradle). Saat dibawa, cradle ditinggal.

Cradle menyandarkan case di punggung bawah, **dengan potongan** agar colokan USB-C TP4056
dan saklar tetap bisa diakses — jadi alat bisa diisi daya sambil berdiri di meja.

### 5.4 Parameter yang dipakai

| Parameter | Nilai |
|---|---|
| Dimensi luar | ±58 (W) × 44 (D) × 66 (H) mm |
| Tebal dinding | 1,8 mm |
| Clearance lip | 0,25 mm |
| Lip engagement | 1,4 mm |
| Sekrup | 4× M2.5×10, boss OD 5,4 mm |
| Pilot (cangkang depan) | Ø2,2 mm, kedalaman 7,5 mm |
| Clearance + counterbore (belakang) | Ø2,8 mm / Ø5,2 mm |
| Posisi boss bawah | X = ±17,5 mm, Z = 8 mm |
| Posisi boss atas | X = ±14,8 mm, Z = 46 mm |
| Arah masuk sekrup | dari **belakang**, kepala tersembunyi di counterbore |
| Kemiringan layar | 12° |

Posisi boss mengikuti Olive Egg yang sudah terbukti: pada X = ±17,5 mm boss membentang
14,8–20,2 mm, sedangkan lubang USB-C (X = −6,5) membentang −12…−1 dan slot saklar
(X = +6,5) membentang +2…+11. Tidak ada tabrakan.

### 5.5 Bagian dalam

**Susunan vertikal (penting untuk Wi-Fi).** Baterai di **bawah**, ESP32 di **atas**,
antena menghadap ke atas menjauhi baterai. Jarak antena ke baterai ≥ 10 mm. Baterai
Li-Po adalah logam dan akan meredam 2,4 GHz kalau menempel di antena.

- **Rel ESP32-C3:** dua rel 1,2 mm di dinding punggung atas, membentuk slot selebar
  22,5 mm (PCB Super Mini ±22,5 × 18 mm), dengan stopper bawah. Board ditahan gesekan +
  satu titik lem tembak opsional.
- **Bilik baterai:** 42 × 34 × 9 mm di punggung **bawah**, rel samping + shelf bawah.
  Ukuran ini sengaja longgar: sel 500 mAh berkisar 35–40 × 25–30 × 5–6 mm tergantung
  merek, dan sebagian punya modul proteksi tambahan.
- **Braket TP4056:** di dinding punggung bawah, lubang USB-C **12 × 7 mm** dengan chamfer.
  Dibuat longgar karena tinggi port di atas PCB berbeda antar-board.
- **Saklar SS12D:** slot aktuator 5 × 2,8 mm dengan kantong jari, di samping USB-C.
- **Dudukan ADXL345:** di lantai case, 2 boss M2 pitch 15 mm.
- **Kantong TTP223:** di **mahkota atas cangkang depan** (dahi, bukan tengkuk), ukuran
  15,5 × 11,5 × 2,5 mm, dinding atas 1,3 mm agar sentuhan terbaca dari luar.
  Area ini **tidak** bertabrakan dengan relief kodok karena relief ada di punggung.
- **Jalur kabel:** celah 3 mm di sisi kiri-kanan antar-kompartemen.
- **Slot lanyard:** cekungan 12 × 4 × 3 mm di punggung atas, tembus ke dalam, untuk tali.
  Sengaja cekung, bukan tonjolan, agar tidak patah.

### 5.6 Orientasi cetak

Kedua cangkang dicetak dengan **bidang pertemuan (Y = 0) menghadap build plate**. Ini
memberi permukaan datar terbesar dan membuat lip serta boss sekrup terbentuk tanpa support.

Relief kodok di punggung menghadap **ke atas** selama pencetakan, bukan ke plate. Relief
dangkal 0,8 mm pada permukaan atas tidak butuh support dan hasilnya rapi.

Bezel dicetak rata menghadap plate. Cradle dicetak pada sisi datarnya.

## 6. Yang diserahkan ke pelaksana

- Kurva profil samping (tabel Z) boleh disesuaikan selama dimensi luar, posisi boss sekrup,
  dan tinggi mahkota tidak berubah.
- Bentuk persis relief mata dan mulut kodok bebas, asalkan kedalaman ≤ 0,8 mm dan tidak
  menembus dinding.
- Susunan visual bezel mengikuti gaya pixel-art Olive Egg.
- Nama file dan pembagian modul OpenSCAD.
- Bentuk tepat potongan USB-C pada cradle.

## 7. Batasan teknis yang harus dijaga

- **Dinding minimum 1,8 mm** di seluruh permukaan luar; 1,2 mm untuk rel internal.
- **Tidak ada bagian lebih tipis dari 1,2 mm** agar tidak tembus saat dicetak FDM 0,4 mm.
- **Baterai Li-Po tidak boleh bersentuhan langsung** dengan PCB atau sekrup; jarak ≥ 1 mm.
- **Antena ≥ 10 mm dari baterai**, dan tidak tertutup PCB lain.
- **Parting plane harus planar** (Y = 0).
- **Semua part muat di build plate 220 × 220 mm**, tinggi < 250 mm.
- **Toleransi FDM:** clearance 0,25 mm untuk lip, 0,3 mm untuk lubang pilot.
- Jendela layar (30,2 × 15,2 mm) harus lebih kecil dari area aktif modul 1,3" + 1 mm.

## 8. Verifikasi

- Render STL tiap part dengan OpenSCAD CLI (`openscad -o out.stl file.scad`) tanpa error.
- Estimasi berat tiap part (target total < 75 g PLA).
- Uji kecocokan lip: selisih keliling front vs back harus 0,5 mm (2 × 0,25).
- Cek tabrakan boss sekrup dengan lubang USB-C dan slot saklar pada koordinat di §5.4.
- Cetak `bezel_096` / `bezel_130` lebih dulu (part terkecil) sebelum mencetak cangkang.

## 9. Daftar ukur sebelum cetak final

Angka di §5.5 memakai ukuran nominal + kelonggaran. Sebelum mencetak cangkang, ukur dan
sesuaikan parameter berikut di file OpenSCAD:

| Komponen | Yang diukur | Parameter |
|---|---|---|
| OLED | lebar & tinggi PCB, jarak lubang M2, tebal modul | `oled_pcb_w`, `oled_pcb_h`, `oled_pitch`, `oled_thick` |
| Li-Po 500 mAh | panjang, lebar, tebal, arah keluar kabel | `batt_w`, `batt_d`, `batt_h` |
| TP4056 | tinggi port USB-C di atas tepi PCB, posisi LED | `usbc_offset_z` |
| SS12D | panjang aktuator, jarak pin | `sw_actuator_len` |
| ESP32-C3 | lebar & panjang PCB | `mcu_w`, `mcu_l` |

Kalau angka ini tidak diukur, case tetap bisa dicetak tetapi berisiko "tidak bisa ditutup"
atau "colokan tidak masuk" — dua anti-sasaran di §4.
