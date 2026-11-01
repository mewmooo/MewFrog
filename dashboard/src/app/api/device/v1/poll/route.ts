export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, hashDeviceToken } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    // 1. Ekstrak Bearer Device Token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Device token required' }, { status: 401 });
    }
    const token = authHeader.substring(7).trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token format' }, { status: 401 });
    }

    const tokenHash = hashDeviceToken(token);
    const supabase = getSupabaseAdmin();

    // 2. Cari Perangkat Berdasarkan Token Hash
    const { data: device, error: devErr } = await supabase
      .from('devices')
      .select('id, name, mode, firmware_version')
      .eq('device_token_hash', tokenHash)
      .maybeSingle();

    if (devErr || !device) {
      return NextResponse.json({ error: 'Device not recognized or revoked' }, { status: 403 });
    }

    // 3. Parse & Validasi Payload Heartbeat ESP32-C3
    const rawBody = await req.json().catch(() => ({}));
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || 'unknown';

    // Validasi tipe data ketat (Tangani nilai 0, false, dan null dengan benar)
    const firmwareVersion = typeof rawBody.firmware_version === 'string' ? rawBody.firmware_version.slice(0, 32) : device.firmware_version;
    const mode = (rawBody.mode === 'CLOCK' || rawBody.mode === 'MESSAGE' || rawBody.mode === 'PET') ? rawBody.mode : device.mode;
    const uptimeSeconds = typeof rawBody.uptime_seconds === 'number' && rawBody.uptime_seconds >= 0 ? Math.floor(rawBody.uptime_seconds) : 0;
    const wifiRssi = typeof rawBody.wifi_rssi === 'number' ? Math.floor(rawBody.wifi_rssi) : null;
    const freeHeap = typeof rawBody.free_heap === 'number' ? Math.floor(rawBody.free_heap) : 0;
    const clientRevision = typeof rawBody.config_revision === 'number' ? Math.floor(rawBody.config_revision) : 0;

    const sensorObj = (typeof rawBody.sensor === 'object' && rawBody.sensor !== null) ? {
      adxl345: rawBody.sensor.adxl345 === true,
      touch: rawBody.sensor.touch === true
    } : { adxl345: false, touch: true };

    // 4. Update Status & Telemetri Perangkat di Database
    await supabase
      .from('devices')
      .update({
        last_seen_at: new Date().toISOString(),
        last_ip: clientIp,
        firmware_version: firmwareVersion,
        mode: mode,
        uptime_seconds: uptimeSeconds,
        wifi_rssi: wifiRssi,
        diagnostics: {
          sensor: sensorObj,
          free_heap: freeHeap,
          last_poll: new Date().toISOString()
        }
      })
      .eq('id', device.id);

    // 5. Proses Piggybacked ACK Pesan Sebelumnya (Idempotent & Validasi Ownership)
    const lastMsgAck = typeof rawBody.last_message_ack === 'string' ? rawBody.last_message_ack.trim() : null;
    if (lastMsgAck && lastMsgAck.length > 0) {
      await supabase
        .from('messages')
        .update({
          status: 'received',
          received_at: new Date().toISOString()
        })
        .eq('id', lastMsgAck)
        .eq('device_id', device.id)
        .in('status', ['claimed', 'queued', 'accepted']);
    }

    // 6. Cek Desired State Konfigurasi (Mode / Alarm)
    const { data: stateData } = await supabase
      .from('device_state')
      .select('*')
      .eq('device_id', device.id)
      .maybeSingle();

    let desiredStatePayload = null;
    let currentConfigRevision = 1;

    if (stateData) {
      currentConfigRevision = stateData.config_revision;
      // Jika revisi di ESP32 tertinggal dari database, kirim desired_state baru
      if (clientRevision < stateData.config_revision) {
        desiredStatePayload = {
          mode: stateData.desired_mode,
          alarm_enabled: stateData.alarm_enabled,
          alarm_hour: stateData.alarm_hour,
          alarm_minute: stateData.alarm_minute
        };
      }
    }

    // 7. Ambil 1 Pesan Tertua dengan Atomic Claim Lease (60 detik)
    // Menjamin pesan tidak dikirim ganda berulang kali saat polling konkuren
    let messagePayload = null;
    const { data: claimedMsg, error: claimErr } = await supabase
      .rpc('claim_next_love_mail', {
        p_device_id: device.id,
        p_lease_seconds: 60
      });

    if (!claimErr && claimedMsg && claimedMsg.length > 0) {
      messagePayload = {
        id: claimedMsg[0].id,
        body: claimedMsg[0].body
      };
    }

    // 8. Ambil 1 Command Valid dengan Atomic Claim Lease (30 detik)
    let commandPayload = null;
    const { data: claimedCmd, error: cmdClaimErr } = await supabase
      .rpc('claim_next_device_command', {
        p_device_id: device.id,
        p_lease_seconds: 30
      });

    if (!cmdClaimErr && claimedCmd && claimedCmd.length > 0) {
      commandPayload = {
        id: claimedCmd[0].id,
        type: claimedCmd[0].command_type,
        payload: claimedCmd[0].payload
      };
    }

    // 9. Response Ringkas & Hemat Bandwidth untuk ESP32-C3
    return NextResponse.json({
      server_time: new Date().toISOString(),
      config_revision: currentConfigRevision,
      desired_state: desiredStatePayload,
      message: messagePayload,
      command: commandPayload
    });

  } catch (err: any) {
    console.error('Device poll error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
