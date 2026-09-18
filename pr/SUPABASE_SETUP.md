# Como ativar o backend

1. Crie um projeto no Supabase usando o e-mail `jonas.guita.jazz@gmail.com`.
2. Em **SQL Editor**, execute o arquivo `supabase/migrations/20260826_initial_schema.sql`.
3. Em **Authentication > Providers**, habilite Email e mantenha a confirmação de e-mail ativa. Em **URL Configuration**, cadastre a URL do site e permita `https://seu-dominio/curso.html**` como redirect.
4. Depois de Jonas criar a conta, execute o comando comentado no fim da migration para torná-lo professor.
5. Copie a **Project URL** e a **publishable key** em **Project Settings > API** para `course-config.js`; preencha também `whatsappNumber` apenas com números, incluindo DDI e DDD.
6. Instale e faça login no Supabase CLI; depois publique as funções:
   ```bash
   supabase functions deploy create-payment
   supabase functions deploy payment-webhook
   ```
7. Em **Edge Functions > Secrets**, cadastre `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET` e `SITE_URL`. A service role é disponibilizada pelo Supabase para a função; nunca a coloque no frontend.
8. No Mercado Pago, configure o Webhook para `/functions/v1/payment-webhook`, habilite o evento Pagamentos e copie a assinatura secreta para `MERCADO_PAGO_WEBHOOK_SECRET`.

O bucket privado `course-videos` e as políticas de acesso são criados pelas migrations. Vídeos enviados pelo painel do professor recebem URLs assinadas de uma hora e só podem ser solicitados por professores ou alunos com matrícula ativa.

O site precisa ser publicado (Vercel, Netlify ou outro host) para login por e-mail e retorno do pagamento funcionarem corretamente.
