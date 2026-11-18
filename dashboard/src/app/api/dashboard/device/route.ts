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

    // 3b. Update Firmware (OTA)
    if (action === 'ota') {
      const rawUrl = typeof payload?.url === 'string' ? payload.url.trim() : '';
      const sha256 = typeof payload?.sha256 === 'string' ? payload.sha256.trim().toLowerCase() : '';
      const version = typeof payload?.version === 'string' ? payload.version.trim() : '';

      if (!rawUrl) {
        return NextResponse.json({ error: 'URL firmware wajib diisi' }, { status: 400 });
      }
      if (!/^[a-f0-9]{64}$/i.test(sha256)) {
        return NextResponse.json(
          { error: 'SHA-256 wajib 64 karakter heksadesimal. Pakai versi dari manifest agar tidak salah ketik.' },
          { status: 400 }
        );
      }
      if (version && !/^\d+\.\d+\.\d+$/.test(version)) {
        return NextResponse.json({ error: 'Format versi harus x.y.z (contoh 1.8.0)' }, { status: 400 });
      }

      const isInternal = rawUrl.startsWith('/firmware/');
      if (!isInternal && !rawUrl.startsWith('https://')) {
        return NextResponse.json(
          { error: 'URL firmware wajib diawali https:// karena perangkat memverifikasi sertifikat TLS' },
          { status: 400 }
        );
      }

      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(rawUrl, req.nextUrl.origin).toString();
      } catch {
        return NextResponse.json(
          { error: 'URL firmware tidak valid. Periksa kembali penulisannya.' },
          { status: 400 }
        );
      }

      // Untuk URL manual, pastikan file benar-benar bisa diunduh perangkat sebelum
      // perintah masuk antrean. Tanpa ini, kesalahan URL baru ketahuan saat perangkat
      // mengunduh — dan pemilik hanya melihat "Unduhan HTTP gagal: kode 404".
      if (!isInternal) {
        try {
          const probe = await fetch(absoluteUrl, { method: 'HEAD', redirect: 'follow' });

          if (!probe.ok) {
            return NextResponse.json(
              {
                error: `URL firmware tidak bisa diakses (HTTP ${probe.status}). Periksa apakah file sudah diunggah dan URL-nya benar.`
              },
              { status: 400 }
            );
          }

          if (probe.headers.get('content-encoding')) {
            return NextResponse.json(
              {
                error:
                  'Server mengirim file terkompresi (content-encoding). Perangkat menghitung ukuran dari Content-Length sehingga unduhan akan gagal. Sajikan file apa adanya.'
              },
              { status: 400 }
            );
          }

          const contentLength = Number(probe.headers.get('content-length') || '0');
          if (contentLength > 1835008) {
            return NextResponse.json(
              {
                error: `Ukuran file ${contentLength} byte melebihi batas slot firmware 1.835.008 byte.`
              },
              { status: 400 }
            );
          }
        } catch {
          return NextResponse.json(
            { error: 'Tidak bisa menghubungi URL firmware. Periksa koneksi server dan alamatnya.' },
            { status: 400 }
          );
        }
      }

      // Untuk file yang disajikan dari dashboard sendiri, cocokkan hash dengan manifest
      // supaya salah ketik / file yang belum dideploy tertangkap sebelum perintah dikirim.
      if (isInternal) {
        try {
          // redirect: 'manual' — kalau manifest ternyata dialihkan (mis. ke halaman login),
          // kita ingin tahu itu sebagai kegagalan deploy, bukan menerima HTML lalu gagal
          // dengan pesan "hash tidak cocok" yang menyesatkan.
          const manifestRes = await fetch(new URL('/firmware/manifest.json', req.nextUrl.origin), {
            redirect: 'manual'
          });
          if (manifestRes.status !== 200) {
            return NextResponse.json(
              {
                error: `Manifest firmware tidak bisa diakses (HTTP ${manifestRes.status}). Jalankan npm run firmware:manifest lalu deploy ulang.`
              },
              { status: 400 }
            );
          }

          const manifest = await manifestRes.json().catch(() => null);
          if (!manifest || !Array.isArray(manifest.firmware)) {
            return NextResponse.json(
              { error: 'Manifest firmware tidak bisa dibaca (bukan JSON yang valid). Deploy ulang folder public/firmware.' },
              { status: 400 }
            );
          }

          const fileName = rawUrl.replace('/firmware/', '');
          const entry = manifest.firmware.find((fw: any) => fw.file === fileName);

          if (!entry) {
            return NextResponse.json(
              { error: `File ${fileName} tidak terdaftar di manifest firmware.` },
              { status: 400 }
            );
          }
          if (String(entry.sha256).toLowerCase() !== sha256) {
            return NextResponse.json(
              { error: 'SHA-256 tidak cocok dengan manifest. Pilih ulang firmware dari daftar.' },
              { status: 400 }
            );
          }
        } catch {
          return NextResponse.json(
            { error: 'Gagal memverifikasi manifest firmware di server.' },
            { status: 400 }
          );
        }
      }

      // Hanya boleh satu perintah OTA menunggu agar perangkat tidak mengunduh dua binary berturut-turut.
      // Perintah yang sudah lewat masa berlaku tidak dihitung: kalau dihitung, perangkat yang mati
      // lebih dari 30 menit akan memblokir semua percobaan update berikutnya.
      const { data: existingOta } = await supabase
        .from('device_commands')
        .select('id')
        .eq('device_id', deviceId)
        .eq('command_type', 'ota')
        .in('status', ['pending', 'claimed'])
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (existingOta) {
        return NextResponse.json(
          { error: 'Masih ada perintah update firmware yang menunggu. Batalkan dulu sebelum mengirim yang baru.' },
          { status: 409 }
        );
      }

      const { data: cmd, error } = await supabase
        .from('device_commands')
        .insert({
          device_id: deviceId,
          command_type: 'ota',
          payload: {
            url: absoluteUrl,
            sha256,
            version: version || null,
            requested_by: user.id
          },
          status: 'pending',
          created_by: user.id,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('activity_events').insert({
        device_id: deviceId,
        event_type: 'mode_change',
        metadata: {
          action: 'firmware_update_requested',
          version: version || null,
          sha256: sha256.slice(0, 12),
          url_host: new URL(absoluteUrl).host,
          changed_by: user.id
        }
      });

      return NextResponse.json({
        status: 'ok',
        command: cmd,
        feedback: `Perintah update firmware${version ? ` ke v${version}` : ''} dijadwalkan. MewBot akan mengunduh saat polling berikutnya (berlaku 30 menit).`
      });
    }

    // 4. Batalkan Perintah Polling yang Masih Pending / Claimed (misal bot offline dan perintah mau dibatalkan)
    if (action === 'cancel_command') {
      const commandId = payload?.command_id || 'all';

      if (commandId === 'all') {
        await supabase
          .from('device_commands')
          .delete()
          .eq('device_id', deviceId)
          .in('status', ['pending', 'claimed']);

        await supabase.from('activity_events').insert({
          device_id: deviceId,
          event_type: 'mode_change',
          metadata: {
            action: 'command_cancelled',
            command_type: 'Semua perintah pending',
            cancelled_by: user.id
          }
        });

        return NextResponse.json({
          status: 'ok',
          feedback: 'Seluruh perintah antrean berhasil dibatalkan dan dibersihkan dari polling MewBot!'
        });
      }

      const { data: cmd } = await supabase
        .from('device_commands')
        .select('*')
        .eq('id', commandId)
        .eq('device_id', deviceId)
        .maybeSingle();

      if (!cmd) {
        return NextResponse.json({ error: 'Perintah tidak ditemukan di antrean' }, { status: 404 });
      }

      await supabase
        .from('device_commands')
        .delete()
        .eq('id', commandId)
        .eq('device_id', deviceId);

      await supabase.from('activity_events').insert({
        device_id: deviceId,
        event_type: 'mode_change',
        metadata: {
          action: 'command_cancelled',
          command_type: cmd.command_type,
          cancelled_by: user.id
        }
      });

      return NextResponse.json({
        status: 'ok',
        feedback: `Perintah ${cmd.command_type} berhasil dibatalkan dari antrean polling MewBot!`
      });
    }

    return NextResponse.json({ error: 'Aksi tidak didukung' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal memproses aksi perangkat' }, { status: 500 });
  }
}
