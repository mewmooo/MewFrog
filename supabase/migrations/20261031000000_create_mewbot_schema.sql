-- ============================================================================
-- MewBot — Skema Database Supabase PostgreSQL & RLS Policies (Final PRD)
-- Versi: 1.0.0 (Tahap 1: Cloud Foundation)
-- ============================================================================

-- Ekstensi PGCrypto untuk hashing token dan UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. FUNGSI UTILITAS: Auto Updated At Timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. TABEL: profiles (Profil Pemilik & Pasangan)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT 'MewBot Companion',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. TABEL: devices (Identitas Perangkat Keras MewBot ESP32-C3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'MewBot Frog Pet',
    device_token_hash TEXT NOT NULL UNIQUE,
    firmware_version TEXT NOT NULL DEFAULT '1.0.0',
    last_seen_at TIMESTAMPTZ,
    last_ip TEXT,
    mode TEXT NOT NULL DEFAULT 'PET' CHECK (mode IN ('PET', 'CLOCK', 'MESSAGE')),
    uptime_seconds BIGINT NOT NULL DEFAULT 0,
    wifi_rssi INTEGER,
    diagnostics JSONB NOT NULL DEFAULT '{"adxl345": true, "touch": true, "heap_free": 0}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_devices_updated_at
BEFORE UPDATE ON devices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 4. TABEL: device_state (Desired State / Konfigurasi Aktif Perangkat)
-- ============================================================================
CREATE TABLE IF NOT EXISTS device_state (
    device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    desired_mode TEXT NOT NULL DEFAULT 'PET' CHECK (desired_mode IN ('PET', 'CLOCK')),
    alarm_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    alarm_hour INTEGER NOT NULL DEFAULT 7 CHECK (alarm_hour BETWEEN 0 AND 23),
    alarm_minute INTEGER NOT NULL DEFAULT 0 CHECK (alarm_minute BETWEEN 0 AND 59),
    config_revision BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_device_state_updated_at
BEFORE UPDATE ON device_state
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 5. TABEL: messages (Love Mail FIFO Queue & Memories)
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    body VARCHAR(80) NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 80),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('accepted', 'queued', 'received', 'displayed', 'failed')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ,
    displayed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
    delivery_attempts INTEGER NOT NULL DEFAULT 0
);

-- Index khusus untuk pengambilan FIFO pesan queued dengan sangat cepat
CREATE INDEX IF NOT EXISTS idx_messages_fifo_queue 
ON messages(device_id, created_at ASC) 
WHERE status IN ('accepted', 'queued');

-- Index untuk Message Memories (pesan yang sukses diterima perangkat, retensi 90 hari)
CREATE INDEX IF NOT EXISTS idx_messages_memories 
ON messages(device_id, received_at DESC) 
WHERE status IN ('received', 'displayed');

-- ============================================================================
-- 6. TABEL: device_commands (Perintah Remote: Restart, OTA, Mode, Alarm)
-- ============================================================================
CREATE TABLE IF NOT EXISTS device_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    command_type TEXT NOT NULL CHECK (command_type IN ('set_mode', 'set_alarm', 'restart', 'ota')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'applied', 'failed', 'expired')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    acknowledged_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_device_commands_pending 
ON device_commands(device_id, created_at ASC) 
WHERE status = 'pending';

-- ============================================================================
-- 7. TABEL: message_templates (Quick Love Notes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL DEFAULT 'Affection' CHECK (category IN ('Affection', 'Caring', 'Missing', 'Encouragement', 'Random')),
    title TEXT NOT NULL,
    body VARCHAR(80) NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 80),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_message_templates_updated_at
BEFORE UPDATE ON message_templates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 8. TABEL: activity_events (Activity Timeline MewBot)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('online', 'offline', 'mode_change', 'message_received', 'touch_interaction', 'wifi_reconnect', 'alarm_triggered')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_timeline 
ON activity_events(device_id, created_at DESC);

-- ============================================================================
-- 9. FUNGSI ATOMIK: enqueue_love_mail (Enforce FIFO Queue Maksimal 10 Pesan)
-- ============================================================================
CREATE OR REPLACE FUNCTION enqueue_love_mail(
    p_device_id UUID,
    p_body VARCHAR(80),
    p_created_by UUID
) RETURNS messages AS $$
DECLARE
    v_pending_count INTEGER;
    v_new_msg messages;
BEGIN
    -- Kunci baris perangkat untuk mencegah race condition
    PERFORM id FROM devices WHERE id = p_device_id FOR UPDATE;

    -- Hitung pesan yang masih pending di antrean
    SELECT COUNT(*) INTO v_pending_count
    FROM messages
    WHERE device_id = p_device_id AND status IN ('accepted', 'queued');

    IF v_pending_count >= 10 THEN
        RAISE EXCEPTION 'Antrean Love Mail penuh (maksimum 10 pesan pending). Tunggu MewBot menerima pesan di antrean.';
    END IF;

    -- Masukkan pesan baru ke status queued
    INSERT INTO messages (device_id, body, status, created_by, created_at)
    VALUES (p_device_id, p_body, 'queued', p_created_by, NOW())
    RETURNING * INTO v_new_msg;

    -- Catat event ke timeline
    INSERT INTO activity_events (device_id, event_type, metadata)
    VALUES (p_device_id, 'message_received', jsonb_build_object('message_id', v_new_msg.id, 'length', char_length(p_body)));

    RETURN v_new_msg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Aktifkan RLS pada seluruh tabel
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

-- Kebijakan untuk Pengguna Terotentikasi (Dashboard Private Shared)
CREATE POLICY "Users can view profiles" ON profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their profile" ON profiles
    FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Authenticated users can view devices" ON devices
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view device_state" ON device_state
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage messages" ON messages
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage device_commands" ON device_commands
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage message_templates" ON message_templates
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view activity_events" ON activity_events
    FOR SELECT TO authenticated USING (true);

-- Catatan: Akses ESP32-C3 dilayani melalui Vercel API Serverless 
-- yang memverifikasi device_token_hash menggunakan Service Role Key secara aman di server.

