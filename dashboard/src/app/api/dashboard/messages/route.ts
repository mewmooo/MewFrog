export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET: Ambil daftar pesan di antrean aktif
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: devices } = await supabase.from('devices').select('id').limit(1);
    if (!devices || devices.length === 0) {
      return NextResponse.json({ messages: [], pending_count: 0 });
    }
    const deviceId = devices[0].id;

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('device_id', deviceId)
      .in('status', ['accepted', 'queued', 'received'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const pendingCount = (messages || []).filter(m => m.status === 'queued' || m.status === 'accepted').length;

    return NextResponse.json({ messages: messages || [], pending_count: pendingCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Kirim Love Mail Baru (Maks 80 Karakter, Maks 10 Antrean)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messageText = (body.body || '').trim();

    // 1. Validasi Panjang Pesan (1 - 80 Karakter)
    if (!messageText || messageText.length === 0) {
      return NextResponse.json({ error: 'Isi pesan tidak boleh kosong' }, { status: 400 });
    }
    if (messageText.length > 80) {
      return NextResponse.json({
        error: `Pesan terlalu panjang (${messageText.length} karakter). Batas maksimum Love Mail adalah 80 karakter.`
      }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 2. Ambil Device ID
    const { data: devices } = await supabase.from('devices').select('id').limit(1);
    if (!devices || devices.length === 0) {
      return NextResponse.json({ error: 'Perangkat MewBot belum terdaftar' }, { status: 404 });
    }
    const deviceId = devices[0].id;

    // 3. Panggil Fungsi Atomik SQL enqueue_love_mail (Cegah Race Condition > 10 Pesan)
    const { data: newMsg, error: fnErr } = await supabase.rpc('enqueue_love_mail', {
      p_device_id: deviceId,
      p_body: messageText,
      p_created_by: null
    });

    if (fnErr) {
      return NextResponse.json({ error: fnErr.message }, { status: 429 });
    }

    return NextResponse.json({
      status: 'success',
      message: newMsg,
      feedback: 'Love Mail berhasil masuk ke antrean! MewBot akan menerima surat saat polling berikutnya.'
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal mengirim pesan' }, { status: 500 });
  }
}

