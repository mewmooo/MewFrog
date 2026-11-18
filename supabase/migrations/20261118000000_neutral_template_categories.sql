-- ============================================================================
-- MEWBOT — MIGRASI KATEGORI TEMPLATE PESAN KE ISTILAH NETRAL
-- File   : 20261118000000_neutral_template_categories.sql
-- Tujuan : Menghapus pembingkaian romantis dari kategori template pesan.
--
-- URUTAN WAJIB: data lama dipetakan LEBIH DULU, baru constraint diganti.
-- Kalau dibalik, ALTER TABLE akan gagal karena baris lama masih berisi nilai
-- seperti 'Affection' yang tidak memenuhi constraint baru.
--
-- Migrasi ini idempoten: aman dijalankan berkali-kali.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Petakan nilai lama ke nilai baru (sebelum constraint disentuh)
-- ----------------------------------------------------------------------------
UPDATE message_templates
SET category = CASE category
    WHEN 'Affection'     THEN 'Umum'
    WHEN 'Caring'        THEN 'Pengingat'
    WHEN 'Missing'       THEN 'Sapaan'
    WHEN 'Encouragement' THEN 'Semangat'
    WHEN 'Random'        THEN 'Lainnya'
    ELSE category
END
WHERE category IN ('Affection', 'Caring', 'Missing', 'Encouragement', 'Random');

-- ----------------------------------------------------------------------------
-- 2. Ganti constraint & default
--    DEFAULT juga harus ikut berubah, kalau tidak setiap INSERT yang tidak
--    menyebut kategori akan gagal setelah constraint baru terpasang.
-- ----------------------------------------------------------------------------
ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS message_templates_category_check;

ALTER TABLE message_templates ALTER COLUMN category SET DEFAULT 'Umum';

ALTER TABLE message_templates
    ADD CONSTRAINT message_templates_category_check
    CHECK (category IN ('Umum', 'Pengingat', 'Sapaan', 'Semangat', 'Lainnya'));

-- ----------------------------------------------------------------------------
-- 3. Perbarui komentar tabel agar tidak lagi menyebut "Love Notes"
-- ----------------------------------------------------------------------------
COMMENT ON TABLE message_templates IS 'Template pesan siap kirim untuk layar MewBot';
COMMENT ON COLUMN message_templates.category IS 'Kategori template: Umum, Pengingat, Sapaan, Semangat, Lainnya';

COMMIT;
