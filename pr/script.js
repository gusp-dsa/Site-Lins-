const button = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
button?.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  button.setAttribute('aria-expanded', isOpen);
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  button.setAttribute('aria-expanded', 'false');
}));

const calendarDays = document.querySelector('#calendar-days'), monthLabel = document.querySelector('#month-label');
const dateLabel = document.querySelector('#selected-date'), availabilityCopy = document.querySelector('#availability-copy');
const timeSlots = document.querySelector('#time-slots'), bookingForm = document.querySelector('#booking-form');
const whatsappButton = document.querySelector('#booking-whatsapp'), nameInput = document.querySelector('#student-name'), phoneInput = document.querySelector('#student-phone'), instrumentInput = document.querySelector('#instrument');
const config = window.COURSE_CONFIG;
const supabaseConfigured = config && !config.supabaseUrl.startsWith('COLE_') && !config.supabaseAnonKey.startsWith('COLE_');
const whatsappConfigured = /^\d{12,13}$/.test(config?.whatsappNumber ?? '');
let supabase;
if (supabaseConfigured) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
}
let monthCursor = new Date(), selectedDay = null, selectedTime = null;
monthCursor.setDate(1);
const slots = ['09:00','10:30','14:00','15:30','17:00','18:30'];
const dayFormat = new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}), monthFormat = new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'});
const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const slotsFor = d => slots.filter((_,index) => (d.getDate()+index*2)%5 !== 0);
function bookingMessage(){const name=nameInput.value.trim()||'Olá';return `Olá, Jonas! Meu nome é ${name}. Quero agendar uma aula experimental de ${instrumentInput.value} no dia ${dayFormat.format(selectedDay)}, às ${selectedTime}.`;}
function updateLink(){if(!selectedDay||!selectedTime)return;whatsappButton.href=whatsappConfigured?`https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(bookingMessage())}`:'#';}
function showSlots(date){selectedDay=date;selectedTime=null;bookingForm.hidden=true;dateLabel.textContent=dayFormat.format(date);const available=slotsFor(date);availabilityCopy.textContent=available.length?'Escolha um dos horários livres:':'Não há horários livres neste dia. Tente outra data.';timeSlots.replaceChildren(...available.map(time=>{const el=document.createElement('button');el.type='button';el.className='time-slot';el.textContent=time;el.addEventListener('click',()=>{document.querySelectorAll('.time-slot').forEach(item=>item.classList.remove('selected'));el.classList.add('selected');selectedTime=time;bookingForm.hidden=false;updateLink();});return el;}));renderCalendar();}
function renderCalendar(){const today=new Date();today.setHours(0,0,0,0);const year=monthCursor.getFullYear(),month=monthCursor.getMonth(),firstDay=new Date(year,month,1).getDay(),totalDays=new Date(year,month+1,0).getDate();monthLabel.textContent=monthFormat.format(monthCursor);calendarDays.replaceChildren(...Array.from({length:firstDay},()=>Object.assign(document.createElement('span'),{className:'calendar-empty'})));for(let day=1;day<=totalDays;day++){const date=new Date(year,month,day);date.setHours(0,0,0,0);const available=slotsFor(date).length;const el=document.createElement('button');el.type='button';el.textContent=day;el.className=`calendar-day${available?' available':''}`;el.disabled=date<today||!available;if(selectedDay&&dayKey(selectedDay)===dayKey(date))el.classList.add('selected');el.addEventListener('click',()=>showSlots(date));calendarDays.appendChild(el);}}
document.querySelector('#previous-month')?.addEventListener('click',()=>{monthCursor.setMonth(monthCursor.getMonth()-1);renderCalendar();});
document.querySelector('#next-month')?.addEventListener('click',()=>{monthCursor.setMonth(monthCursor.getMonth()+1);renderCalendar();});
nameInput?.addEventListener('input',updateLink);instrumentInput?.addEventListener('change',updateLink);renderCalendar();
whatsappButton?.addEventListener('click',async event=>{
  event.preventDefault();
  if(!selectedDay||!selectedTime)return alert('Escolha uma data e um horario.');
  const studentName=nameInput.value.trim(),studentPhone=phoneInput.value.trim();
  if(!studentName||!studentPhone)return alert('Informe seu nome e WhatsApp.');
  if(!supabaseConfigured)return alert('O agendamento sera ativado assim que o Supabase for configurado.');
  if(!whatsappConfigured)return alert('Configure o numero do WhatsApp em course-config.js.');
  const [hours,minutes]=selectedTime.split(':').map(Number);
  const startsAt=new Date(selectedDay);startsAt.setHours(hours,minutes,0,0);
  whatsappButton.setAttribute('aria-disabled','true');
  whatsappButton.textContent='Salvando agendamento...';
  const {error}=await supabase.from('bookings').insert({student_name:studentName,student_phone:studentPhone,instrument:instrumentInput.value,starts_at:startsAt.toISOString()});
  if(error){whatsappButton.removeAttribute('aria-disabled');whatsappButton.innerHTML='Confirmar no WhatsApp <b>↗</b>';return alert('Nao foi possivel salvar o agendamento. Tente novamente.');}
  window.location.href=`https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(bookingMessage())}`;
});
