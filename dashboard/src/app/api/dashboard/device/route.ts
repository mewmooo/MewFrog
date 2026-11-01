export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sesi login diperlukan' }, { status: 401 });
    }

    const body = await req.json();
    const { action, payload } = body;

    const supabase = getSupabaseAdmin();

    // Verifikasi keanggotaan pengguna pada perangkat
    const { data: member } = await supabase
      .from('device_members')
      .select('device_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Perangkat tidak ditemukan untuk akun ini' }, { status: 404 });
    }
    const deviceId = member.device_id;

    // 1. Ganti Mode (PET / CLOCK)
    if (action === 'set_mode') {
      const desiredMode = payload?.mode;
      if (desiredMode !== 'PET' && desiredMode !== 'CLOCK') {
        return NextResponse.json({ error: 'Mode tidak valid' }, { status: 400 });
      }

      const { data: stateData } = await supabase
        .from('device_state')
        .select('config_revision')
        .eq('device_id', deviceId)
        .maybeSingle();

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
        metadata: { new_mode: desiredMode, revision: newRev, changed_by: user.id }
      });

      return NextResponse.json({
        status: 'ok',
        feedback: `Perintah ganti mode ke ${desiredMode} berhasil disimpan! MewBot akan beralih saat polling berikutnya.`
      });
    }

    // 2. Setel Alarm Lokal
    if (action === 'set_alarm') {
      const { enabled, hour, minute } = payload || {};
      const h = parseInt(hour, 10);
      const m = parseInt(minute, 10);

      if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
        return NextResponse.json({ error: 'Waktu alarm tidak valid (format jam 0-23, menit 0-59)' }, { status: 400 });
      }

      const { data: stateData } = await supabase
        .from('device_state')
        .select('config_revision')
        .eq('device_id', deviceId)
        .maybeSingle();

      const newRev = (stateData?.config_revision || 1) + 1;

      await supabase
        .from('device_state')
        .upsert({
          device_id: deviceId,
          alarm_enabled: !!enabled,
          alarm_hour: h,
          alarm_minute: m,
          config_revision: newRev,
          updated_at: new Date().toISOString()
        });

      await supabase.from('activity_events').insert({
        device_id: deviceId,
        event_type: 'mode_change',
        metadata: { alarm_enabled: !!enabled, time: `${h}:${m}`, revision: newRev, changed_by: user.id }
      });

      return NextResponse.json({
        status: 'ok',
        feedback: `Konfigurasi alarm ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} (${enabled ? 'Aktif' : 'Non-aktif'}) tersimpan!`
      });
    }

    // 3. Remote Restart
    if (action === 'restart') {
      const { data: cmd, error } = await supabase
        .from('device_commands')
        .insert({
          device_id: deviceId,
          command_type: 'restart',
          payload: { reason: payload?.reason || 'User requested via dashboard', requested_by: user.id },
          status: 'pending',
          created_by: user.id,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        status: 'ok',
        command: cmd,
        feedback: 'Perintah restart berhasil dijadwalkan! MewBot akan reboot saat polling berikutnya.'
      });
    }

    return NextResponse.json({ error: 'Aksi tidak didukung' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal memproses aksi perangkat' }, { status: 500 });
  }
}
