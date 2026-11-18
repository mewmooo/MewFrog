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

    // 1. Baca hasil yang dilaporkan perangkat (default: applied)
    const body = await req.json().catch(() => ({}));
    const resultStatus = body?.status === 'failed' ? 'failed' : 'applied';
    const resultError =
      typeof body?.error === 'string' && body.error.trim().length > 0
        ? body.error.trim().slice(0, 200)
        : null;

    // 2. Cek status command saat ini (Idempotent Check)
    const { data: cmd } = await supabase
      .from('device_commands')
      .select('id, status, device_id, command_type, payload')
      .eq('id', commandId)
      .maybeSingle();

    if (!cmd) {
      return NextResponse.json({ error: 'Command not found' }, { status: 404 });
    }

    if (cmd.device_id !== device.id) {
      return NextResponse.json({ error: 'Forbidden: Command does not belong to this device' }, { status: 403 });
    }

    if (cmd.status === 'applied' || cmd.status === 'failed') {
      return NextResponse.json({ status: 'ok', command_id: commandId, event: 'already_acknowledged' });
    }

    // 3. Perbarui status sesuai hasil sebenarnya
    const isOta = cmd.command_type === 'ota';
    const updatePayload: Record<string, unknown> = {
      status: resultStatus,
      acknowledged_at: new Date().toISOString()
    };

    if (isOta) {
      updatePayload.payload = {
        ...(cmd.payload && typeof cmd.payload === 'object' ? cmd.payload : {}),
        ota_result: {
          ok: resultStatus === 'applied',
          error: resultError,
          reported_at: new Date().toISOString()
        }
      };
    }

    const { error: updateErr } = await supabase
      .from('device_commands')
      .update(updatePayload)
      .eq('id', commandId)
      .eq('device_id', device.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    // 4. Catat hasil OTA ke linimasa agar terlihat di dashboard
    if (isOta) {
      await supabase.from('activity_events').insert({
        device_id: device.id,
        event_type: 'mode_change',
        metadata:
          resultStatus === 'failed'
            ? {
                action: 'firmware_update_failed',
                error: resultError || 'Perangkat tidak melaporkan alasan',
                command_id: commandId
              }
            : { action: 'firmware_update_applied', command_id: commandId }
      });
    }

    return NextResponse.json({ status: 'ok', command_id: commandId, event: resultStatus });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
