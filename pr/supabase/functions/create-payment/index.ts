import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = request.headers.get('Authorization') ?? '';
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Faça login antes de continuar.');

    const { courseSlug } = await request.json();
    const { data: course, error: courseError } = await supabase.from('courses').select('id,title,price_cents').eq('slug', courseSlug).eq('is_published', true).single();
    if (courseError || !course) throw new Error('Curso não encontrado.');
    const { data: existing } = await supabase.from('enrollments').select('id,status').eq('user_id', user.id).eq('course_id', course.id).maybeSingle();
    if (existing?.status === 'active') throw new Error('Você já possui acesso a este curso.');

    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    const siteUrl = Deno.env.get('SITE_URL');
    if (!accessToken || !siteUrl) throw new Error('Pagamento ainda não foi configurado.');

    const preference = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ title: course.title, quantity: 1, currency_id: 'BRL', unit_price: course.price_cents / 100 }],
        payer: { email: user.email }, external_reference: `${user.id}:${course.id}`,
        back_urls: { success: `${siteUrl}/curso.html?payment=success`, failure: `${siteUrl}/curso.html?payment=failure`, pending: `${siteUrl}/curso.html?payment=pending` }, auto_return: 'approved',
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`
      })
    });
    const result = await preference.json();
    if (!preference.ok) throw new Error(result.message ?? 'Não foi possível iniciar o pagamento.');
    if (!existing) await supabase.from('enrollments').insert({ user_id: user.id, course_id: course.id, status: 'pending', payment_provider: 'mercado_pago', payment_reference: String(result.id) });
    return Response.json({ checkoutUrl: result.init_point }, { headers: cors });
  } catch (error) { return Response.json({ error: error.message }, { status: 400, headers: cors }); }
});
