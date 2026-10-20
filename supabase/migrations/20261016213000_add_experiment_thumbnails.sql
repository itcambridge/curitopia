-- Optional thumbnail for one concept inside an experiment.
-- The file lives in the private experiment-thumbnails bucket.
-- experiment_items.image_path stores that object's path, not the image bytes.
-- This migration is not applied automatically.
-- Paste supabase/scripts/add_experiment_thumbnails.sql into the hosted SQL Editor.

alter table public.experiment_items
  add column if not exists image_path text;

alter table public.experiment_items
  drop constraint if exists experiment_items_image_path_check;

alter table public.experiment_items
  add constraint experiment_items_image_path_check
  check (
    image_path is null
    or (
      kind = 'concept'
      and image_path = btrim(image_path)
      and split_part(image_path, '/', 2) = experiment_id::text
      and split_part(image_path, '/', 3) = id::text
      and image_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
  );

create or replace function public.experiment_item_image_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner uuid;
begin
  if new.image_path is null then
    return new;
  end if;

  select experiments.user_id
    into owner
  from public.experiments
  where experiments.id = new.experiment_id;

  if owner is null or split_part(new.image_path, '/', 1) <> owner::text then
    raise exception 'thumbnail path must belong to the experiment owner' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists experiment_items_image_owner on public.experiment_items;

create trigger experiment_items_image_owner
  before insert or update on public.experiment_items
  for each row
  execute function public.experiment_item_image_owner();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'experiment-thumbnails', 'experiment-thumbnails', false, 153600, array['image/webp']
where not exists (select 1 from storage.buckets where id = 'experiment-thumbnails');

create or replace function public.experiment_thumbnail_owner(object_name text)
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
      from public.experiments
      where experiments.user_id = (select auth.uid())
        and experiments.id::text = (storage.foldername(object_name))[2]
    )
    and exists (
      select 1
      from public.experiment_items
      join public.experiments on experiments.id = experiment_items.experiment_id
      where experiments.user_id = (select auth.uid())
        and experiment_items.experiment_id::text = (storage.foldername(object_name))[2]
        and experiment_items.id::text = (storage.foldername(object_name))[3]
        and experiment_items.kind = 'concept'
    );
$$;

revoke all on function public.experiment_thumbnail_owner(text) from public, anon;
grant execute on function public.experiment_thumbnail_owner(text) to authenticated;

drop policy if exists experiment_thumbnails_select on storage.objects;
drop policy if exists experiment_thumbnails_insert on storage.objects;
drop policy if exists experiment_thumbnails_update on storage.objects;
drop policy if exists experiment_thumbnails_delete on storage.objects;

create policy experiment_thumbnails_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'experiment-thumbnails'
  and public.experiment_thumbnail_owner(name)
);

create policy experiment_thumbnails_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'experiment-thumbnails'
  and public.experiment_thumbnail_owner(name)
);

create policy experiment_thumbnails_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'experiment-thumbnails'
  and public.experiment_thumbnail_owner(name)
)
with check (
  bucket_id = 'experiment-thumbnails'
  and public.experiment_thumbnail_owner(name)
);

create policy experiment_thumbnails_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'experiment-thumbnails'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.experiments
    where experiments.user_id = (select auth.uid())
      and experiments.id::text = (storage.foldername(name))[2]
  )
);
