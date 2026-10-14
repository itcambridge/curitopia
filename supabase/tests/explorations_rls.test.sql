-- Row-level security and constraint tests for explorations and questions.
-- Run with: supabase test db
-- Requires the local Supabase database (Docker). This file does not connect to a remote project.

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

create or replace function tests.become_anon()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

select plan(62);

select tests.create_user('user_a');
select tests.create_user('user_b');

select ok(
  (select c.relrowsecurity and c.relforcerowsecurity
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'explorations'),
  'explorations enforces row level security'
);

select ok(
  (select c.relrowsecurity and c.relforcerowsecurity
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'questions'),
  'questions enforces row level security'
);

select ok(
  not has_table_privilege('anon', 'public.explorations', 'SELECT'),
  'anon has no select grant on explorations'
);

select ok(
  not has_table_privilege('anon', 'public.questions', 'SELECT'),
  'anon has no select grant on questions'
);

select ok(
  not has_table_privilege('service_role', 'public.explorations', 'SELECT'),
  'service_role has no select grant on explorations'
);

select ok(
  has_table_privilege('authenticated', 'public.explorations', 'INSERT'),
  'authenticated can insert explorations'
);

select has_table('public', 'explorations', 'explorations table exists');
select has_table('public', 'questions', 'questions table exists');
select has_index(
  'public',
  'explorations',
  'explorations_user_updated_idx',
  'explorations are indexed by owner and update time'
);
select has_index(
  'public',
  'questions',
  'questions_position_unique',
  'question positions are unique inside an exploration'
);
select has_index(
  'public',
  'questions',
  'questions_one_central',
  'only one central question is indexed per exploration'
);
select col_is_fk(
  'public',
  'explorations',
  'user_id',
  'explorations belong to an auth user'
);
select col_is_fk(
  'public',
  'questions',
  'exploration_id',
  'questions belong to an exploration'
);
select has_function(
  'public',
  'create_exploration_with_first_question',
  array['uuid', 'uuid', 'text', 'text', 'text', 'text', 'text'],
  'atomic create function exists'
);
select policies_are(
  'public',
  'explorations',
  array[
    'explorations_select',
    'explorations_insert',
    'explorations_update',
    'explorations_delete'
  ],
  'explorations exposes the four owner policies'
);
select policies_are(
  'public',
  'questions',
  array[
    'questions_select',
    'questions_insert',
    'questions_update',
    'questions_delete'
  ],
  'questions exposes the four parent-owner policies'
);
select hasnt_column('public', 'questions', 'color', 'question colour is not stored');
select hasnt_column('public', 'explorations', 'x', 'map coordinates are not stored');

select tests.authenticate_as('user_a');

select lives_ok(
  $$
    select public.create_exploration_with_first_question(
      '10000000-0000-4000-8000-000000000001'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      'focus',
      'Why do we dream?',
      'central',
      '  Dreams  ',
      'investigate'
    )
  $$,
  'owner creates a focus exploration and its first question'
);

select is(
  (select title from public.explorations where id = '10000000-0000-4000-8000-000000000001'::uuid),
  'Dreams',
  'stored title is trimmed'
);

select is(
  (select user_id = auth.uid() from public.explorations where id = '10000000-0000-4000-8000-000000000001'::uuid),
  true,
  'exploration owner is the signed-in user'
);

select results_eq(
  $$
    select position, role, perspective_origin, is_prioritised
    from public.questions
    where id = '20000000-0000-4000-8000-000000000001'::uuid
  $$,
  $$
    select 0, 'central'::text, 'investigate'::text, false
  $$,
  'first question is stored in order with its role and origin'
);

select lives_ok(
  $$
    insert into public.questions (id, exploration_id, question_text, role)
    values (
      '20000000-0000-4000-8000-000000000002'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid,
      'What happens next?',
      'satellite'
    )
  $$,
  'owner appends a question'
);

select is(
  (select position from public.questions where id = '20000000-0000-4000-8000-000000000002'::uuid),
  1,
  'the server assigns the next position'
);

select lives_ok(
  $$
    update public.questions
    set question_text = 'What happens in the brain?'
    where id = '20000000-0000-4000-8000-000000000002'::uuid
  $$,
  'owner updates question text'
);

select is(
  (select question_text from public.questions where id = '20000000-0000-4000-8000-000000000002'::uuid),
  'What happens in the brain?',
  'updated question text is readable by the owner'
);

select lives_ok(
  $$
    delete from public.questions
    where id = '20000000-0000-4000-8000-000000000002'::uuid
  $$,
  'owner deletes a question that is not the last one'
);

select is(
  (select count(*) from public.questions where exploration_id = '10000000-0000-4000-8000-000000000001'::uuid),
  1::bigint,
  'the remaining question stays in place'
);

