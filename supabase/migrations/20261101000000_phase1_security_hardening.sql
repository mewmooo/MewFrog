-- ============================================================================
-- MewBot — Skema Database Supabase PostgreSQL: Phase 1 Security Hardening
-- Versi: 1.1.0
-- Fokus: Model Akses Bersama Pasangan (2 Users), RLS Granular, Penguncian search_path,
--        dan Atomic FIFO Queue Claim Lease untuk Keandalan Polling Device
-- ============================================================================

-- 1. Tambahkan kolom dan perbarui constraint pada tabel messages
ALTER TABLE messages 
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Perbarui CHECK constraint status messages agar mencakup status 'claimed'
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_status_check;
ALTER TABLE messages ADD CONSTRAINT messages_status_check 
    CHECK (status IN ('accepted', 'queued', 'claimed', 'received', 'displayed', 'failed'));

-- 2. Tambahkan kolom dan perbarui constraint pada tabel device_commands
ALTER TABLE device_commands 
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

ALTER TABLE device_commands DROP CONSTRAINT IF EXISTS device_commands_status_check;
ALTER TABLE device_commands ADD CONSTRAINT device_commands_status_check 
    CHECK (status IN ('pending', 'claimed', 'accepted', 'applied', 'failed', 'expired'));

-- ============================================================================
-- 3. TABEL: device_members (Model Akses Bersama Pasangan untuk 1 Perangkat)
-- ============================================================================
CREATE TABLE IF NOT EXISTS device_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'partner' CHECK (role IN ('owner', 'partner')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_id, user_id)
);

-- Batasi satu perangkat hanya dapat diakses maksimal oleh 2 akun pengguna (pasangan)
CREATE OR REPLACE FUNCTION check_device_member_limit()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM device_members WHERE device_id = NEW.device_id) >= 2 THEN
        RAISE EXCEPTION 'MewBot hanya dapat dibagikan kepada maksimal 2 akun pengguna (pasangan).';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_device_member_limit ON device_members;
CREATE TRIGGER trg_check_device_member_limit
BEFORE INSERT ON device_members
FOR EACH ROW EXECUTE FUNCTION check_device_member_limit();

-- Index untuk percepatan query keanggotaan
CREATE INDEX IF NOT EXISTS idx_device_members_user 
ON device_members(user_id);

CREATE INDEX IF NOT EXISTS idx_device_members_device 
ON device_members(device_id);

-- ============================================================================
-- 4. FUNGSI UTILITAS KEAMANAN: is_device_member
-- ============================================================================
CREATE OR REPLACE FUNCTION is_device_member(p_device_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE 
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM device_members
        WHERE device_id = p_device_id AND user_id = auth.uid()
    );
END;
$$;

-- ============================================================================
-- 5. REFACTOR FUNGSI ATOMIK: enqueue_love_mail (Hardened search_path & Auth)
-- ============================================================================
CREATE OR REPLACE FUNCTION enqueue_love_mail(
    p_device_id UUID,
    p_body VARCHAR(80),
    p_created_by UUID
) RETURNS messages 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pending_count INTEGER;
    v_new_msg messages;
    v_is_member BOOLEAN;
