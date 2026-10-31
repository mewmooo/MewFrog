export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const search = url.searchParams.get('q') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = 20;
    const offset = (page - 1) * limit;

    const { data: devices } = await supabase.from('devices').select('id').limit(1);
    if (!devices || devices.length === 0) {
      return NextResponse.json({ memories: [], total: 0 });
    }
    const deviceId = devices[0].id;

    let query = supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('device_id', deviceId)
      .in('status', ['received', 'displayed'])
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
