export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sesi login diperlukan' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: templates, error } = await supabase
      .from('message_templates')
      .select('*')
      .order('category', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Jika template masih kosong, kembalikan template default kurasi
    if (!templates || templates.length === 0) {
      const defaultTemplates = [
        { category: 'Affection', title: 'Sayang Kamu', body: 'Aku sayang banget sama kamu ❤️ Tetap semangat ya!' },
        { category: 'Caring', title: 'Istirahat Dulu', body: 'Kerjanya sudah hebat hari ini. Jangan lupa minum air & istirahat ☕' },
        { category: 'Missing', title: 'Kangen Kamu', body: 'Kangen nih... Nanti malam kabari ya saat santai 🐸' },
        { category: 'Encouragement', title: 'Pasti Bisa!', body: 'Semangat ya hari ini! Kamu pasti bisa selesaikan semuanya ✨' },
        { category: 'Random', title: 'Sapaan Ceria', body: 'Ribbit! Salam ceria dari MewBot di meja kerjamu 🌿' }
      ];
      return NextResponse.json({ templates: defaultTemplates });
    }

    return NextResponse.json({ templates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sesi login diperlukan' }, { status: 401 });
    }

    const body = await req.json();
    const { category, title, body: textBody } = body || {};

    if (!title || !textBody) {
      return NextResponse.json({ error: 'Judul dan isi template wajib diisi' }, { status: 400 });
    }
    if (textBody.length > 80) {
      return NextResponse.json({ error: 'Isi template tidak boleh lebih dari 80 karakter' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        category: category || 'Affection',
        title: String(title).trim(),
        body: String(textBody).trim(),
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ template: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