select throws_ok(
  $$
    do $body$
    begin
      delete from public.questions
      where id = '20000000-0000-4000-8000-000000000001'::uuid;
      set constraints all immediate;
    end
    $body$
  $$,
  '23514',
  null::text,
  'the last question cannot be removed'
);

select throws_ok(
  $$
    insert into public.explorations (id, user_id, mode, status)
    values (
      '10000000-0000-4000-8000-000000000050'::uuid,
      auth.uid(),
      'workshop',
      'active'
    )
  $$,
  '23514',
  null::text,
  'invalid modes are rejected'
);

select throws_ok(
  $$
    insert into public.questions (id, exploration_id, position, question_text, role)
    values (
      '20000000-0000-4000-8000-000000000050'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid,
      3,
      'Who knows?',
      'parent'
    )
  $$,
  '23514',
  null::text,
  'invalid roles are rejected'
);

select throws_ok(
  $$
    insert into public.questions (id, exploration_id, position, question_text, role, perspective_origin)
    values (
      '20000000-0000-4000-8000-000000000051'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid,
      3,
      'Who knows?',
      'satellite',
      'wonder'
    )
  $$,
  '23514',
  null::text,
  'invalid perspective origins are rejected'
);

select throws_ok(
  $$
    insert into public.questions (id, exploration_id, position, question_text, role)
    values (
      '20000000-0000-4000-8000-000000000052'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid,
      3,
      repeat('a', 2001),
      'satellite'
    )
  $$,
  '23514',
  null::text,
  'question text over 2000 characters is rejected'
);

select throws_ok(
  $$
    insert into public.questions (id, exploration_id, position, question_text, role)
    values (
      '20000000-0000-4000-8000-000000000053'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid,
      3,
      '   ',
      'satellite'
    )
  $$,
  '23514',
  null::text,
  'blank question text is rejected'
);

select throws_ok(
  $$
    update public.explorations
    set title = repeat('t', 121)
    where id = '10000000-0000-4000-8000-000000000001'::uuid
  $$,
  '23514',
  null::text,
  'titles over 120 characters are rejected'
);

select throws_ok(
  $$
    do $body$
    begin
      insert into public.questions (id, exploration_id, question_text, role)
      values (
        '20000000-0000-4000-8000-000000000054'::uuid,
        '10000000-0000-4000-8000-000000000001'::uuid,
        'Duplicate position?',
        'satellite'
      );
      update public.questions
      set position = 0
      where id = '20000000-0000-4000-8000-000000000054'::uuid;
    end
    $body$
  $$,
  '23505',
  null::text,
  'duplicate positions in one exploration are rejected'
);

select lives_ok(
  $$
    insert into public.questions (id, exploration_id, position, question_text, role)
    values (
      '20000000-0000-4000-8000-000000000055'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid,
      4,
      'Second centre?',
      'satellite'
    )
  $$,
  'owner adds a satellite beside the central question'
);

select throws_ok(
  $$
    update public.questions
    set role = 'central'
    where id = '20000000-0000-4000-8000-000000000055'::uuid
  $$,
  '23505',
  null::text,
  'an exploration cannot have two central questions'
);

select lives_ok(
  $$
    update public.questions
    set is_prioritised = true
    where id = '20000000-0000-4000-8000-000000000001'::uuid
  $$,
  'priority can change while the exploration is active'
);

select lives_ok(
  $$
    update public.explorations
    set status = 'completed'
    where id = '10000000-0000-4000-8000-000000000001'::uuid
  $$,
  'owner completes an exploration'
);

select ok(
  (select ended_at is not null
   from public.explorations
   where id = '10000000-0000-4000-8000-000000000001'::uuid),
  'completion records a server end time'
);

select lives_ok(
  $$
    update public.questions
    set is_prioritised = true
    where id = '20000000-0000-4000-8000-000000000001'::uuid
  $$,
  'owner can prioritise a question after completion'
);

select lives_ok(
  $$
    insert into public.questions (id, exploration_id, question_text, role)
    values (
      '20000000-0000-4000-8000-000000000056'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid,
      'A question added after completion',
      'satellite'
    )
  $$,
  'a completed exploration still accepts a question'
);

select is(
  (
    select status = 'completed' and ended_at is not null
    from public.explorations
    where id = '10000000-0000-4000-8000-000000000001'::uuid
  ),
  true,
  'adding a question does not change a completed exploration status'
);

select lives_ok(
  $$
    select public.create_exploration_with_first_question(
      '10000000-0000-4000-8000-000000000002'::uuid,
      '20000000-0000-4000-8000-000000000010'::uuid,
      'quickfire',
      'What if dreams are questions?',
      'satellite',
      null::text,
      null
    )
  $$,
  'owner creates a quickfire exploration'
);

