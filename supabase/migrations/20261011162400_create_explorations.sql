-- Persistent explorations and questions.
-- Node colour and map coordinates are not stored; the application derives them.
-- This migration does not grant the service role access and does not read a service-role key.
--
-- Atomic create:
--   public.create_exploration_with_first_question(...) inserts the exploration and its
--   first question in one statement. The owner is auth.uid(). A deferred constraint
--   rejects any commit that leaves an exploration with no questions.
--
-- Later writes, once the application is connected, run as the signed-in user:
--   insert into public.questions (id, exploration_id, question_text, role, perspective_origin)
--     values (...);  -- omit position; the insert trigger assigns max(position)+1
--   update public.explorations set title = ... where id = ...;
--   update public.explorations set mode = ... where id = ...;
--   update public.explorations set status = 'completed' where id = ...;
--     -- ended_at is set to the server time on that transition
--   update public.questions set is_prioritised = ... where id = ...;
--     -- allowed only after the parent exploration is completed
--   delete from public.explorations where id = ...;
--     -- questions are removed by the foreign key
-- A repeated insert of an existing question id fails on the primary key. The application
-- treats that conflict as a successful retry and reloads the row.

create table public.explorations (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  mode text not null,
  status text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint explorations_mode_check check (mode in ('quickfire', 'focus')),
  constraint explorations_status_check check (status in ('active', 'completed')),
  constraint explorations_title_check check (
    title is null
    or (
      title = btrim(title)
      and char_length(title) between 1 and 120
    )
  ),
  constraint explorations_completion_check check (
    (status = 'active' and ended_at is null)
    or (status = 'completed' and ended_at is not null)
  )
);

create index explorations_user_updated_idx
  on public.explorations (user_id, updated_at desc);

create table public.questions (
  id uuid primary key,
  exploration_id uuid not null references public.explorations (id) on delete cascade,
  position integer not null,
  question_text text not null,
  role text not null,
  is_prioritised boolean not null default false,
  perspective_origin text,
  created_at timestamptz not null default now(),
  constraint questions_position_check check (position >= 0),
  constraint questions_position_unique unique (exploration_id, position),
  constraint questions_text_check check (
    question_text = btrim(question_text)
    and char_length(question_text) between 1 and 2000
  ),
  constraint questions_role_check check (role in ('central', 'satellite')),
  constraint questions_origin_check check (
    perspective_origin is null
    or perspective_origin in ('investigate', 'reframe', 'connect', 'challenge')
  )
);

create unique index questions_one_central
  on public.questions (exploration_id)
  where role = 'central';

create or replace function public.assign_question_position()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Ignore a client-supplied position so order is allocated with the insert.
  -- The unique constraint still rejects a colliding update or a concurrent insert.
  perform 1
  from public.explorations
  where id = new.exploration_id
  for update;

  select coalesce(max(questions.position) + 1, 0)
    into new.position
  from public.questions
  where questions.exploration_id = new.exploration_id;

  return new;
end;
$$;

create trigger questions_assign_position
before insert on public.questions
for each row
execute function public.assign_question_position();

create or replace function public.validate_question_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_mode text;
  parent_status text;
