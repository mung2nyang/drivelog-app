-- 일지 겹침 시험(pgTAP): 알던 고친 시각이 다르면 저장·지우기 거절, 맞으면 그대로, 옛 함수로 고쳐도 시각이 바뀜.
-- 임시 사용자·차량만 만들고 끝에 되돌린다. CI에서 supabase test db로 돈다.
begin;
select plan(26);
set local statement_timeout = '30s';
set local lock_timeout = '3s';

create function pg_temp.id(name text) returns uuid language sql immutable
as $$ select md5('day-log-conflict-test:' || name)::uuid $$;
create procedure pg_temp.act_as(name text) language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.id(name)::text, ''), true);
  perform set_config('request.jwt.claims', case when name is null then '{}'
    else jsonb_build_object('sub', pg_temp.id(name), 'role', 'authenticated')::text end, true);
end;
$$;
create function pg_temp.log(day date, fixed int) returns jsonb language sql stable
as $$ select jsonb_build_object('user_id', auth.uid(), 'vehicle_id', pg_temp.id('car_a'), 'work_date', day,
  'is_off', false, 'fixed_count', fixed, 'pallet_count', 0, 'raw', jsonb_build_object('fixedCount', fixed)) $$;
create function pg_temp.calls(day date, n int) returns jsonb language sql stable
as $$ select coalesce(jsonb_agg(jsonb_build_object('user_id', auth.uid(), 'vehicle_id', pg_temp.id('car_a'), 'work_date', day,
  'sequence', i, 'fare_amount', 10000 * (i + 1), 'raw', jsonb_build_object('id', 'c' || i))), '[]'::jsonb)
  from generate_series(0, n - 1) as i $$;
create function pg_temp.at(day date) returns timestamptz language sql stable
as $$ select updated_at from public.daily_logs where vehicle_id = pg_temp.id('car_a') and work_date = day $$;
create function pg_temp.call_count(day date) returns int language sql stable
as $$ select count(*)::int from public.transport_details where vehicle_id = pg_temp.id('car_a') and work_date = day $$;
create function pg_temp.saved(name text) returns timestamptz language sql stable
as $$ select current_setting('test.' || name)::timestamptz $$;

insert into auth.users(id) values (pg_temp.id('owner_a')), (pg_temp.id('owner_b'));
insert into public.profiles(id, name) values (pg_temp.id('owner_a'), '임시 차주 A'), (pg_temp.id('owner_b'), '임시 차주 B');
insert into public.vehicles(id, user_id, number, type) values
  (pg_temp.id('car_a'), pg_temp.id('owner_a'), '겹침 시험 A', 'main'),
  (pg_temp.id('car_b'), pg_temp.id('owner_b'), '겹침 시험 B', 'main');

select has_column('public', 'daily_logs', 'updated_at', '일지 표에 고친 시각 칸');

set local role authenticated;
call pg_temp.act_as('owner_a');

select lives_ok($$ select set_config('test.v1', public.save_day_log(pg_temp.log('2026-01-01', 1), pg_temp.calls('2026-01-01', 2), null)::text, true) $$,
  '기준 없음, 그날 없음: 저장');
select is(pg_temp.call_count('2026-01-01'), 2, '기준 없음, 그날 없음: 콜 2개 들어감');
select is(pg_temp.saved('v1'), pg_temp.at('2026-01-01'), '돌려준 시각 = 서버 고친 시각');

select lives_ok($$ select set_config('test.v2', public.save_day_log(pg_temp.log('2026-01-01', 2), pg_temp.calls('2026-01-01', 1), pg_temp.saved('v1'))::text, true) $$,
  '맞는 기준: 저장');
select ok(pg_temp.saved('v2') > pg_temp.saved('v1'), '고칠 때마다 시각이 바뀜');
select throws_ok($$ select public.save_day_log(pg_temp.log('2026-01-01', 3), '[]'::jsonb, pg_temp.saved('v1')) $$,
  'DL409', '다른 기기에서 먼저 고친 일지입니다.', '낡은 기준: 거절');
