insert into storage.buckets (id, name, public)
values ('course-videos', 'course-videos', false)
on conflict (id) do update set public = false;

create policy "course videos: enrolled students read"
on storage.objects for select to authenticated
using (
  bucket_id = 'course-videos'
  and (
    public.is_teacher()
    or exists (
      select 1
      from public.enrollments e
      join public.courses c on c.id = e.course_id
      where e.user_id = auth.uid()
        and e.status = 'active'
        and c.slug = (storage.foldername(name))[1]
    )
  )
);

create policy "course videos: teacher inserts"
on storage.objects for insert to authenticated
with check (bucket_id = 'course-videos' and public.is_teacher());

create policy "course videos: teacher updates"
on storage.objects for update to authenticated
using (bucket_id = 'course-videos' and public.is_teacher())
with check (bucket_id = 'course-videos' and public.is_teacher());

create policy "course videos: teacher deletes"
on storage.objects for delete to authenticated
using (bucket_id = 'course-videos' and public.is_teacher());