begin
  select explorations.mode, explorations.status
    into parent_mode, parent_status
  from public.explorations
  where explorations.id = new.exploration_id;

  if parent_mode is null then
    raise exception 'exploration not found' using errcode = '23503';
  end if;

  if tg_op = 'UPDATE' and new.exploration_id is distinct from old.exploration_id then
    raise exception 'a question cannot move to another exploration' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and parent_mode = 'quickfire' and new.role is distinct from 'satellite' then
    raise exception 'quickfire questions are satellites' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and parent_mode = 'focus' and not exists (
    select 1
    from public.questions
    where questions.exploration_id = new.exploration_id
      and questions.role = 'central'
      and questions.id is distinct from new.id
  ) and new.role is distinct from 'central' then
    raise exception 'the first focus question must be central' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and parent_mode = 'focus' and exists (
    select 1
    from public.questions
    where questions.exploration_id = new.exploration_id
      and questions.role = 'central'
      and questions.id is distinct from new.id
  ) and new.role is distinct from 'satellite' then
    raise exception 'later focus questions are satellites' using errcode = '23514';
  end if;

  if parent_mode = 'quickfire' and new.perspective_origin is not null then
    if tg_op = 'INSERT' or new.perspective_origin is distinct from old.perspective_origin then
      raise exception 'quickfire questions cannot have a perspective origin' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' and new.is_prioritised then
    raise exception 'new questions are not prioritised' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and new.is_prioritised is distinct from old.is_prioritised
     and parent_status is distinct from 'completed' then
    raise exception 'priority can change only after the exploration is completed' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger questions_validate_rules
before insert or update on public.questions
for each row
execute function public.validate_question_rules();

create or replace function public.protect_exploration_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'exploration owner cannot be changed' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.status = 'completed' and new.status is distinct from 'completed' then
    raise exception 'a completed exploration stays completed' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.status = 'active' and new.status = 'completed' then
    new.ended_at := now();
  elsif new.status = 'completed' and new.ended_at is null then
    new.ended_at := coalesce(old.ended_at, now());
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

create trigger explorations_protect_row
before update on public.explorations
for each row
execute function public.protect_exploration_row();

create or replace function public.touch_exploration_from_question()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.explorations
  set updated_at = now()
  where explorations.id = new.exploration_id;

  return new;
end;
$$;

create trigger questions_touch_exploration
after insert or update on public.questions
for each row
execute function public.touch_exploration_from_question();

create or replace function public.enforce_exploration_has_question()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if tg_table_name = 'explorations' then
    target := coalesce(new.id, old.id);
  elsif tg_table_name = 'questions' then
    target := coalesce(new.exploration_id, old.exploration_id);
  else
    raise exception 'exploration check used on an unexpected table' using errcode = '55000';
  end if;

  if exists (select 1 from public.explorations where explorations.id = target)
     and not exists (
       select 1 from public.questions where questions.exploration_id = target
     ) then
    raise exception 'exploration must contain at least one question' using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger explorations_require_question
after insert on public.explorations
deferrable initially deferred
for each row
execute function public.enforce_exploration_has_question();

create constraint trigger questions_keep_exploration_nonempty
after delete on public.questions
deferrable initially deferred
for each row
execute function public.enforce_exploration_has_question();

create or replace function public.create_exploration_with_first_question(
  p_exploration_id uuid,
  p_question_id uuid,
  p_mode text,
  p_question_text text,
  p_role text,
  p_title text default null,
  p_perspective_origin text default null
)
returns public.explorations
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid := auth.uid();
  clean_title text;
  clean_text text;
  created public.explorations;
begin
  if owner is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_mode is null or p_mode not in ('quickfire', 'focus') then
    raise exception 'invalid mode' using errcode = '23514';
  end if;

  if p_role is null or p_role not in ('central', 'satellite') then
    raise exception 'invalid role' using errcode = '23514';
  end if;

  if p_mode = 'focus' and p_role is distinct from 'central' then
    raise exception 'the first focus question must be central' using errcode = '23514';
  end if;

  if p_mode = 'quickfire' and p_role is distinct from 'satellite' then
    raise exception 'quickfire questions are satellites' using errcode = '23514';
  end if;

  if p_perspective_origin is not null
     and p_perspective_origin not in ('investigate', 'reframe', 'connect', 'challenge') then
    raise exception 'invalid perspective origin' using errcode = '23514';
  end if;

  if p_mode = 'quickfire' and p_perspective_origin is not null then
    raise exception 'quickfire questions cannot have a perspective origin' using errcode = '23514';
  end if;

  clean_text := btrim(p_question_text);
  if clean_text is null or char_length(clean_text) < 1 or char_length(clean_text) > 2000 then
    raise exception 'invalid question text' using errcode = '23514';
  end if;

  if p_title is null or btrim(p_title) = '' then
    clean_title := null;
  else
    clean_title := btrim(p_title);
    if char_length(clean_title) > 120 then
      raise exception 'invalid title' using errcode = '23514';
    end if;
  end if;

  insert into public.explorations (id, user_id, title, mode, status)
  values (p_exploration_id, owner, clean_title, p_mode, 'active');

  insert into public.questions (
    id,
    exploration_id,
    question_text,
    role,
    perspective_origin,
    is_prioritised
  )
  values (
    p_question_id,
    p_exploration_id,
    clean_text,
    p_role,
    p_perspective_origin,
    false
  );

  select explorations.*
    into created
  from public.explorations
  where explorations.id = p_exploration_id;

  return created;