BEGIN
    -- 1. Validasi hak akses pemanggil jika dijalankan oleh pengguna terotentikasi
    IF auth.uid() IS NOT NULL THEN
        IF auth.uid() != p_created_by THEN
            RAISE EXCEPTION 'Unauthorized: p_created_by tidak cocok dengan auth.uid()';
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM device_members 
            WHERE device_id = p_device_id AND user_id = auth.uid()
        ) INTO v_is_member;

        IF NOT v_is_member THEN
            RAISE EXCEPTION 'Forbidden: Pengguna bukan anggota resmi perangkat MewBot ini';
        END IF;
    END IF;

    -- 2. Kunci baris perangkat untuk mencegah race condition konkuren
    PERFORM id FROM devices WHERE id = p_device_id FOR UPDATE;

    -- 3. Hitung pesan yang masih aktif di antrean (status accepted, queued, claimed)
    SELECT COUNT(*) INTO v_pending_count
    FROM messages
    WHERE device_id = p_device_id 
      AND status IN ('accepted', 'queued', 'claimed');

    IF v_pending_count >= 10 THEN
        RAISE EXCEPTION 'Antrean Love Mail penuh (maksimum 10 pesan pending). Tunggu MewBot menerima pesan sebelumnya.';
    END IF;

    -- 4. Masukkan pesan baru ke status queued
    INSERT INTO messages (device_id, body, status, created_by, created_at)
    VALUES (p_device_id, p_body, 'queued', p_created_by, NOW())
    RETURNING * INTO v_new_msg;

    -- 5. Catat event ke linimasa aktivitas
    INSERT INTO activity_events (device_id, event_type, metadata)
    VALUES (p_device_id, 'message_received', jsonb_build_object(
        'message_id', v_new_msg.id,
        'length', char_length(p_body),
        'sender_id', p_created_by
    ));

    RETURN v_new_msg;
END;
$$;

