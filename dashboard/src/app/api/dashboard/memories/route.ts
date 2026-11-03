export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sesi login diperlukan' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const search = (url.searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = 20;
    const offset = (page - 1) * limit;

    // 1. Dapatkan device_id pengguna dari device_members atau fallback devices
    let deviceId = '';
    const { data: member } = await supabase
      .from('device_members')
      .select('device_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (member?.device_id) {
      deviceId = member.device_id;
    } else {
      const { data: firstDevice } = await supabase
        .from('devices')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (firstDevice) {
        deviceId = firstDevice.id;
        // Auto-link pengguna sebagai owner
        await supabase.from('device_members').upsert({
          device_id: firstDevice.id,
          user_id: user.id,
          role: 'owner'
        }, { onConflict: 'device_id,user_id' });
      }
    }

    if (!deviceId) {
      return NextResponse.json({ memories: [], total: 0, page, limit });
    }

    // 2. Query pesan yang sukses diterima / ditampilkan (Message Memories)
    let query = supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('device_id', deviceId)
      .in('status', ['received', 'displayed'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike('body', `%${search}%`);
    }

    const { data: rawMemories, count, error } = await query;
    if (error) {
      console.error('[Memories API Error]:', error);
      throw error;
    }

    // 3. Opsional: Muat nama pengirim dari tabel profiles secara aman tanpa error PostgREST foreign key
    const userIds = Array.from(new Set((rawMemories || []).map(m => m.created_by).filter(Boolean)));
    const profileMap = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds);
      
      (profiles || []).forEach(p => {
        if (p.id && p.display_name) {
          profileMap.set(p.id, p.display_name);
        }
      });
    }

    const memories = (rawMemories || []).map(m => ({
      ...m,
      sender_name: m.created_by ? (profileMap.get(m.created_by) || 'MewBot Companion') : 'MewBot Companion'
    }));

    return NextResponse.json({
      memories: memories || [],
      total: count || 0,
      page,
      limit
    });
  } catch (err: any) {
    console.error('[Memories Route Exception]:', err);
    return NextResponse.json({ error: err.message || 'Gagal memuat memori' }, { status: 500 });
  }
}
