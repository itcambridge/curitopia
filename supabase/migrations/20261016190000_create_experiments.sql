-- Experiments linked to one exploration and one question.
-- This file is a forward-only migration. It does not edit explorations or questions.
-- It does not create a storage bucket. Concept thumbnails are a later phase.
-- Question and exploration deletes are restricted while an experiment depends on them,
-- so experimental work is not removed as a side effect of deleting a question.
-- Apply the same statements from supabase/scripts/create_experiments.sql in the hosted SQL Editor.
-- Do not run this file automatically from the application.

create table public.experiments (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete restrict,
  exploration_id uuid not null references public.explorations (id) on delete restrict,
  question_id uuid not null references public.questions (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experiments_one_question unique (question_id)
);

create index experiments_exploration_idx
  on public.experiments (exploration_id);

create index experiments_user_idx
  on public.experiments (user_id);

create table public.experiment_items (
  id uuid primary key,
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  position integer not null,
  kind text not null,
  body text not null,
  related_item_id uuid references public.experiment_items (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experiment_items_position_check check (position >= 0),
  constraint experiment_items_position_unique unique (experiment_id, position),
  constraint experiment_items_kind_check check (
    kind in ('concept', 'note', 'hypothesis', 'test', 'observation', 'discovery')
  ),
  constraint experiment_items_body_check check (
    body = btrim(body)
    and char_length(body) between 1 and 2000
  ),
  constraint experiment_items_not_self check (related_item_id is null or related_item_id <> id)
);

create index experiment_items_experiment_idx
  on public.experiment_items (experiment_id, position);

create or replace function public.experiments_match_origin()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner uuid;
  question_exploration uuid;
begin
  if tg_op = 'UPDATE' and (
    new.user_id is distinct from old.user_id
    or new.exploration_id is distinct from old.exploration_id
    or new.question_id is distinct from old.question_id
  ) then
    raise exception 'experiment origin cannot change' using errcode = '23514';
  end if;

  select explorations.user_id
    into owner
  from public.explorations
  where explorations.id = new.exploration_id;

  if owner is null or owner <> new.user_id then
    raise exception 'experiment owner must match the exploration' using errcode = '23514';
  end if;

  select questions.exploration_id
    into question_exploration
  from public.questions
  where questions.id = new.question_id;

  if question_exploration is null or question_exploration <> new.exploration_id then
    raise exception 'experiment question must belong to the exploration' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger experiments_match_origin
before insert or update on public.experiments
for each row
execute function public.experiments_match_origin();

create or replace function public.assign_experiment_item_position()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform 1
  from public.experiments
  where id = new.experiment_id
  for update;

  select coalesce(max(experiment_items.position) + 1, 0)
    into new.position
  from public.experiment_items
  where experiment_items.experiment_id = new.experiment_id;

  return new;
end;
$$;

create trigger experiment_items_assign_position
before insert on public.experiment_items
for each row
execute function public.assign_experiment_item_position();

create or replace function public.experiment_items_match_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_experiment uuid;
  cursor_id uuid;
  depth integer := 0;
begin
  if tg_op = 'UPDATE' and new.experiment_id is distinct from old.experiment_id then
    raise exception 'experiment item cannot move between experiments' using errcode = '23514';
  end if;

  if new.related_item_id is null then
    return new;
  end if;

  select experiment_items.experiment_id
    into parent_experiment
  from public.experiment_items
  where experiment_items.id = new.related_item_id;

  if parent_experiment is null or parent_experiment <> new.experiment_id then
    raise exception 'related item must belong to the same experiment' using errcode = '23514';
  end if;

  cursor_id := new.related_item_id;
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'experiment items cannot form a cycle' using errcode = '23514';
    end if;
    depth := depth + 1;
    if depth > 32 then
      raise exception 'experiment item link is too deep' using errcode = '23514';
    end if;
    select experiment_items.related_item_id
      into cursor_id
    from public.experiment_items
    where experiment_items.id = cursor_id;
  end loop;

  return new;
end;
$$;

create trigger experiment_items_match_parent
before insert or update on public.experiment_items
for each row
execute function public.experiment_items_match_parent();

alter table public.experiments enable row level security;
alter table public.experiments force row level security;
alter table public.experiment_items enable row level security;
alter table public.experiment_items force row level security;

create policy experiments_select on public.experiments
for select to authenticated
using (user_id = (select auth.uid()));

create policy experiments_insert on public.experiments
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy experiments_update on public.experiments
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy experiments_delete on public.experiments
for delete to authenticated
using (user_id = (select auth.uid()));

create policy experiment_items_select on public.experiment_items
for select to authenticated
using (
  exists (
    select 1
    from public.experiments
    where experiments.id = experiment_items.experiment_id
      and experiments.user_id = (select auth.uid())
  )
);

create policy experiment_items_insert on public.experiment_items
for insert to authenticated
with check (
  exists (
    select 1
    from public.experiments
    where experiments.id = experiment_items.experiment_id
      and experiments.user_id = (select auth.uid())
  )
);

create policy experiment_items_update on public.experiment_items
for update to authenticated
using (
  exists (
    select 1
    from public.experiments
    where experiments.id = experiment_items.experiment_id
      and experiments.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.experiments
    where experiments.id = experiment_items.experiment_id
      and experiments.user_id = (select auth.uid())
  )
);

create policy experiment_items_delete on public.experiment_items
for delete to authenticated
using (
  exists (
    select 1
    from public.experiments
    where experiments.id = experiment_items.experiment_id
      and experiments.user_id = (select auth.uid())
  )
);

revoke all on table public.experiments from public, anon, service_role;
revoke all on table public.experiment_items from public, anon, service_role;
grant select, insert, update, delete on public.experiments to authenticated;
grant select, insert, update, delete on public.experiment_items to authenticated;

revoke all on function public.experiments_match_origin() from public, anon, service_role;
revoke all on function public.assign_experiment_item_position() from public, anon, service_role;
revoke all on function public.experiment_items_match_parent() from public, anon, service_role;
revoke all on function public.experiments_match_origin()
  from public, anon, authenticated, service_role;

revoke all on function public.assign_experiment_item_position()
  from public, anon, authenticated, service_role;

revoke all on function public.experiment_items_match_parent()
  from public, anon, authenticated, service_role;
