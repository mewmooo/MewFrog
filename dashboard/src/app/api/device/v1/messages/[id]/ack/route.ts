export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, hashDeviceToken } from '@/lib/supabase';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7).trim();
    const tokenHash = hashDeviceToken(token);
    const supabase = getSupabaseAdmin();

    const { data: device } = await supabase
      .from('devices')
      .select('id')
      .eq('device_token_hash', tokenHash)
      .single();

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 403 });
    }

    // Idempotent ACK: Update pesan ke received
    const { error: updateErr } = await supabase
      .from('messages')
      .update({
        status: 'received',
        received_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('device_id', device.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    return NextResponse.json({ status: 'ok', message_id: messageId, event: 'received' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

