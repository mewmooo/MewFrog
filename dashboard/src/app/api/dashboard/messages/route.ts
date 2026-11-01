export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET: Ambil daftar pesan di antrean aktif untuk perangkat milik pengguna
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sesi login diperlukan' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Dapatkan device_id pengguna
    const { data: member } = await supabase
      .from('device_members')
      .select('device_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ messages: [], pending_count: 0 });
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('device_id', member.device_id)
      .in('status', ['accepted', 'queued', 'claimed', 'received'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const pendingCount = (messages || []).filter(m => 
      m.status === 'queued' || m.status === 'accepted' || m.status === 'claimed'
    ).length;

    return NextResponse.json({ messages: messages || [], pending_count: pendingCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Kirim Love Mail Baru (Maks 80 Karakter, Maks 10 Antrean)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sesi login diperlukan' }, { status: 401 });
    }

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

    // 2. Ambil Device ID anggota
    const { data: member } = await supabase
      .from('device_members')
      .select('device_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Pengguna belum terdaftar pada perangkat MewBot' }, { status: 404 });
    }

    // 3. Panggil Fungsi Atomik SQL enqueue_love_mail dengan user.id terverifikasi
    const { data: newMsg, error: fnErr } = await supabase.rpc('enqueue_love_mail', {
      p_device_id: member.device_id,
      p_body: messageText,
      p_created_by: user.id
    });

    if (fnErr) {
      return NextResponse.json({ error: fnErr.message }, { status: 429 });
    }

    return NextResponse.json({
      status: 'success',
      message: newMsg,
      feedback: 'Love Mail berhasil masuk ke antrean! MewBot akan membacanya saat polling berikutnya 💌'
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal mengirim pesan' }, { status: 500 });
  }
}
