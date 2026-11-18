export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase';

const CATEGORIES = ['Umum', 'Pengingat', 'Sapaan', 'Semangat', 'Lainnya'] as const;
const MAX_BODY_LENGTH = 80;

function normalizeCategory(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return 'Umum';
  const cat = String(value).trim();
  return (CATEGORIES as readonly string[]).includes(cat) ? cat : null;
}

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

    // Jika template masih kosong, kembalikan template contoh.
    // Ditandai is_example agar UI tahu ini belum tersimpan dan bisa menawarkan
    // tombol "Simpan sebagai template" alih-alih Edit/Hapus.
    if (!templates || templates.length === 0) {
      const exampleTemplates = [
        { category: 'Umum', title: 'Sapaan Pagi', body: 'Selamat pagi! Semoga harimu lancar.' },
        { category: 'Pengingat', title: 'Istirahat Dulu', body: 'Jangan lupa minum air dan istirahat sejenak.' },
        { category: 'Pengingat', title: 'Waktunya Tidur', body: 'Sudah malam, waktunya istirahat.' },
        { category: 'Semangat', title: 'Semangat Hari Ini', body: 'Pelankan langkah, tapi jangan berhenti.' },
        { category: 'Sapaan', title: 'Halo', body: 'Halo! Semoga harimu menyenangkan.' }
      ].map((t) => ({ ...t, is_example: true }));

      return NextResponse.json({ templates: exampleTemplates });
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
    const { title, body: textBody } = body || {};

    if (!title || !textBody) {
      return NextResponse.json({ error: 'Judul dan isi template wajib diisi' }, { status: 400 });
    }
    if (String(textBody).length > MAX_BODY_LENGTH) {
      return NextResponse.json(
        { error: `Isi template tidak boleh lebih dari ${MAX_BODY_LENGTH} karakter` },
        { status: 400 }
      );
    }

    const category = normalizeCategory(body?.category);
    if (category === null) {
      return NextResponse.json(
        { error: `Kategori tidak valid. Pilih salah satu: ${CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        category,
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

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sesi login diperlukan' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'ID template wajib disertakan' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: existing, error: findErr } = await supabase
      .from('message_templates')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (findErr) throw findErr;
    if (!existing) {
      return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (body?.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) {
        return NextResponse.json({ error: 'Judul template tidak boleh kosong' }, { status: 400 });
      }
      updates.title = title;
    }

    if (body?.body !== undefined) {
      const textBody = String(body.body).trim();
      if (!textBody) {
        return NextResponse.json({ error: 'Isi template tidak boleh kosong' }, { status: 400 });
      }
      if (textBody.length > MAX_BODY_LENGTH) {
        return NextResponse.json(
          { error: `Isi template tidak boleh lebih dari ${MAX_BODY_LENGTH} karakter` },
          { status: 400 }
        );
      }
      updates.body = textBody;
    }

    if (body?.category !== undefined) {
      const category = normalizeCategory(body.category);
      if (category === null) {
        return NextResponse.json(
          { error: `Kategori tidak valid. Pilih salah satu: ${CATEGORIES.join(', ')}` },
          { status: 400 }
        );
      }
      updates.category = category;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Tidak ada perubahan yang dikirim' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('message_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ template: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sesi login diperlukan' }, { status: 401 });
    }

    const id = (req.nextUrl.searchParams.get('id') || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'ID template wajib disertakan' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: existing, error: findErr } = await supabase
      .from('message_templates')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (findErr) throw findErr;
    if (!existing) {
      return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 404 });
    }

    const { error } = await supabase.from('message_templates').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ status: 'ok', deleted_id: id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