select throws_ok(
  $$
    insert into public.questions (id, exploration_id, position, question_text, role, perspective_origin)
    values (
      '20000000-0000-4000-8000-000000000011'::uuid,
      '10000000-0000-4000-8000-000000000002'::uuid,
      1,
      'Where else?',
      'satellite',
      'connect'
    )
  $$,
  '23514',
  null::text,
  'quickfire rejects a perspective origin'
);

select tests.authenticate_as('user_b');

select is_empty(
  $$select 1 from public.explorations$$,
  'another user cannot read explorations'
);

select is_empty(
  $$select 1 from public.questions$$,
  'another user cannot read questions'
);

select lives_ok(
  $$
    update public.questions
    set question_text = 'Stolen question'
    where id = '20000000-0000-4000-8000-000000000001'::uuid
  $$,
  'a cross-user question update changes no visible row'
);

select lives_ok(
  $$
    delete from public.explorations
    where id = '10000000-0000-4000-8000-000000000001'::uuid
  $$,
  'a cross-user exploration delete changes no visible row'
);

select throws_ok(
  $$
    insert into public.questions (id, exploration_id, position, question_text, role)
    values (
      '20000000-0000-4000-8000-000000000099'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid,
      8,
      'Can I attach this?',
      'satellite'
    )
  $$,
  null::text,
  null::text,
  'a user cannot attach a question to another user''s exploration'
);

select tests.authenticate_as('user_a');

select is(
  (select question_text from public.questions where id = '20000000-0000-4000-8000-000000000001'::uuid),
  'Why do we dream?',
  'the question text is unchanged after the other user''s update'
);

select ok(
  (select exists (
    select 1 from public.explorations where id = '10000000-0000-4000-8000-000000000001'::uuid
  )),
  'the exploration remains after the other user''s delete'
);

select tests.become_anon();

select throws_ok(
  $$select * from public.explorations$$,
  '42501',
  null::text,
  'anon cannot read explorations'
);

select throws_ok(
  $$select * from public.questions$$,
  '42501',
  null::text,
  'anon cannot read questions'
);

select throws_ok(
  $$
    insert into public.explorations (id, user_id, mode, status)
    values (
      '10000000-0000-4000-8000-000000000080'::uuid,
      '30000000-0000-4000-8000-000000000001'::uuid,
      'focus',
      'active'
    )
  $$,
  '42501',
  null::text,
  'anon cannot insert an exploration'
);

select tests.authenticate_as('user_a');

select throws_ok(
  format(
    'update public.explorations set user_id = %L::uuid where id = %L::uuid',
    tests.user_id('user_b'),
    '10000000-0000-4000-8000-000000000002'
  ),
  '23514',
  null::text,
  'the owner cannot be changed'
);

select throws_ok(
  $$
    select public.create_exploration_with_first_question(
      '10000000-0000-4000-8000-000000000077'::uuid,
      '20000000-0000-4000-8000-000000000010'::uuid,
      'focus',
      'Will this roll back?',
      'central',
      null::text,
      null
    )
  $$,
  '23505',
  null::text,
  'reusing a question id fails'
);

select is_empty(
  $$select 1 from public.explorations where id = '10000000-0000-4000-8000-000000000077'::uuid$$,
  'a failed atomic create leaves no exploration behind'
);

select is(
  (select exploration_id from public.questions where id = '20000000-0000-4000-8000-000000000010'::uuid),
  '10000000-0000-4000-8000-000000000002'::uuid,
  'the original quickfire question stays on its exploration'
);

select throws_ok(
  $$
    do $body$
    begin
      insert into public.explorations (id, user_id, mode, status)
      values (
        '10000000-0000-4000-8000-000000000099'::uuid,
        auth.uid(),
        'focus',
        'active'
      );
      set constraints all immediate;
    end
    $body$
  $$,
  '23514',
  null::text,
  'an exploration with no question is rejected'
);

select is_empty(
  $$select 1 from public.explorations where id = '10000000-0000-4000-8000-000000000099'::uuid$$,
  'the rejected empty exploration is not stored'
);

select lives_ok(
  $$
    do $body$
    begin
      delete from public.explorations
      where id = '10000000-0000-4000-8000-000000000002'::uuid;
      set constraints all immediate;
    end
    $body$
  $$,
  'deleting an exploration is allowed'
);

select is_empty(
  $$
    select 1 from public.questions
    where exploration_id = '10000000-0000-4000-8000-000000000002'::uuid
  $$,
  'deleting an exploration deletes its questions'
);

select * from finish();

rollback;
