export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, hashDeviceToken } from '@/lib/supabase';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Device token required' }, { status: 401 });
    }
    const token = authHeader.substring(7).trim();
    const tokenHash = hashDeviceToken(token);
    const supabase = getSupabaseAdmin();

    const { data: device } = await supabase
      .from('devices')
      .select('id')
      .eq('device_token_hash', tokenHash)
      .maybeSingle();

    if (!device) {
      return NextResponse.json({ error: 'Device not found or unauthorized' }, { status: 403 });
    }

    // 1. Cek status pesan saat ini (Idempotent Check)
    const { data: msg } = await supabase
      .from('messages')
      .select('id, status, device_id')
      .eq('id', messageId)
      .maybeSingle();

    if (!msg) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (msg.device_id !== device.id) {
      return NextResponse.json({ error: 'Forbidden: Message does not belong to this device' }, { status: 403 });
    }

    // Jika sudah received atau displayed, kembalikan OK (Idempotent)
    if (msg.status === 'received' || msg.status === 'displayed') {
      return NextResponse.json({ status: 'ok', message_id: messageId, event: 'already_acknowledged' });
    }

    // 2. Perbarui status ke 'received'
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
