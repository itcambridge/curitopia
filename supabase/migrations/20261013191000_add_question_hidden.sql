-- Soft-hide for questions. Forward-only: do not edit the applied explorations migration.
-- Hiding sets is_hidden. It does not delete the row.
-- A central question cannot be hidden. An exploration must keep one visible question.
-- The statements are safe to run again. See supabase/scripts/add_question_hidden.sql.

alter table public.questions
  add column if not exists is_hidden boolean not null default false;

comment on column public.questions.is_hidden is
  'True when the question is hidden. The row, text, position, role, priority, and perspective origin stay. '
  'A central question cannot be hidden. At least one question in the exploration must stay visible.';

alter table public.questions
  drop constraint if exists questions_central_stays_visible;

alter table public.questions
  add constraint questions_central_stays_visible
  check (role <> 'central' or is_hidden = false);

create or replace function public.prevent_hiding_last_visible_question()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.is_hidden then
    return new;
  end if;

  if new.role = 'central' then
    return new;
  end if;

  -- Serialize hides on this exploration so two concurrent updates cannot
  -- each observe the other question as still visible.
  perform 1
  from public.explorations
  where explorations.id = new.exploration_id
  for update;

  if not exists (
    select 1
    from public.questions
    where questions.exploration_id = new.exploration_id
      and questions.id is distinct from new.id
      and not questions.is_hidden
  ) then
    raise exception 'the last visible question cannot be hidden' using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.prevent_hiding_last_visible_question() is
  'Rejects hiding a satellite when no other question in the exploration is visible. '
  'Locks the parent exploration row so concurrent hides cannot pass the check together. '
  'A central question is left to questions_central_stays_visible.';

drop trigger if exists questions_prevent_hiding_last_visible on public.questions;

create trigger questions_prevent_hiding_last_visible
before insert or update of is_hidden on public.questions
for each row
when (new.is_hidden)
execute function public.prevent_hiding_last_visible_question();

revoke all on function public.prevent_hiding_last_visible_question() from public, anon, service_role;
grant execute on function public.prevent_hiding_last_visible_question() to authenticated;
