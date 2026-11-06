-- 알림 받을 주소 표 보안 시험(pgTAP): 표 직접 읽기·넣기 막힘, 함수로 내 줄 넣기·계정 바뀌면 옮기기, 남의 줄 못 지움, 비로그인 거절.
-- 임시 사용자만 만들고 끝에 되돌린다. CI에서 supabase test db로 돈다.
begin;
select plan(12);
set local statement_timeout = '30s';
set local lock_timeout = '3s';

create function pg_temp.id(name text) returns uuid language sql immutable
as $$ select md5('push-test:' || name)::uuid $$;
create procedure pg_temp.act_as(name text) language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.id(name)::text, ''), true);
  perform set_config('request.jwt.claims', case when name is null then '{}'
    else jsonb_build_object('sub', pg_temp.id(name), 'role', 'authenticated')::text end, true);
end;
$$;
create function pg_temp.owner_of(t text) returns uuid language sql security definer
as $$ select user_id from public.push_devices where token = t $$;
grant execute on function pg_temp.owner_of(text) to authenticated, anon;

insert into auth.users(id) values (pg_temp.id('user_a')), (pg_temp.id('user_b'));

set local role authenticated;
call pg_temp.act_as('user_a');
select lives_ok($$ select public.register_push_device('token-1') $$, 'A: 내 주소 맡기기');
select is(pg_temp.owner_of('token-1'), pg_temp.id('user_a'), 'A: 주소가 A 것');
select throws_ok($$ select * from public.push_devices $$, '42501', null, 'A: 표 직접 읽기 막힘');
select throws_ok($$ insert into public.push_devices(token, user_id) values ('token-x', auth.uid()) $$, '42501', null, 'A: 표 직접 넣기 막힘');
select throws_ok($$ select public.register_push_device('') $$, '22023', null, 'A: 빈 주소 거절');

call pg_temp.act_as('user_b');
select lives_ok($$ select public.unregister_push_device('token-1') $$, 'B: 남의 주소 지우기 시도는 오류 없이');
select is(pg_temp.owner_of('token-1'), pg_temp.id('user_a'), 'B: 남의 주소는 그대로');
select lives_ok($$ select public.register_push_device('token-1') $$, 'B: 같은 휴대폰에서 B로 로그인해 맡김');
select is(pg_temp.owner_of('token-1'), pg_temp.id('user_b'), 'B: 주소가 B 것으로 옮겨짐');
select lives_ok($$ select public.unregister_push_device('token-1') $$, 'B: 내 주소 지우기');
select is(pg_temp.owner_of('token-1'), null, 'B: 지워짐');

call pg_temp.act_as(null);
reset role;
set local role anon;
select throws_ok($$ select public.register_push_device('token-2') $$, '42501', null, '비로그인: 함수 부르기 막힘');
reset role;

select * from finish();
rollback;
