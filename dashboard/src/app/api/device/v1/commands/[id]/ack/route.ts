export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, hashDeviceToken } from '@/lib/supabase';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commandId } = await params;
    if (!commandId) {
      return NextResponse.json({ error: 'Command ID is required' }, { status: 400 });
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

    // 1. Cek status command saat ini (Idempotent Check)
    const { data: cmd } = await supabase
      .from('device_commands')
      .select('id, status, device_id')
      .eq('id', commandId)
      .maybeSingle();

    if (!cmd) {
      return NextResponse.json({ error: 'Command not found' }, { status: 404 });
    }

    if (cmd.device_id !== device.id) {
      return NextResponse.json({ error: 'Forbidden: Command does not belong to this device' }, { status: 403 });
    }

    if (cmd.status === 'applied') {
      return NextResponse.json({ status: 'ok', command_id: commandId, event: 'already_acknowledged' });
    }

    // 2. Perbarui status menjadi 'applied'
    const { error: updateErr } = await supabase
      .from('device_commands')
      .update({
        status: 'applied',
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', commandId)
      .eq('device_id', device.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    return NextResponse.json({ status: 'ok', command_id: commandId, event: 'applied' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
