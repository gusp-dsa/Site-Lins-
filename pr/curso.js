const modules = [
  ['01','Primeiros sons','Conheça a guitarra, afinação e postura.'],['02','Acordes essenciais','Os acordes que abrem um universo de músicas.'],['03','Ritmo e levadas','Faça os acordes soarem como música.'],['04','Seu primeiro repertório','Aprenda canções do começo ao fim.'],['05','Escalas sem mistério','Encontre notas e comece a improvisar.'],['06','Técnica que funciona','Palhetada, digitação e independência.'],['07','Harmonia prática','Entenda por que as músicas soam bem.'],['08','Riffs e solos','Construa frases que têm a sua cara.'],['09','Tocando com outros','Tempo, dinâmica e presença musical.'],['10','Seu próximo capítulo','Monte sua rotina e continue evoluindo.']
];
document.querySelector('#module-list').innerHTML = modules.map(([number,title,description]) => `<article class="module"><span class="module-num">${number}</span><div><h3>${title}</h3><p>${description}</p></div><span>aulas</span></article>`).join('');

const modal = document.querySelector('#auth-modal');
const loginView = document.querySelector('#login-view');
const checkoutView = document.querySelector('#checkout-view');
const paymentButton = document.querySelector('#payment-button');
const show = view => { loginView.hidden = view !== 'login'; checkoutView.hidden = view !== 'checkout'; modal.showModal(); };
document.querySelectorAll('.login-trigger').forEach(button => button.addEventListener('click', () => show('login')));
document.querySelectorAll('.enroll-trigger,.show-checkout').forEach(button => button.addEventListener('click', () => show('checkout')));
document.querySelector('.show-login').addEventListener('click', () => show('login'));
document.querySelector('.close').addEventListener('click', () => modal.close());

const config = window.COURSE_CONFIG;
const configured = config && !config.supabaseUrl.startsWith('COLE_') && !config.supabaseAnonKey.startsWith('COLE_');
const pendingKey = 'pending-course-checkout';
const message = text => alert(text);
let supabase;
let checkoutStarted = false;

if (configured) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
}

async function continueCheckout() {
  if (checkoutStarted) return;
  checkoutStarted = true;
  paymentButton.disabled = true;
  paymentButton.textContent = 'Abrindo pagamento...';
  const { data, error } = await supabase.functions.invoke('create-payment', { body: { courseSlug: config.courseSlug } });
  if (error || !data?.checkoutUrl) {
    checkoutStarted = false;
    paymentButton.disabled = false;
    paymentButton.innerHTML = 'Ir para pagamento <b>↗</b>';
    return message(data?.error || error?.message || 'Não foi possível iniciar o pagamento.');
  }
  localStorage.removeItem(pendingKey);
  window.location.href = data.checkoutUrl;
}

document.querySelector('#login-button').addEventListener('click', async () => {
  if (!configured) return message('O login será ativado assim que as chaves do Supabase forem cadastradas.');
  const inputs = loginView.querySelectorAll('input');
  const { error } = await supabase.auth.signInWithPassword({ email: inputs[0].value.trim(), password: inputs[1].value });
  if (error) return message('E-mail ou senha inválidos.');
  if (localStorage.getItem(pendingKey) === config.courseSlug) return continueCheckout();
  window.location.href = 'aluno.html';
});

paymentButton.addEventListener('click', async () => {
  if (!configured) return message('O pagamento será ativado assim que as chaves do Supabase forem cadastradas.');
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    localStorage.setItem(pendingKey, config.courseSlug);
    return continueCheckout();
  }

  const inputs = checkoutView.querySelectorAll('input');
  const fullName = inputs[0].value.trim();
  const email = inputs[1].value.trim();
  const password = inputs[2].value;
  if (!fullName || !email || password.length < 6) return message('Preencha nome, e-mail e uma senha com pelo menos 6 caracteres.');
  localStorage.setItem(pendingKey, config.courseSlug);
  const emailRedirectTo = new URL('curso.html?checkout=resume', window.location.href).href;
  const { data: signup, error: signupError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo } });
  if (signupError) return message(signupError.message);
  if (signup.session) return continueCheckout();
  if (signup.user?.identities?.length === 0) {
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) return message('Esta conta já existe. Confira a senha ou use “Fazer login”.');
    return continueCheckout();
  }
  message('Conta criada. Confirme o e-mail enviado; ao voltar ao site, o pagamento continuará automaticamente.');
});

if (configured) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') message('Pagamento recebido. A liberação aparecerá na área do aluno após a confirmação do Mercado Pago.');
  else if (params.get('payment') === 'pending') message('Pagamento pendente. Avisaremos assim que for aprovado.');
  else if (params.get('payment') === 'failure') message('O pagamento não foi concluído. Você pode tentar novamente.');

  const { data: { session } } = await supabase.auth.getSession();
  if (session && localStorage.getItem(pendingKey) === config.courseSlug && params.get('checkout') === 'resume') await continueCheckout();
}
