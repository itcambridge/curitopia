-- Read-only checks for question soft-hide.
-- Paste into the hosted Supabase Dashboard SQL Editor after add_question_hidden.sql.
-- This script does not insert, update, or delete rows and does not change the schema.
-- It has not been run from the repository.

select check_name, passed, detail
from (
  select
    'column is_hidden' as check_name,
    exists (
      select 1
      from pg_attribute
      where attrelid = 'public.questions'::regclass
        and attname = 'is_hidden'
        and not attisdropped
    ) as passed,
    'public.questions.is_hidden exists' as detail

  union all
  select
    'column type boolean',
    exists (
      select 1
      from pg_attribute a
      join pg_type t on t.oid = a.atttypid
      where a.attrelid = 'public.questions'::regclass
        and a.attname = 'is_hidden'
        and t.typname = 'bool'
        and not a.attisdropped
    ),
    'is_hidden is boolean'

  union all
  select
    'column not null',
    coalesce((
      select a.attnotnull
      from pg_attribute a
      where a.attrelid = 'public.questions'::regclass
        and a.attname = 'is_hidden'
        and not a.attisdropped
    ), false),
    'is_hidden rejects null'

  union all
  select
    'default false',
    coalesce((
      select pg_get_expr(d.adbin, d.adrelid) = 'false'
      from pg_attrdef d
      join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
      where a.attrelid = 'public.questions'::regclass
        and a.attname = 'is_hidden'
    ), false),
    'new and existing rows default to visible'

  union all
  select
    'no null is_hidden values',
    not exists (select 1 from public.questions where is_hidden is null),
    'every stored question has a boolean hide flag'

  union all
  select
    'central stays visible',
    exists (
      select 1
      from pg_constraint
      where conname = 'questions_central_stays_visible'
        and conrelid = 'public.questions'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%central%'
        and pg_get_constraintdef(oid) ilike '%is_hidden%'
    ),
    'check constraint questions_central_stays_visible'

  union all
  select
    'last visible trigger',
    exists (
      select 1
      from pg_trigger
      where tgname = 'questions_prevent_hiding_last_visible'
        and tgrelid = 'public.questions'::regclass
        and not tgisinternal
        and (tgtype & 1) = 1
        and (tgtype & 2) = 2
        and (tgtype & 64) = 0
    ),
    'before row trigger questions_prevent_hiding_last_visible'

  union all
  select
    'trigger locks the exploration',
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'prevent_hiding_last_visible_question'
        and p.prosrc ilike '%for update%'
        and p.prosrc ilike '%last visible question%'
    ),
    'prevent_hiding_last_visible_question takes a parent row lock'

  union all
  select
    'deferred exploration insert check',
    exists (
      select 1
      from pg_trigger
      where tgname = 'explorations_require_question'
        and tgrelid = 'public.explorations'::regclass
        and tgdeferrable
        and tginitdeferred
        and not tgisinternal
    ),
    'explorations_require_question is still deferred'

  union all
  select
    'deferred question delete check',
    exists (
      select 1
      from pg_trigger
      where tgname = 'questions_keep_exploration_nonempty'
        and tgrelid = 'public.questions'::regclass
        and tgdeferrable
        and tginitdeferred
        and not tgisinternal
    ),
    'questions_keep_exploration_nonempty is still deferred'

  union all
  select
    'atomic create function',
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'create_exploration_with_first_question'
        and pg_get_function_identity_arguments(p.oid) = 'p_exploration_id uuid, p_question_id uuid, p_mode text, p_question_text text, p_role text, p_title text, p_perspective_origin text'
    ),
    'create_exploration_with_first_question signature is unchanged'

  union all
  select
    'explorations rls forced',
    coalesce((
      select c.relrowsecurity and c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'explorations'
    ), false),
    'explorations row level security stays enabled and forced'

  union all
  select
    'questions rls forced',
    coalesce((
      select c.relrowsecurity and c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'questions'
    ), false),
    'questions row level security stays enabled and forced'

  union all
  select
    'exploration policies',
    (
      select count(*) = 4
      from pg_policies
      where schemaname = 'public'
        and tablename = 'explorations'
        and policyname in (
          'explorations_select',
          'explorations_insert',
          'explorations_update',
          'explorations_delete'
        )
    ),
    'the four exploration owner policies remain'

  union all
  select
    'question policies',
    (
      select count(*) = 4
      from pg_policies
      where schemaname = 'public'
        and tablename = 'questions'
        and policyname in (
          'questions_select',
          'questions_insert',
          'questions_update',
          'questions_delete'
        )
    ),
    'the four question owner policies remain'

  union all
  select
    'authenticated question grants',
    has_table_privilege('authenticated', 'public.questions', 'SELECT')
      and has_table_privilege('authenticated', 'public.questions', 'INSERT')
      and has_table_privilege('authenticated', 'public.questions', 'UPDATE')
      and has_table_privilege('authenticated', 'public.questions', 'DELETE')
      and not has_table_privilege('authenticated', 'public.questions', 'TRUNCATE'),
    'authenticated keeps select, insert, update, and delete only'
) checks
order by check_name;
