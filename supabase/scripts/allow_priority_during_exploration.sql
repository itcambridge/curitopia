-- Paste this into the hosted Supabase Dashboard SQL Editor.
-- It matches supabase/migrations/20261014210000_allow_priority_during_exploration.sql.
-- Do not recreate explorations or questions. Do not reapply earlier migrations.
--
-- Repeated runs: CREATE OR REPLACE FUNCTION replaces the function body.
-- The existing questions_validate_rules trigger keeps calling that function.
-- status, ended_at, and the rule that a completed exploration stays completed are unchanged.

begin;

create or replace function public.validate_question_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_mode text;
begin
  select explorations.mode
    into parent_mode
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

  return new;
end;
$$;

commit;
