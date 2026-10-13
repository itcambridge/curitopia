-- Soft-hide rules for questions.
-- Run with: supabase test db
-- Requires the local Supabase database. This file does not connect to a remote project.
-- The hosted migration has not been applied from this repository, and these tests
-- have not been executed here.

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

grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

select plan(45);

select has_column('public', 'questions', 'is_hidden', 'questions has is_hidden');
select col_not_null('public', 'questions', 'is_hidden', 'is_hidden is not null');
select col_type_is('public', 'questions', 'is_hidden', 'boolean', 'is_hidden is boolean');
select is(
  (
    select pg_get_expr(d.adbin, d.adrelid)
    from pg_attrdef d
    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where a.attrelid = 'public.questions'::regclass
      and a.attname = 'is_hidden'
  ),
  'false',
  'is_hidden defaults to false'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'questions_central_stays_visible'
      and conrelid = 'public.questions'::regclass
      and contype = 'c'
  ),
  'a check stops a central question from being hidden'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'questions_prevent_hiding_last_visible'
      and tgrelid = 'public.questions'::regclass
      and not tgisinternal
  ),
  'a trigger stops hiding the last visible question'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'explorations_require_question'
      and tgrelid = 'public.explorations'::regclass
      and tgdeferrable
      and tginitdeferred
      and not tgisinternal
  ),
  'the deferred exploration question check remains'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'questions_keep_exploration_nonempty'
      and tgrelid = 'public.questions'::regclass
      and tgdeferrable
      and tginitdeferred
      and not tgisinternal
  ),
  'the deferred nonempty question check remains'
);

select ok(
  (
    select c.relrowsecurity and c.relforcerowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'questions'
  ),
  'questions row level security stays forced'
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
  'question policies are unchanged'
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
  'exploration policies are unchanged'
);

select has_function(
  'public',
  'create_exploration_with_first_question',
  array['uuid', 'uuid', 'text', 'text', 'text', 'text', 'text'],
  'atomic create function remains'
);

select tests.create_user('hide_owner');
select tests.create_user('hide_other');
select tests.authenticate_as('hide_owner');

select lives_ok(
  $$
    select public.create_exploration_with_first_question(
      '10000000-0000-4000-8000-000000000101'::uuid,
      '20000000-0000-4000-8000-000000000101'::uuid,
      'focus',
      'Why does this stay visible?',
      'central',
      null,
      'investigate'
    )
  $$,
  'owner creates a focus exploration'
);

select is(
  (select is_hidden from public.questions where id = '20000000-0000-4000-8000-000000000101'::uuid),
  false,
  'a new central question is visible'
);

select lives_ok(
  $$
    insert into public.questions (id, exploration_id, question_text, role, perspective_origin)
    values (
      '20000000-0000-4000-8000-000000000102'::uuid,
      '10000000-0000-4000-8000-000000000101'::uuid,
      'What else can I ask?',
      'satellite',
      'reframe'
    )
  $$,
  'owner adds a satellite without setting is_hidden'
);

select is(
  (select is_hidden from public.questions where id = '20000000-0000-4000-8000-000000000102'::uuid),
  false,
  'an omitted hide flag is stored as false'
);

select lives_ok(
  $$
    update public.questions
    set is_hidden = true
    where id = '20000000-0000-4000-8000-000000000102'::uuid
  $$,
  'owner hides a satellite while the central question remains'
);

select is(
  (select is_hidden from public.questions where id = '20000000-0000-4000-8000-000000000102'::uuid),
  true,
  'the satellite is hidden'
);

select is(
  (select count(*) from public.questions where exploration_id = '10000000-0000-4000-8000-000000000101'::uuid),
  2::bigint,
  'hiding does not delete the question'
);

select results_eq(
  $$
    select position, question_text, role, is_prioritised, perspective_origin
    from public.questions
    where id = '20000000-0000-4000-8000-000000000102'::uuid
  $$,
  $$
    select 1, 'What else can I ask?'::text, 'satellite'::text, false, 'reframe'::text
  $$,
  'hiding keeps position, text, role, priority, and perspective origin'
);

select lives_ok(
  $$
    update public.questions
    set is_hidden = false
    where id = '20000000-0000-4000-8000-000000000102'::uuid
  $$,
  'owner restores a hidden satellite'
);

select results_eq(
  $$
    select is_hidden, position, question_text, role, is_prioritised, perspective_origin
    from public.questions
    where id = '20000000-0000-4000-8000-000000000102'::uuid
  $$,
  $$
    select false, 1, 'What else can I ask?'::text, 'satellite'::text, false, 'reframe'::text
  $$,
  'restoring keeps the original question metadata'
);

