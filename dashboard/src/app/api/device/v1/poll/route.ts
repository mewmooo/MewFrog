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
      .single();

    if (devErr || !device) {
      return NextResponse.json({ error: 'Device not recognized or revoked' }, { status: 403 });
    }

    // 3. Parse Payload Heartbeat dari ESP32-C3
    const body = await req.json().catch(() => ({}));
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // 4. Update Status & Heartbeat Perangkat
    await supabase
      .from('devices')
      .update({
        last_seen_at: new Date().toISOString(),
        last_ip: clientIp,
        firmware_version: body.firmware_version || device.firmware_version,
        mode: body.mode || device.mode,
        uptime_seconds: body.uptime_seconds || 0,
        wifi_rssi: body.wifi_rssi || null,
        diagnostics: {
          sensor: body.sensor || {},
          free_heap: body.free_heap || 0,
          last_poll: new Date().toISOString()
        }
      })
      .eq('id', device.id);

    // 5. Proses ACK Pesan Sebelumnya (jika dikirim bersama polling)
    if (body.last_message_ack) {
      await supabase
        .from('messages')
        .update({
          status: 'received',
          received_at: new Date().toISOString()
        })
        .eq('id', body.last_message_ack)
        .eq('device_id', device.id);
    }

    // 6. Cek Desired State Konfigurasi (Mode / Alarm)
    const { data: stateData } = await supabase
      .from('device_state')
      .select('*')
      .eq('device_id', device.id)
      .single();

    let desiredStatePayload = null;
    let currentConfigRevision = 1;

    if (stateData) {
      currentConfigRevision = stateData.config_revision;
      // Jika revisi di ESP32 tertinggal dari database, kirim desired_state baru
      if (!body.config_revision || body.config_revision < stateData.config_revision) {
        desiredStatePayload = {
          mode: stateData.desired_mode,
          alarm_enabled: stateData.alarm_enabled,
          alarm_hour: stateData.alarm_hour,
          alarm_minute: stateData.alarm_minute
        };
      }
    }

    // 7. Ambil 1 Pesan Tertua dari Antrean FIFO (Love Mail)
    const { data: pendingMessages } = await supabase
      .from('messages')
      .select('id, body')
      .eq('device_id', device.id)
      .in('status', ['accepted', 'queued'])
      .order('created_at', { ascending: true })
      .limit(1);

    let messagePayload = null;
    if (pendingMessages && pendingMessages.length > 0) {
      messagePayload = {
        id: pendingMessages[0].id,
        body: pendingMessages[0].body
      };
    }

    // 8. Ambil 1 Command Valid (Restart / OTA) jika ada
    const { data: pendingCommands } = await supabase
      .from('device_commands')
      .select('id, command_type, payload')
      .eq('device_id', device.id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(1);

    let commandPayload = null;
    if (pendingCommands && pendingCommands.length > 0) {
      commandPayload = {
        id: pendingCommands[0].id,
        type: pendingCommands[0].command_type,
        payload: pendingCommands[0].payload
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

