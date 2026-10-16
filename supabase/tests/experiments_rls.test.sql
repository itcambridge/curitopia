-- Row-level security for experiments.
-- Run with: supabase test db
-- Requires the local Supabase database. This file does not connect to a remote project.
-- It has not been executed by the documentation or phase-1 change that added it.

begin;

create schema if not exists tests;

create or replace function tests.create_user(identifier text)
returns uuid
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id,
    email,
    raw_user_meta_data,
    raw_app_meta_data,
    created_at,
    updated_at
  )
  values (
    user_id,
    identifier || '@curitopia.test',
    jsonb_build_object('test_identifier', identifier),
    '{}'::jsonb,
    now(),
    now()
  );
  return user_id;
end;
$$;

create or replace function tests.user_id(identifier text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select id
  from auth.users
  where raw_user_meta_data ->> 'test_identifier' = identifier
$$;

create or replace function tests.authenticate_as(identifier text)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  actor uuid := tests.user_id(identifier);
begin
  if actor is null then
    raise exception 'missing test user %', identifier;
  end if;
  perform set_config('request.jwt.claims', json_build_object(
    'sub', actor::text,
    'role', 'authenticated'
  )::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

select plan(13);

select tests.create_user('experiment_owner');
select tests.create_user('experiment_other');

select tests.authenticate_as('experiment_owner');

select lives_ok(
  $$
    select public.create_exploration_with_first_question(
      '10000000-0000-4000-8000-0000000000e1'::uuid,
      '20000000-0000-4000-8000-0000000000e1'::uuid,
      'focus',
      'What is worth testing first?',
      'central',
      null,
      null
    )
  $$,
  'owner creates the originating exploration'
);

select lives_ok(
  $$
    update public.questions
    set is_prioritised = true
    where id = '20000000-0000-4000-8000-0000000000e1'::uuid
  $$,
  'owner can prioritise the question'
);

select lives_ok(
  $$
    insert into public.experiments (id, user_id, exploration_id, question_id)
    values (
      '30000000-0000-4000-8000-0000000000e1'::uuid,
      auth.uid(),
      '10000000-0000-4000-8000-0000000000e1'::uuid,
      '20000000-0000-4000-8000-0000000000e1'::uuid
    )
  $$,
  'owner creates one experiment for the question'
);

select throws_ok(
  $$
    insert into public.experiments (id, user_id, exploration_id, question_id)
    values (
      '30000000-0000-4000-8000-0000000000e2'::uuid,
      auth.uid(),
      '10000000-0000-4000-8000-0000000000e1'::uuid,
      '20000000-0000-4000-8000-0000000000e1'::uuid
    )
  $$,
  '23505',
  'a question has at most one experiment'
);

select throws_ok(
  $$
    delete from public.questions
    where id = '20000000-0000-4000-8000-0000000000e1'::uuid
  $$,
  '23503',
  'deleting the question is blocked while the experiment exists'
);

select tests.authenticate_as('experiment_other');

select is(
  (select count(*) from public.experiments),
  0::bigint,
  'another account cannot read the experiment'
);

select tests.authenticate_as('experiment_owner');

select lives_ok(
  $$
    insert into public.experiment_items (id, experiment_id, body, kind)
    values
      ('40000000-0000-4000-8000-0000000000e1'::uuid, '30000000-0000-4000-8000-0000000000e1'::uuid, repeat('a', 2000), 'note'),
      ('40000000-0000-4000-8000-0000000000e2'::uuid, '30000000-0000-4000-8000-0000000000e1'::uuid, repeat('b', 2000), 'test')
  $$,
  'each item can hold 2000 characters'
);

select throws_ok(
  $$
    insert into public.experiment_items (id, experiment_id, body, kind)
    values (
      '40000000-0000-4000-8000-0000000000e3'::uuid,
      '30000000-0000-4000-8000-0000000000e1'::uuid,
      repeat('c', 2001),
      'note'
    )
  $$,
  '23514',
  'one item cannot exceed 2000 characters'
);

select tests.authenticate_as('experiment_other');

select is(
  (select count(*) from public.experiment_items),
  0::bigint,
  'another account cannot read experiment items'
);

select throws_ok(
  $$
    insert into public.experiment_items (id, experiment_id, body, kind)
    values (
      '40000000-0000-4000-8000-0000000000e4'::uuid,
      '30000000-0000-4000-8000-0000000000e1'::uuid,
      'A note from someone else',
      'note'
    )
  $$,
  '42501',
  'another account cannot add an experiment item'
);

select tests.authenticate_as('experiment_owner');

select lives_ok(
  $$
    update public.experiment_items
    set kind = 'discovery', body = 'The reading answered it.'
    where id = '40000000-0000-4000-8000-0000000000e2'::uuid
  $$,
  'the owner can change an item kind and its text'
);

select lives_ok(
  $$
    delete from public.experiment_items
    where id = '40000000-0000-4000-8000-0000000000e1'::uuid
  $$,
  'the owner can delete an item'
);

select is(
  (select count(*) from public.experiments where id = '30000000-0000-4000-8000-0000000000e1'::uuid),
  1::bigint,
  'deleting an item leaves the experiment in place'
);

select * from finish();
rollback;
