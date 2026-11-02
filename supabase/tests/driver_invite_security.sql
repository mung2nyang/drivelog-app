-- 초대코드 보안 시험(pgTAP): 형식·기한·재발급·틀린 시도 제한·만료·비로그인.
-- 임시 사용자·차량만 만들고 끝에 되돌린다. CI에서 supabase test db로 돈다.
begin;
select plan(23);
set local statement_timeout = '30s';
set local lock_timeout = '3s';

-- 시험용 고정 아이디(이름마다 같은 값)와 로그인 사용자 흉내.
create function pg_temp.id(name text) returns uuid language sql immutable
as $$ select md5('invite-test:' || name)::uuid $$;
create function pg_temp.today() returns date language sql stable
as $$ select (now() at time zone 'Asia/Seoul')::date $$;
create procedure pg_temp.act_as(name text) language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.id(name)::text, ''), true);
  perform set_config('request.jwt.claims', case when name is null then '{}'
    else jsonb_build_object('sub', pg_temp.id(name), 'role', 'authenticated')::text end, true);
end;
$$;
-- 틀린 코드 다섯 번: 매번 연결 안 됨(실패 기록만 남음).
create function pg_temp.wrong_codes() returns setof text language plpgsql as $$
begin
  for i in 1..5 loop
    return next is((select count(*)::int from public.redeem_driver_invite_code('WRONG' || i || 'CODE')), 0,
      format('기사: 틀린 코드 %s번째는 연결 안 됨', i));
  end loop;
end;
$$;

select is(current_user::text, 'postgres', '준비: postgres로 실행');
select is((select count(*)::int from public.driver_links where invite_code in ('A2B3C4D5E6', 'Z9Y8X7W6V5')), 0,
  '준비: 시험용 코드가 아직 없음');
insert into auth.users(id) values (pg_temp.id('owner_a')), (pg_temp.id('driver_c'));
insert into public.profiles(id, name) values (pg_temp.id('owner_a'), '임시 차주'), (pg_temp.id('driver_c'), '임시 기사');
insert into public.vehicles(id, user_id, number, type) values (pg_temp.id('car_a'), pg_temp.id('owner_a'), '초대 시험', 'sub');

-- 1) 차주: 약한 코드·소문자·하이픈 포함·빈 코드는 저장 거절. 권한 거절(42501)만 통과로 센다.
call pg_temp.act_as('owner_a');
set local role authenticated;
select throws_ok(format('insert into public.driver_links(owner_id,vehicle_id,invite_code,status,assignment_start) values(%L,%L,%L,''pending'',%L)',
  pg_temp.id('owner_a'), pg_temp.id('car_a'), '123456', pg_temp.today()), '42501', null, '차주: 6자리 숫자 코드는 저장 거절');
select throws_ok(format('insert into public.driver_links(owner_id,vehicle_id,invite_code,status,assignment_start) values(%L,%L,%L,''pending'',%L)',
  pg_temp.id('owner_a'), pg_temp.id('car_a'), lower('A2B3C4D5E6'), pg_temp.today()), '42501', null, '차주: 소문자 코드는 저장 거절');
select throws_ok(format('insert into public.driver_links(owner_id,vehicle_id,invite_code,status,assignment_start) values(%L,%L,%L,''pending'',%L)',
  pg_temp.id('owner_a'), pg_temp.id('car_a'), 'A2B3C-4D5E6', pg_temp.today()), '42501', null, '차주: 하이픈 섞인 코드는 저장 거절');
select throws_ok(format('insert into public.driver_links(owner_id,vehicle_id,invite_code,status,assignment_start) values(%L,%L,NULL,''pending'',%L)',
  pg_temp.id('owner_a'), pg_temp.id('car_a'), pg_temp.today()), '42501', null, '차주: 코드 없는 초대는 저장 거절');

-- 2) 정상 코드 저장: 화면이 보낸 기한(100일)은 무시하고 서버가 7일로 정한다.
insert into public.driver_links(id, owner_id, vehicle_id, invite_code, status, assignment_start, invite_expires_at)
  values (pg_temp.id('link_a'), pg_temp.id('owner_a'), pg_temp.id('car_a'), 'A2B3C4D5E6', 'pending', pg_temp.today(), now() + interval '100 days');