select throws_ok(
  $$
    update public.questions
    set is_hidden = true
    where id = '20000000-0000-4000-8000-000000000101'::uuid
  $$,
  '23514',
  null::text,
  'hiding the central question is rejected'
);

select is(
  (select is_hidden from public.questions where id = '20000000-0000-4000-8000-000000000101'::uuid),
  false,
  'the central question stays visible after the rejected hide'
);

select lives_ok(
  $$
    select public.create_exploration_with_first_question(
      '10000000-0000-4000-8000-000000000102'::uuid,
      '20000000-0000-4000-8000-000000000111'::uuid,
      'quickfire',
      'Only visible question?',
      'satellite',
      null,
      null
    )
  $$,
  'owner creates a one-question quickfire exploration'
);

select throws_ok(
  $$
    update public.questions
    set is_hidden = true
    where id = '20000000-0000-4000-8000-000000000111'::uuid
  $$,
  '23514',
  'the last visible question cannot be hidden',
  'the last visible question cannot be hidden'
);

select is(
  (select is_hidden from public.questions where id = '20000000-0000-4000-8000-000000000111'::uuid),
  false,
  'the rejected hide leaves the only question visible'
);

select lives_ok(
  $$
    insert into public.questions (id, exploration_id, question_text, role)
    values (
      '20000000-0000-4000-8000-000000000112'::uuid,
      '10000000-0000-4000-8000-000000000102'::uuid,
      'A second visible question',
      'satellite'
    )
  $$,
  'owner adds a second quickfire question'
);

select lives_ok(
  $$
    update public.questions
    set is_hidden = true
    where id = '20000000-0000-4000-8000-000000000111'::uuid
  $$,
  'one of two visible questions can be hidden'
);

select throws_ok(
  $$
    update public.questions
    set is_hidden = true
    where id = '20000000-0000-4000-8000-000000000112'::uuid
  $$,
  '23514',
  'the last visible question cannot be hidden',
  'the remaining visible question cannot be hidden'
);

select is(
  (select is_hidden from public.questions where id = '20000000-0000-4000-8000-000000000112'::uuid),
  false,
  'the last visible quickfire question stays visible'
);

select lives_ok(
  $$
    select public.create_exploration_with_first_question(
      '10000000-0000-4000-8000-000000000103'::uuid,
      '20000000-0000-4000-8000-000000000121'::uuid,
      'focus',
      'Finished centre',
      'central',
      null,
      null
    )
  $$,
  'owner creates an exploration to complete'
);

select lives_ok(
  $$
    insert into public.questions (id, exploration_id, question_text, role)
    values (
      '20000000-0000-4000-8000-000000000122'::uuid,
      '10000000-0000-4000-8000-000000000103'::uuid,
      'Finished satellite',
      'satellite'
    )
  $$,
  'owner adds a satellite before completion'
);

select lives_ok(
  $$
    update public.explorations
    set status = 'completed'
    where id = '10000000-0000-4000-8000-000000000103'::uuid
  $$,
  'owner completes the exploration'
);

select lives_ok(
  $$
    update public.questions
    set is_hidden = true
    where id = '20000000-0000-4000-8000-000000000122'::uuid
  $$,
  'a satellite in a completed exploration can be hidden'
);

select is(
  (
    select status = 'completed' and ended_at is not null
    from public.explorations
    where id = '10000000-0000-4000-8000-000000000103'::uuid
  ),
  true,
  'hiding a question does not reopen a completed exploration'
);

select lives_ok(
  $$
    update public.questions
    set is_hidden = false
    where id = '20000000-0000-4000-8000-000000000122'::uuid
  $$,
  'a hidden question in a completed exploration can be restored'
);

select is(
  (
    select status = 'completed' and ended_at is not null
    from public.explorations
    where id = '10000000-0000-4000-8000-000000000103'::uuid
  ),
  true,
  'restoring a question does not reopen a completed exploration'
);

select tests.authenticate_as('hide_other');

select lives_ok(
  $$
    update public.questions
    set is_hidden = true
    where id = '20000000-0000-4000-8000-000000000102'::uuid
  $$,
  'another user cannot see the question they try to hide'
);

select tests.authenticate_as('hide_owner');

select is(
  (select is_hidden from public.questions where id = '20000000-0000-4000-8000-000000000102'::uuid),
  false,
  'another user cannot hide this question'
);

select lives_ok(
  $$
    create extension if not exists dblink
  $$,
  'dblink is available for the concurrency check'
);

