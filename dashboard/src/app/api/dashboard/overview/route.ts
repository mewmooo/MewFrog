export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Verifikasi Sesi Autentikasi Pengguna
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sesi login diperlukan' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // 2. Ambil Perangkat yang Menjadi Hak Akses Pengguna (Model Akses Bersama)
    const { data: membership, error: memErr } = await supabase
      .from('device_members')
      .select('device_id, role, devices(*)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    let device: any = null;

    if (membership?.devices) {
      device = membership.devices;
    } else {
      // Fallback untuk setup awal jika belum ada relasi device_members terisi:
      // Ambil device pertama dan otomatis tautkan user sebagai owner jika belum ada member
      const { data: firstDevice } = await supabase.from('devices').select('*').limit(1).maybeSingle();
      if (firstDevice) {
        device = firstDevice;
        // Daftarkan sebagai owner otomatis untuk bootstrap
        await supabase.from('device_members').upsert({
          device_id: firstDevice.id,
          user_id: user.id,
          role: 'owner'
        }, { onConflict: 'device_id,user_id' });
      }
    }

    if (!device) {
      return NextResponse.json({
        device: null,
        is_online: false,
        pending_count: 0,
        recent_activities: []
      });
    }

    // Status Online: Heartbeat dalam 30 detik terakhir
    const now = Date.now();
    const lastSeen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
    const isOnline = (now - lastSeen) <= 30000;
    const isStale = !isOnline && lastSeen > 0;

    // 3. Ambil Jumlah Pesan Pending di Antrean
    const { count: pendingCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('device_id', device.id)
      .in('status', ['accepted', 'queued', 'claimed']);

    // 4. Ambil Pesan Terakhir yang Diterima MewBot
    const { data: lastMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('device_id', device.id)
      .in('status', ['received', 'displayed'])
      .order('received_at', { ascending: false })
      .limit(1);

    // 5. Ambil Desired State (Mode & Alarm)
    const { data: stateData } = await supabase
      .from('device_state')
      .select('*')
      .eq('device_id', device.id)
      .maybeSingle();

    // 6. Ambil 25 Aktivitas Linimasa Terbaru
    const { data: activities } = await supabase
      .from('activity_events')
      .select('*')
      .eq('device_id', device.id)
      .order('created_at', { ascending: false })
      .limit(25);

    // Ambil isi teks pesan Love Mail untuk ditampilkan manusiawi
    if (activities && activities.length > 0) {
      const msgIds = activities
        .filter((a: any) => a.metadata && a.metadata.message_id)
        .map((a: any) => a.metadata.message_id);

      if (msgIds.length > 0) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, body')
          .in('id', msgIds);

        if (msgs && msgs.length > 0) {
          const bodyMap = new Map(msgs.map((m: any) => [m.id, m.body]));
          for (const act of activities) {
            if (act.metadata?.message_id && bodyMap.has(act.metadata.message_id)) {
              act.metadata.body = bodyMap.get(act.metadata.message_id);
            }
          }
        }
      }
    }

    const resolvedState = stateData || {
      desired_mode: 'PET',
      alarm_enabled: false,
      alarm_hour: 7,
      alarm_minute: 0,
      config_revision: 1
    };

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      device: {
        id: device.id,
        name: device.name,
        mode: device.mode,
        firmware_version: device.firmware_version,
        uptime_seconds: device.uptime_seconds,
        wifi_rssi: device.wifi_rssi,
        diagnostics: device.diagnostics,
        last_seen_at: device.last_seen_at
      },
      is_online: isOnline,
      is_stale: isStale,
      last_seen: device.last_seen_at,
      state: resolvedState,
      device_state: resolvedState,
      pending_count: pendingCount || 0,
      last_received_message: lastMessages && lastMessages.length > 0 ? lastMessages[0] : null,
      recent_activities: activities || []
    });

  } catch (err: any) {
    console.error('Overview API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
