-- 운비서 하루 횟수 시험(pgTAP): 한도는 서버 함수 안에 고정, 돌려주기는 관리자 열쇠만, 못 알아들음 돌려받기는 하루 20번까지.
-- 임시 사용자만 만들고 끝에 되돌린다. CI에서 supabase test db로 돈다.
begin;
select plan(23);
set local statement_timeout = '30s';
set local lock_timeout = '3s';

create function pg_temp.id(name text) returns uuid language sql immutable
as $$ select md5('unbiseo-usage-test:' || name)::uuid $$;
create procedure pg_temp.act_as(name text) language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.id(name)::text, ''), true);
  perform set_config('request.jwt.claims', case when name is null then '{}'
    else jsonb_build_object('sub', pg_temp.id(name), 'role', 'authenticated')::text end, true);
end;
$$;
create function pg_temp.uses(kind text) returns int language sql stable
as $$ select coalesce((select u.uses from public.unbiseo_usage u where u.user_id = pg_temp.id('user_a')
  and u.used_on = (now() at time zone 'Asia/Seoul')::date and u.kind = $1), 0) $$;

insert into auth.users(id) values (pg_temp.id('user_a')), (pg_temp.id('admin'));
insert into public.admin_users(user_id) values (pg_temp.id('admin'));

select has_function('public', 'use_unbiseo', array['text'], '한도를 받지 않는 세기 함수');
select hasnt_function('public', 'use_unbiseo', array['text', 'integer'], '한도를 받던 옛 세기 함수 없음');
select ok(not has_function_privilege('anon', 'public.use_unbiseo(text)', 'execute')
  and has_function_privilege('authenticated', 'public.use_unbiseo(text)', 'execute'), '세기: 비회원 불가, 로그인 가능');
select ok(not has_function_privilege('anon', 'public.return_unbiseo(uuid, text, boolean)', 'execute'), '돌려주기: 비회원 불가');
select ok(not has_function_privilege('authenticated', 'public.return_unbiseo(uuid, text, boolean)', 'execute'), '돌려주기: 로그인 회원 불가');
select ok(has_function_privilege('service_role', 'public.return_unbiseo(uuid, text, boolean)', 'execute'), '돌려주기: 관리자 열쇠 가능');

set local role authenticated;
call pg_temp.act_as('user_a');
select is((select count(*)::int from generate_series(1, 21) where public.use_unbiseo('weather')), 20, '날씨 하루 20번까지, 21번째 거절');
select is(pg_temp.uses('weather'), 20, '날씨 횟수 20');
select is((select count(*)::int from generate_series(1, 21) where public.use_unbiseo('parse')), 20, '말 읽기 하루 20번까지');
select throws_ok($$ select public.use_unbiseo('parse_miss') $$, '22023', null, '세기: 모르는 종류 거절');
select throws_ok($$ select public.return_unbiseo(pg_temp.id('user_a'), 'weather', false) $$, '42501', null, '로그인 회원이 돌려주기를 부르면 권한 없음');
call pg_temp.act_as('admin');
select is((select count(*)::int from generate_series(1, 25) where public.use_unbiseo('parse')), 25, '관리자: 말 읽기 21번째 이후도 통과');
select is((select count(*)::int from generate_series(1, 25) where public.use_unbiseo('voice') and public.use_unbiseo('weather')), 25, '관리자: 목소리·날씨도 막히지 않음');
select is((select u.uses from public.unbiseo_usage u where u.user_id = pg_temp.id('admin') and u.kind = 'parse'), 25, '관리자: 횟수는 계속 셈');
call pg_temp.act_as('user_a');
select throws_ok($$ insert into public.admin_users(user_id) values (pg_temp.id('user_a')) $$, '42501', null, '회원은 관리자 명단에 자기를 넣을 수 없음');
select is(public.use_unbiseo('parse'), false, '회원은 관리자가 쓴 뒤에도 21번째 거절');
call pg_temp.act_as(null);
reset role;

set local role service_role;
select is(public.return_unbiseo(pg_temp.id('user_a'), 'weather', false), true, '실패면 1 돌려줌');
select is(public.return_unbiseo(pg_temp.id('user_a'), 'voice', false), false, '센 적 없는 종류는 0 밑으로 안 내려감');
select is((select count(*)::int from generate_series(1, 21) where public.return_unbiseo(pg_temp.id('user_a'), 'parse', true)), 20,
  '못 알아들음은 하루 20번까지만 돌려줌');
select throws_ok($$ select public.return_unbiseo(pg_temp.id('user_a'), 'voice', true) $$, '22023', null, '못 알아들음은 말 읽기만');
reset role;

select is(pg_temp.uses('weather'), 19, '돌려준 뒤 날씨 횟수 19');
select is(pg_temp.uses('parse'), 0, '못 알아들음 20번 돌려받아 말 읽기 0');
select is(pg_temp.uses('parse_miss'), 20, '못 알아들음 돌려받은 횟수 20');

select * from finish();
rollback;