select is(pg_temp.call_count('2026-01-01'), 1, '낡은 기준: 콜 그대로');
select throws_ok($$ select public.save_day_log(pg_temp.log('2026-01-01', 3), '[]'::jsonb, null) $$,
  'DL409', null, '기준 없음, 콜 있는 날: 거절');

select lives_ok($$ select public.save_day_log(pg_temp.log('2026-01-01', 4), pg_temp.calls('2026-01-01', 1)) $$, '옛 함수로 저장');
select ok(pg_temp.at('2026-01-01') > pg_temp.saved('v2'), '옛 함수로 고쳐도 시각이 바뀜');
select throws_ok($$ select public.save_day_log(pg_temp.log('2026-01-01', 5), '[]'::jsonb, pg_temp.saved('v2')) $$,
  'DL409', null, '옛 함수가 고친 뒤 그 전 기준: 거절');

insert into public.daily_logs(id, user_id, vehicle_id, work_date, raw)
  values (pg_temp.id('log_d2'), auth.uid(), pg_temp.id('car_a'), '2026-01-02', '{}');
insert into public.fuel_records(daily_log_id, user_id, vehicle_id, work_date)
  values (pg_temp.id('log_d2'), auth.uid(), pg_temp.id('car_a'), '2026-01-02');
select lives_ok($$ select public.save_day_log(pg_temp.log('2026-01-02', 1), pg_temp.calls('2026-01-02', 1), null) $$,
  '기준 없음, 지출만 있는 빈 줄: 저장');
select is(pg_temp.call_count('2026-01-02'), 1, '기준 없음, 지출만 있는 빈 줄: 콜 들어감');

select throws_ok($$ select public.save_day_log(pg_temp.log('2026-01-03', 1), '[]'::jsonb, pg_temp.saved('v1')) $$,
  'DL409', null, '기준은 있는데 그날이 지워짐: 거절');

select throws_ok(format('select public.remove_day_log(%L, %L, %L)', pg_temp.id('car_a'), '2026-01-01', pg_temp.saved('v1')),
  'DL409', null, '지우기 낡은 기준: 거절');
select is(pg_temp.call_count('2026-01-01'), 1, '지우기 낡은 기준: 콜 그대로');
select lives_ok(format('select public.remove_day_log(%L, %L, %L)', pg_temp.id('car_a'), '2026-01-01', pg_temp.at('2026-01-01')),
  '지우기 맞는 기준');
select is(pg_temp.at('2026-01-01'), null, '지우기 맞는 기준: 지출 없는 날은 줄까지 지워짐');
select lives_ok(format('select set_config(''test.v3'', public.remove_day_log(%L, %L, %L)::text, true)', pg_temp.id('car_a'), '2026-01-02', pg_temp.at('2026-01-02')),
  '지우기 지출 있는 날');
select is(pg_temp.saved('v3'), pg_temp.at('2026-01-02'), '지우기 지출 있는 날: 빈 줄로 남고 새 시각을 돌려줌');
select is(pg_temp.call_count('2026-01-02'), 0, '지우기 지출 있는 날: 콜은 지워짐');

call pg_temp.act_as('owner_b');
select throws_ok($$ select public.save_day_log(pg_temp.log('2026-01-04', 1), '[]'::jsonb, null) $$,
  '42501', null, '남의 차량: 저장 거절');
select lives_ok(format('select public.remove_day_log(%L, %L, null)', pg_temp.id('car_a'), '2026-01-02'), '남의 차량 지우기: 아무 일 없음');
call pg_temp.act_as('owner_a');
select ok(pg_temp.at('2026-01-02') is not null, '남의 차량 지우기 뒤에도 내 줄 그대로');

call pg_temp.act_as(null);
reset role;

select is(
  (select bool_and(not p.prosecdef and not has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('authenticated', p.oid, 'execute'))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('lock_unchanged_day_log', 'save_day_log', 'remove_day_log')
     and pg_get_function_identity_arguments(p.oid) like '%timestamp with time zone'),
  true, '새 함수 3개: 부르는 사람 권한, 비회원 실행 불가, 로그인 사용자 실행 가능');

select * from finish();
rollback;
