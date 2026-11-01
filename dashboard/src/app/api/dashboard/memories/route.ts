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
    const search = url.searchParams.get('q') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = 20;
    const offset = (page - 1) * limit;

    const { data: member } = await supabase
      .from('device_members')
      .select('device_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ memories: [], total: 0 });
    }
    const deviceId = member.device_id;

    // Filter pesan yang benar-benar telah diterima (received atau displayed), dalam retensi 90 hari
    let query = supabase
      .from('messages')
      .select('*, profiles:created_by(display_name)', { count: 'exact' })
      .eq('device_id', deviceId)
      .in('status', ['received', 'displayed'])
      .gt('expires_at', new Date().toISOString())
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike('body', `%${search}%`);
    }

    const { data: memories, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      memories: memories || [],
      total: count || 0,
      page,
      limit
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