select lives_ok(
  $$
    do $body$
    declare
      waited boolean := false;
    begin
      perform dblink_connect('hide_a', 'dbname=' || current_database());
      perform dblink_connect('hide_b', 'dbname=' || current_database());
      perform dblink_exec('hide_a', $q$delete from public.questions where exploration_id = '10000000-0000-4000-8000-0000000000c1'$q$);
      perform dblink_exec('hide_a', $q$delete from public.explorations where id = '10000000-0000-4000-8000-0000000000c1'$q$);
      perform dblink_exec('hide_a', $q$delete from auth.users where id = '30000000-0000-4000-8000-0000000000c1'$q$);
      perform dblink_exec(
        'hide_a',
        $q$
          insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
          values (
            '30000000-0000-4000-8000-0000000000c1',
            'hide-concurrent@curitopia.test',
            '{}'::jsonb,
            '{}'::jsonb,
            now(),
            now()
          )
        $q$
      );
      perform dblink_exec(
        'hide_a',
        $q$
          insert into public.explorations (id, user_id, mode, status)
          values (
            '10000000-0000-4000-8000-0000000000c1',
            '30000000-0000-4000-8000-0000000000c1',
            'quickfire',
            'active'
          )
        $q$
      );
      perform dblink_exec(
        'hide_a',
        $q$
          insert into public.questions (id, exploration_id, question_text, role)
          values (
            '20000000-0000-4000-8000-0000000000c1',
            '10000000-0000-4000-8000-0000000000c1',
            'First concurrent question',
            'satellite'
          )
        $q$
      );
      perform dblink_exec(
        'hide_a',
        $q$
          insert into public.questions (id, exploration_id, question_text, role)
          values (
            '20000000-0000-4000-8000-0000000000c2',
            '10000000-0000-4000-8000-0000000000c1',
            'Second concurrent question',
            'satellite'
          )
        $q$
      );

      perform dblink_exec('hide_a', 'begin');
      perform dblink_exec(
        'hide_a',
        $q$
          update public.questions
          set is_hidden = true
          where id = '20000000-0000-4000-8000-0000000000c1'
        $q$
      );
      perform dblink_exec('hide_b', 'set lock_timeout = ''4s''');
      perform dblink_send_query(
        'hide_b',
        $q$
          update public.questions
          set is_hidden = true
          where id = '20000000-0000-4000-8000-0000000000c2'
        $q$
      );

      for step in 1..40 loop
        if exists (
          select 1
          from pg_locks
          where relation = 'public.explorations'::regclass
            and not granted
        ) then
          waited := true;
          exit;
        end if;
        perform pg_sleep(0.05);
      end loop;

      if not waited then
        raise exception 'the second hide did not wait on the exploration lock';
      end if;

      perform dblink_exec('hide_a', 'commit');

      for step in 1..80 loop
        exit when dblink_is_busy('hide_b') = 0;
        perform pg_sleep(0.05);
      end loop;

      if dblink_is_busy('hide_b') = 1 then
        raise exception 'the second hide did not finish';
      end if;

      begin
        perform dblink_get_result('hide_b');
        raise exception 'the overlapping hide removed the last visible question';
      exception
        when sqlstate '23514' then
          null;
        when others then
          if sqlerrm not like '%last visible question%' then
            raise;
          end if;
      end;

      perform dblink_disconnect('hide_a');
      perform dblink_disconnect('hide_b');
    exception
      when others then
        begin
          perform dblink_disconnect('hide_a');
        exception when others then
          null;
        end;
        begin
          perform dblink_disconnect('hide_b');
        exception when others then
          null;
        end;
        raise;
    end
    $body$
  $$,
  'overlapping hides cannot both succeed'
);

select is(
  (
    select is_hidden
    from dblink(
      'dbname=' || current_database(),
      $q$
        select is_hidden::text
        from public.questions
        where id = '20000000-0000-4000-8000-0000000000c1'
      $q$
    ) as remote(is_hidden text)
  ),
  'true',
  'the first concurrent hide is stored'
);

select is(
  (
    select is_hidden
    from dblink(
      'dbname=' || current_database(),
      $q$
        select is_hidden::text
        from public.questions
        where id = '20000000-0000-4000-8000-0000000000c2'
      $q$
    ) as remote(is_hidden text)
  ),
  'false',
  'the second concurrent hide is rejected'
);

select lives_ok(
  $$
    do $body$
    begin
      perform dblink_exec('dbname=' || current_database(), $q$delete from public.questions where exploration_id = '10000000-0000-4000-8000-0000000000c1'$q$);
      perform dblink_exec('dbname=' || current_database(), $q$delete from public.explorations where id = '10000000-0000-4000-8000-0000000000c1'$q$);
      perform dblink_exec('dbname=' || current_database(), $q$delete from auth.users where id = '30000000-0000-4000-8000-0000000000c1'$q$);
    end
    $body$
  $$,
  'concurrent hide fixtures are removed'
);

select * from finish();

rollback;
