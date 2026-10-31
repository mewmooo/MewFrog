export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // 1. Ambil Perangkat MewBot Aktif
    const { data: devices, error: devErr } = await supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1);

    if (devErr || !devices || devices.length === 0) {
      return NextResponse.json({
        device: null,
        is_online: false,
        pending_count: 0,
        recent_activities: []
      });
    }

    const device = devices[0];

    // Status Online: Heartbeat dalam 30 detik terakhir
    const now = Date.now();
    const lastSeen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
    const isOnline = (now - lastSeen) <= 30000;
    const isStale = !isOnline && lastSeen > 0;

    // 2. Ambil Jumlah Pesan Pending di Antrean
    const { count: pendingCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('device_id', device.id)
      .in('status', ['accepted', 'queued']);

    // 3. Ambil Pesan Terakhir yang Diterima MewBot
    const { data: lastMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('device_id', device.id)
      .eq('status', 'received')
      .order('received_at', { ascending: false })
      .limit(1);

    // 4. Ambil Desired State (Mode & Alarm)
    const { data: stateData } = await supabase
      .from('device_state')
      .select('*')
      .eq('device_id', device.id)
      .single();

    // 5. Ambil 5 Aktivitas Terbaru
    const { data: activities } = await supabase
      .from('activity_events')
      .select('*')
      .eq('device_id', device.id)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      device: {
        id: device.id,
        name: device.name,
        firmware_version: device.firmware_version,
        mode: device.mode,
        uptime_seconds: device.uptime_seconds,
        wifi_rssi: device.wifi_rssi,
        last_seen_at: device.last_seen_at,
        diagnostics: device.diagnostics
      },
      is_online: isOnline,
      is_stale: isStale,
      last_seen_relative: lastSeen > 0 ? Math.round((now - lastSeen) / 1000) : null,
      pending_count: pendingCount || 0,
      last_message: (lastMessages && lastMessages.length > 0) ? lastMessages[0] : null,
      device_state: stateData || null,
      recent_activities: activities || []
    });

  } catch (err: any) {
    console.error('Dashboard overview error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

