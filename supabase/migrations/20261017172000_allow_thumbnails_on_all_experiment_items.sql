-- Allow the existing experiment thumbnail on every item type.
-- The applied thumbnail migration limited image_path and storage ownership to concepts.
-- This does not recreate experiment_items, the private bucket, or the storage policies.
-- Paste supabase/scripts/allow_thumbnails_on_all_experiment_items.sql into the hosted SQL Editor.
-- This migration is not applied automatically.

alter table public.experiment_items
  drop constraint if exists experiment_items_image_path_check;

alter table public.experiment_items
  add constraint experiment_items_image_path_check
  check (
    image_path is null
    or (
      kind in ('concept', 'note', 'hypothesis', 'test', 'observation', 'discovery')
      and image_path = btrim(image_path)
      and split_part(image_path, '/', 2) = experiment_id::text
      and split_part(image_path, '/', 3) = id::text
      and image_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
  );

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
        and experiment_items.kind in ('concept', 'note', 'hypothesis', 'test', 'observation', 'discovery')
    );
$$;

revoke all on function public.experiment_thumbnail_owner(text) from public, anon;
grant execute on function public.experiment_thumbnail_owner(text) to authenticated;
