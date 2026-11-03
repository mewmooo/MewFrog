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

    // 2. Setel atau Hapus / Batalkan Alarm Lokal
    if (action === 'set_alarm' || action === 'delete_alarm') {
      const isDelete = action === 'delete_alarm';
      const { enabled, hour, minute } = payload || {};
      const alarmEnabled = isDelete ? false : !!enabled;

      const { data: stateData } = await supabase
        .from('device_state')
        .select('config_revision, alarm_hour, alarm_minute')
        .eq('device_id', deviceId)
        .maybeSingle();

      let h = parseInt(hour, 10);
      let m = parseInt(minute, 10);

      if (isNaN(h)) h = stateData?.alarm_hour ?? 7;
      if (isNaN(m)) m = stateData?.alarm_minute ?? 0;

      if (!isDelete && (h < 0 || h > 23 || m < 0 || m > 59)) {
        return NextResponse.json({ error: 'Waktu alarm tidak valid (format jam 0-23, menit 0-59)' }, { status: 400 });
      }

      const newRev = (stateData?.config_revision || 1) + 1;
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

      await supabase
        .from('device_state')
        .upsert({
          device_id: deviceId,
          alarm_enabled: alarmEnabled,
          alarm_hour: h,
          alarm_minute: m,
          config_revision: newRev,
          updated_at: new Date().toISOString()
        });

      await supabase.from('activity_events').insert({
        device_id: deviceId,
        event_type: 'mode_change',
        metadata: {
          action: isDelete ? 'delete_alarm' : (alarmEnabled ? 'set_alarm' : 'delete_alarm'),
          alarm_enabled: alarmEnabled,
          time: timeStr,
          revision: newRev,
          changed_by: user.id
        }
      });

      return NextResponse.json({
        status: 'ok',
        feedback: isDelete || !alarmEnabled
          ? `Alarm jam ${timeStr} WIB berhasil dibatalkan / dihapus!`
          : `Alarm berhasil disetel pada jam ${timeStr} WIB!`
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

      await supabase.from('activity_events').insert({
        device_id: deviceId,
        event_type: 'mode_change',
        metadata: {
          action: 'restart_requested',
          reason: payload?.reason || 'Permintaan pengguna melalui dashboard',
          changed_by: user.id
        }
      });

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