end;
$$;

comment on function public.create_exploration_with_first_question(uuid, uuid, text, text, text, text, text) is
  'Creates one exploration and its first question in a single statement. '
  'Permissions: SECURITY INVOKER; EXECUTE is granted only to authenticated and revoked from public, anon, and service_role. '
  'Ownership comes from auth.uid(), never from an argument. '
  'Validation: mode is quickfire or focus; the first Focus question is central; a Quickfire question is a satellite with no perspective origin; '
  'origin is null or investigate, reframe, connect, or challenge; trimmed question text is 1 to 2000 characters; '
  'a title is omitted or trimmed to 1 to 120 characters; status is active and is_prioritised is false. '
  'Position is assigned by the insert trigger. A failure rolls the statement back, so neither row remains.';

alter table public.explorations enable row level security;
alter table public.explorations force row level security;
alter table public.questions enable row level security;
alter table public.questions force row level security;

create policy explorations_select
on public.explorations
for select
to authenticated
using (user_id = (select auth.uid()));

create policy explorations_insert
on public.explorations
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy explorations_update
on public.explorations
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy explorations_delete
on public.explorations
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy questions_select
on public.questions
for select
to authenticated
using (
  exists (
    select 1
    from public.explorations
    where explorations.id = questions.exploration_id
      and explorations.user_id = (select auth.uid())
  )
);

create policy questions_insert
on public.questions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.explorations
    where explorations.id = questions.exploration_id
      and explorations.user_id = (select auth.uid())
  )
);

create policy questions_update
on public.questions
for update
to authenticated
using (
  exists (
    select 1
    from public.explorations
    where explorations.id = questions.exploration_id
      and explorations.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.explorations
    where explorations.id = questions.exploration_id
      and explorations.user_id = (select auth.uid())
  )
);

create policy questions_delete
on public.questions
for delete
to authenticated
using (
  exists (
    select 1
    from public.explorations
    where explorations.id = questions.exploration_id
      and explorations.user_id = (select auth.uid())
  )
);

revoke all on table public.explorations from public, anon, service_role;
revoke all on table public.questions from public, anon, service_role;
grant select, insert, update, delete on public.explorations to authenticated;
grant select, insert, update, delete on public.questions to authenticated;

revoke all on function public.assign_question_position() from public, anon, service_role;
revoke all on function public.validate_question_rules() from public, anon, service_role;
revoke all on function public.protect_exploration_row() from public, anon, service_role;
revoke all on function public.touch_exploration_from_question() from public, anon, service_role;
revoke all on function public.enforce_exploration_has_question() from public, anon, service_role;
grant execute on function public.enforce_exploration_has_question() to authenticated;
grant execute on function public.assign_question_position() to authenticated;
grant execute on function public.validate_question_rules() to authenticated;
grant execute on function public.protect_exploration_row() to authenticated;
grant execute on function public.touch_exploration_from_question() to authenticated;

revoke all on function public.create_exploration_with_first_question(uuid, uuid, text, text, text, text, text) from public, anon, service_role;
grant execute on function public.create_exploration_with_first_question(uuid, uuid, text, text, text, text, text) to authenticated;
