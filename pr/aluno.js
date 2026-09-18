const config = window.COURSE_CONFIG;
const panel = document.querySelector('#student-courses');
const message = document.querySelector('#access-message');
const configured = config && !config.supabaseUrl.startsWith('COLE_') && !config.supabaseAnonKey.startsWith('COLE_');

const text = (tag, value, className) => {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  return element;
};

if (!configured) {
  message.textContent = 'A área do aluno será ativada quando o Supabase for configurado.';
} else {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) window.location.replace('curso.html');
  else {
    document.querySelector('#student-name').textContent = user.user_metadata.full_name || user.email.split('@')[0];
    const { data: enrollments, error: enrollmentError } = await supabase.from('enrollments').select('status,courses(id,title,slug)').eq('user_id', user.id).eq('status', 'active');
    if (enrollmentError) message.textContent = 'Não foi possível carregar seus cursos agora.';
    else if (!enrollments?.length) message.textContent = 'Você ainda não possui cursos liberados. Assim que o pagamento for aprovado, eles aparecerão aqui.';
    else {
      message.textContent = 'Seus cursos e aulas liberados:';
      const courseIds = enrollments.map(item => item.courses.id);
      const { data: modules } = await supabase.from('modules').select('course_id,position,title,description,video_url').in('course_id', courseIds).eq('is_published', true).order('position');
      for (const enrollment of enrollments) {
        const article = document.createElement('article');
        article.className = 'student-course';
        article.append(text('span', 'ACESSO LIBERADO'), text('h2', enrollment.courses.title));
        const list = document.createElement('div');
        list.className = 'lesson-list';
        const lessons = (modules ?? []).filter(item => item.course_id === enrollment.courses.id);
        for (const lesson of lessons) {
          const lessonElement = document.createElement('section');
          lessonElement.className = 'lesson';
          lessonElement.append(text('small', `MÓDULO ${String(lesson.position).padStart(2, '0')}`), text('h3', lesson.title), text('p', lesson.description || ''));
          if (lesson.video_url) {
            let videoUrl = lesson.video_url;
            if (!/^https?:\/\//i.test(videoUrl)) {
              const { data: signed } = await supabase.storage.from('course-videos').createSignedUrl(videoUrl, 3600);
              videoUrl = signed?.signedUrl;
            }
            if (videoUrl) {
              const link = text('a', 'Assistir aula →');
              link.href = videoUrl;
              link.target = '_blank';
              link.rel = 'noopener';
              lessonElement.append(link);
            }
          } else lessonElement.append(text('small', 'Vídeo em preparação'));
          list.append(lessonElement);
        }
        if (!lessons.length) list.append(text('p', 'As aulas serão publicadas em breve.'));
        article.append(list);
        panel.append(article);
      }
    }
  }
  document.querySelector('#logout').addEventListener('click', async () => { await supabase.auth.signOut(); window.location.replace('curso.html'); });
}
