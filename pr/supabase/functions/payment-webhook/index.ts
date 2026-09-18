import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function validSignature(request: Request, dataId: string) {
  const signature = request.headers.get('x-signature') ?? '';
  const requestId = request.headers.get('x-request-id') ?? '';
  const secret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET') ?? '';
  const parts = Object.fromEntries(signature.split(',').map(part => part.trim().split('=')));
  if (!secret || !requestId || !parts.ts || !parts.v1 || !dataId) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest));
  const expected = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return constantTimeEqual(expected, parts.v1.toLowerCase());
}

Deno.serve(async (request) => {
  try {
    const body = await request.json();
    if (body.type !== 'payment') return Response.json({ received: true });
    const url = new URL(request.url);
    const paymentId = String(url.searchParams.get('data.id') ?? body.data?.id ?? '');
    if (!await validSignature(request, paymentId)) return Response.json({ error: 'Invalid signature' }, { status: 401 });

    const token = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!token) return Response.json({ error: 'Payment provider is not configured' }, { status: 500 });
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!paymentResponse.ok) return Response.json({ error: 'Payment lookup failed' }, { status: 502 });
    const payment = await paymentResponse.json();
    if (payment.status !== 'approved' || !payment.external_reference) return Response.json({ received: true });

    const [userId, courseId] = payment.external_reference.split(':');
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid.test(userId) || !uuid.test(courseId)) return Response.json({ error: 'Invalid payment reference' }, { status: 400 });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await admin.from('enrollments').upsert({
      user_id: userId,
      course_id: courseId,
      status: 'active',
      payment_provider: 'mercado_pago',
      payment_reference: String(payment.preference_id ?? payment.id),
      paid_at: new Date().toISOString()
    }, { onConflict: 'user_id,course_id' });
    if (error) return Response.json({ error: 'Enrollment update failed' }, { status: 500 });
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: 'Invalid notification' }, { status: 400 });
  }
});
