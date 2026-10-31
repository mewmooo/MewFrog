export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;

    const supabase = getSupabaseAdmin();
    const { data: devices } = await supabase.from('devices').select('id, name').limit(1);
    if (!devices || devices.length === 0) {
      return NextResponse.json({ error: 'Perangkat tidak ditemukan' }, { status: 404 });
    }
    const deviceId = devices[0].id;

    // 1. Ganti Mode (PET / CLOCK)
    if (action === 'set_mode') {
      const desiredMode = payload.mode;
      if (desiredMode !== 'PET' && desiredMode !== 'CLOCK') {
        return NextResponse.json({ error: 'Mode tidak valid' }, { status: 400 });
      }

      // Ambil revision lama dan bump +1
      const { data: stateData } = await supabase
        .from('device_state')
        .select('config_revision')
        .eq('device_id', deviceId)
        .single();

      const newRev = (stateData?.config_revision || 1) + 1;

      await supabase
        .from('device_state')
        .upsert({
          device_id: deviceId,
          desired_mode: desiredMode,
          config_revision: newRev,
          updated_at: new Date().toISOString()
        });

      await supabase.from('activity_events').insert({
        device_id: deviceId,
        event_type: 'mode_change',
        metadata: { new_mode: desiredMode, revision: newRev }
      });

      return NextResponse.json({
        status: 'ok',
        feedback: `Perintah ganti mode ke ${desiredMode} berhasil disimpan! MewBot akan beralih saat polling berikutnya.`
      });
    }

    // 2. Setel Alarm Lokal
    if (action === 'set_alarm') {
      const { enabled, hour, minute } = payload;
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return NextResponse.json({ error: 'Waktu alarm tidak valid' }, { status: 400 });
      }

      const { data: stateData } = await supabase
        .from('device_state')
        .select('config_revision')
        .eq('device_id', deviceId)
        .single();

      const newRev = (stateData?.config_revision || 1) + 1;

      await supabase
        .from('device_state')
        .upsert({
          device_id: deviceId,
          alarm_enabled: !!enabled,
          alarm_hour: parseInt(hour, 10),
          alarm_minute: parseInt(minute, 10),
          config_revision: newRev,
          updated_at: new Date().toISOString()
        });

      await supabase.from('activity_events').insert({
        device_id: deviceId,
        event_type: 'mode_change',
        metadata: { alarm_enabled: enabled, time: `${hour}:${minute}`, revision: newRev }
      });

      return NextResponse.json({
        status: 'ok',
        feedback: `Konfigurasi alarm ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} (${enabled ? 'Aktif' : 'Non-aktif'}) tersimpan!`
      });
    }

    // 3. Remote Restart
    if (action === 'restart') {
      const { data: cmd, error } = await supabase
        .from('device_commands')
        .insert({
          device_id: deviceId,
          command_type: 'restart',
          payload: { reason: payload.reason || 'User requested via dashboard' },
          status: 'pending',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 menit expiry
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        status: 'ok',
        command_id: cmd.id,
        feedback: 'Perintah restart telah dijadwalkan. MewBot akan reboot saat mengambil antrean perintah.'
      });
    }

    return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