-- Batasi hak eksekusi hanya ke authenticated dan service_role (bukan anonim publik)
REVOKE EXECUTE ON FUNCTION enqueue_love_mail(UUID, VARCHAR(80), UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enqueue_love_mail(UUID, VARCHAR(80), UUID) TO authenticated, service_role;

-- ============================================================================
-- 6. FUNGSI ATOMIK FIFO CLAIM LEASE: claim_next_love_mail
-- Menjamin pesan tidak dikirim ganda berulang kali saat polling konkuren/retry
-- ============================================================================
CREATE OR REPLACE FUNCTION claim_next_love_mail(
    p_device_id UUID,
    p_lease_seconds INT DEFAULT 60
) RETURNS TABLE (
    id UUID,
    body VARCHAR(80),
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
    v_msg_id UUID;
BEGIN
    -- Temukan pesan tertua yang belum diklaim ATAU klaimnya telah kedaluwarsa (lease expired)
    SELECT m.id INTO v_msg_id
    FROM messages m
    WHERE m.device_id = p_device_id
      AND (
          m.status IN ('accepted', 'queued')
          OR (m.status = 'claimed' AND m.claimed_at < NOW() - (p_lease_seconds || ' seconds')::INTERVAL)
      )
    ORDER BY m.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_msg_id IS NOT NULL THEN
        -- Perbarui status menjadi claimed beserta waktu klaim dan delivery attempts
        UPDATE messages
        SET status = 'claimed',
            claimed_at = NOW(),
            delivery_attempts = delivery_attempts + 1
        WHERE messages.id = v_msg_id;

        RETURN QUERY
        SELECT m.id, m.body, m.created_at
        FROM messages m
        WHERE m.id = v_msg_id;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_next_love_mail(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_next_love_mail(UUID, INT) TO service_role;

-- ============================================================================
-- 7. FUNGSI ATOMIK COMMAND CLAIM: claim_next_device_command
-- ============================================================================
CREATE OR REPLACE FUNCTION claim_next_device_command(
    p_device_id UUID,
    p_lease_seconds INT DEFAULT 30
) RETURNS TABLE (
    id UUID,
    command_type TEXT,
    payload JSONB
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cmd_id UUID;
BEGIN
    SELECT c.id INTO v_cmd_id
    FROM device_commands c
    WHERE c.device_id = p_device_id
      AND c.expires_at > NOW()
      AND (
          c.status = 'pending'
          OR (c.status = 'claimed' AND c.claimed_at < NOW() - (p_lease_seconds || ' seconds')::INTERVAL)
      )
    ORDER BY c.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_cmd_id IS NOT NULL THEN
        UPDATE device_commands
        SET status = 'claimed',
            claimed_at = NOW()
        WHERE device_commands.id = v_cmd_id;

        RETURN QUERY
        SELECT c.id, c.command_type, c.payload
        FROM device_commands c
        WHERE c.id = v_cmd_id;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_next_device_command(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_next_device_command(UUID, INT) TO service_role;

-- ============================================================================
-- 8. PENGHAPUSAN POLICIES LAMA (USING TRUE) & PENERAPAN RLS KETAT
-- ============================================================================

-- Hapus kebijakan lama
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view devices" ON devices;
DROP POLICY IF EXISTS "Authenticated users can view device_state" ON device_state;
DROP POLICY IF EXISTS "Authenticated users can manage messages" ON messages;
DROP POLICY IF EXISTS "Authenticated users can manage device_commands" ON device_commands;
DROP POLICY IF EXISTS "Authenticated users can manage message_templates" ON message_templates;
DROP POLICY IF EXISTS "Authenticated users can view activity_events" ON activity_events;

-- Aktifkan RLS pada tabel device_members
ALTER TABLE device_members ENABLE ROW LEVEL SECURITY;

-- A. RLS: profiles
-- Pengguna hanya dapat membaca profil sendiri dan profil pasangan yang berbagi perangkat
CREATE POLICY "Users view own or partner profiles" ON profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid() OR
        id IN (
            SELECT dm2.user_id 
            FROM device_members dm1
            JOIN device_members dm2 ON dm1.device_id = dm2.device_id
            WHERE dm1.user_id = auth.uid()
        )
    );

CREATE POLICY "Users update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- B. RLS: devices
-- Hanya anggota perangkat yang dapat melihat data perangkat
CREATE POLICY "Members can view their devices" ON devices
    FOR SELECT TO authenticated
    USING (is_device_member(id));

CREATE POLICY "Owners can update device info" ON devices
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM device_members 
            WHERE device_id = devices.id AND user_id = auth.uid() AND role = 'owner'
        )
    );

-- C. RLS: device_members
CREATE POLICY "Members can view membership" ON device_members
    FOR SELECT TO authenticated
    USING (is_device_member(device_id));

-- D. RLS: device_state
CREATE POLICY "Members can view device state" ON device_state
    FOR SELECT TO authenticated
    USING (is_device_member(device_id));

CREATE POLICY "Members can update device state" ON device_state
    FOR UPDATE TO authenticated
    USING (is_device_member(device_id))
    WITH CHECK (is_device_member(device_id));

-- E. RLS: messages
CREATE POLICY "Members can view messages" ON messages
    FOR SELECT TO authenticated
    USING (is_device_member(device_id));

CREATE POLICY "Members can insert messages" ON messages
    FOR INSERT TO authenticated
    WITH CHECK (
        is_device_member(device_id) AND 
        (created_by IS NULL OR created_by = auth.uid())
    );

CREATE POLICY "Creators can delete queued messages" ON messages
    FOR DELETE TO authenticated
    USING (
        is_device_member(device_id) AND 
        created_by = auth.uid() AND 
        status IN ('accepted', 'queued')
    );

-- F. RLS: device_commands
CREATE POLICY "Members can view commands" ON device_commands
    FOR SELECT TO authenticated
    USING (is_device_member(device_id));

CREATE POLICY "Members can insert commands" ON device_commands
    FOR INSERT TO authenticated
    WITH CHECK (
        is_device_member(device_id) AND 
        (created_by IS NULL OR created_by = auth.uid())
    );

-- G. RLS: message_templates
CREATE POLICY "Authenticated users view templates" ON message_templates
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Users insert templates" ON message_templates
    FOR INSERT TO authenticated
    WITH CHECK (created_by IS NULL OR created_by = auth.uid());

CREATE POLICY "Users update own templates" ON message_templates
    FOR UPDATE TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- H. RLS: activity_events
CREATE POLICY "Members view activity events" ON activity_events
    FOR SELECT TO authenticated
    USING (is_device_member(device_id));

-- Index parsial untuk akselerasi query klaim antrean pesan
CREATE INDEX IF NOT EXISTS idx_messages_claim_queue 
ON messages(device_id, created_at ASC) 
WHERE status IN ('accepted', 'queued', 'claimed');

CREATE INDEX IF NOT EXISTS idx_device_commands_claim 
ON device_commands(device_id, created_at ASC) 
WHERE status IN ('pending', 'claimed');