select is((select invite_expires_at from public.driver_links where id = pg_temp.id('link_a')), now() + interval '7 days',
  '차주: 새 초대 기한은 서버가 7일로 정함');

-- 3) 기한만 늘리기는 무시, 형식 틀린 코드로 바꾸기는 거절, 계약 기간 수정은 그대로 됨.
update public.driver_links set invite_expires_at = now() + interval '100 days' where id = pg_temp.id('link_a');
select is((select invite_expires_at from public.driver_links where id = pg_temp.id('link_a')), now() + interval '7 days',
  '차주: 기한만 늘리기는 무시됨');
select throws_ok(format('update public.driver_links set invite_code = %L where id = %L', '654321', pg_temp.id('link_a')),
  '42501', null, '차주: 형식 틀린 코드로 바꾸기는 거절');
update public.driver_links set assignment_end = pg_temp.today() + 30 where id = pg_temp.id('link_a');
select is((select count(*)::int from public.driver_links where id = pg_temp.id('link_a') and assignment_end = pg_temp.today() + 30), 1,
  '차주: 계약 기간 수정은 됨');

-- 4) 기사: 틀린 코드는 빈 결과와 실패 기록, 다섯 번 뒤 여섯 번째는 막힘.
reset role;
call pg_temp.act_as('driver_c');
set local role authenticated;
select * from pg_temp.wrong_codes();
select throws_ok($$select * from public.redeem_driver_invite_code('A2B3C4D5E6')$$, 'P0001',
  '초대코드를 여러 번 틀렸습니다. 잠시 후 다시 시도해 주세요.', '기사: 여섯 번째 시도는 막힘');
select throws_ok('select * from public.driver_invite_redeem_attempts', '42501', null, '기사: 실패 기록 표는 읽을 수 없음');
reset role;
select is((select count(*)::int from public.driver_invite_redeem_attempts where user_id = pg_temp.id('driver_c')), 5,
  '서버: 실패 기록 5건');
delete from public.driver_invite_redeem_attempts where user_id = pg_temp.id('driver_c');

-- 5) 만료된 코드는 맞아도 연결 안 됨(내부 경로로 기한을 과거로 돌림).
set local app.driver_link_internal = 'on';
update public.driver_links set invite_expires_at = now() - interval '1 minute' where id = pg_temp.id('link_a');
set local app.driver_link_internal = 'off';
call pg_temp.act_as('driver_c');
set local role authenticated;
select is((select count(*)::int from public.redeem_driver_invite_code('A2B3C4D5E6')), 0, '기사: 만료 코드로는 연결 안 됨');

-- 6) 차주 재발급(새 코드) 뒤 기한은 다시 7일. 기사는 소문자·하이픈을 섞어 입력해도 연결.
reset role;
call pg_temp.act_as('owner_a');
set local role authenticated;
update public.driver_links set invite_code = 'Z9Y8X7W6V5' where id = pg_temp.id('link_a');
select is((select invite_expires_at from public.driver_links where id = pg_temp.id('link_a')), now() + interval '7 days',
  '차주: 재발급 기한은 다시 7일');
reset role;
call pg_temp.act_as('driver_c');
set local role authenticated;
select ok((select status = 'linked' and driver_id = pg_temp.id('driver_c')
  from public.redeem_driver_invite_code(lower(substr('Z9Y8X7W6V5', 1, 5)) || ' - ' || substr('Z9Y8X7W6V5', 6))),
  '기사: 소문자·하이픈 섞은 재발급 코드로 연결됨');
reset role;
select is(current_setting('app.driver_link_internal', true), 'off', '서버: 내부 허용 표시가 남지 않음');

-- 7) 비로그인은 수락 함수를 실행할 수 없음.
set local role anon;
select throws_ok($$select public.redeem_driver_invite_code('Z9Y8X7W6V5')$$, '42501', null, '비로그인: 수락 함수 실행 불가');
reset role;

select * from finish();
rollback;
