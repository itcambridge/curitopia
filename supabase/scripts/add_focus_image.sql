-- Optional focus image for one exploration.
-- The file lives in the private exploration-images bucket.
-- explorations.focus_image_path stores that object's path, not the image bytes.
-- Run this in the hosted Supabase SQL Editor. The application does not apply it.

alter table public.explorations
  add column if not exists focus_image_path text;

alter table public.explorations
  drop constraint if exists explorations_focus_image_path_check;

alter table public.explorations
  add constraint explorations_focus_image_path_check
  check (
    focus_image_path is null
    or (
      focus_image_path = btrim(focus_image_path)
      and split_part(focus_image_path, '/', 1) = user_id::text
      and split_part(focus_image_path, '/', 2) = id::text
      and focus_image_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpeg|webp)$'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'exploration-images', 'exploration-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']
where not exists (select 1 from storage.buckets where id = 'exploration-images');

create or replace function public.exploration_image_owner(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = public, storage
as $$
  select
    (storage.foldername(object_name))[1] = (select auth.uid()::text)
    and exists (
      select 1
      from public.explorations
      where explorations.user_id = (select auth.uid())
        and explorations.id::text = (storage.foldername(object_name))[2]
    );
$$;

revoke all on function public.exploration_image_owner(text) from public, anon;
grant execute on function public.exploration_image_owner(text) to authenticated;

drop policy if exists exploration_images_select on storage.objects;
drop policy if exists exploration_images_insert on storage.objects;
drop policy if exists exploration_images_update on storage.objects;
drop policy if exists exploration_images_delete on storage.objects;

create policy exploration_images_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'exploration-images'
  and public.exploration_image_owner(name)
);

create policy exploration_images_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'exploration-images'
  and public.exploration_image_owner(name)
);

create policy exploration_images_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'exploration-images'
  and public.exploration_image_owner(name)
)
with check (
  bucket_id = 'exploration-images'
  and public.exploration_image_owner(name)
);

create policy exploration_images_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'exploration-images'
  and public.exploration_image_owner(name)
);
