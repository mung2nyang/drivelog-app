-- 차주·기사 겸하기 막기 시험(pgTAP): 기사 둔 차주의 수락·자기 코드·기사인 차주의 초대는 거절, 보통 수락은 그대로.
-- 임시 사용자·차량만 만들고 끝에 되돌린다. CI에서 supabase test db로 돈다.
begin;
select plan(9);
set local statement_timeout = '30s';
set local lock_timeout = '3s';

create function pg_temp.id(name text) returns uuid language sql immutable
as $$ select md5('dual-role-test:' || name)::uuid $$;
create function pg_temp.today() returns date language sql stable
as $$ select (now() at time zone 'Asia/Seoul')::date $$;
create procedure pg_temp.act_as(name text) language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.id(name)::text, ''), true);
  perform set_config('request.jwt.claims', case when name is null then '{}'
    else jsonb_build_object('sub', pg_temp.id(name), 'role', 'authenticated')::text end, true);
end;
$$;

select is(current_user::text, 'postgres', '준비: postgres로 실행');
-- 차주 A(기사 X를 둠), 차주 B(대기 초대), 기사 X(A의 기사이면서 자기 차량 초대도 만들어 둠), 기사 D(보통 기사).
insert into auth.users(id) values (pg_temp.id('owner_a')), (pg_temp.id('owner_b')), (pg_temp.id('driver_x')), (pg_temp.id('driver_d'));
insert into public.profiles(id, name) values (pg_temp.id('owner_a'), '임시 차주 A'), (pg_temp.id('owner_b'), '임시 차주 B'),
  (pg_temp.id('driver_x'), '임시 기사 X'), (pg_temp.id('driver_d'), '임시 기사 D');
insert into public.vehicles(id, user_id, number, type) values (pg_temp.id('car_a'), pg_temp.id('owner_a'), '겸하기 A', 'sub'),
  (pg_temp.id('car_b'), pg_temp.id('owner_b'), '겸하기 B', 'sub'), (pg_temp.id('car_x'), pg_temp.id('driver_x'), '겸하기 X', 'sub');
-- 대기 초대는 차주 본인만 만들 수 있어(0017) 차주마다 로그인 흉내를 바꿔 넣는다.
create procedure pg_temp.invite(p_owner text, p_car text, p_code text) language plpgsql as $$
begin
  call pg_temp.act_as(p_owner);
  insert into public.driver_links(id, owner_id, vehicle_id, invite_code, status, assignment_start)
    values (pg_temp.id('link_' || p_owner), pg_temp.id(p_owner), pg_temp.id(p_car), p_code, 'pending', pg_temp.today());
end;
$$;
call pg_temp.invite('owner_a', 'car_a', 'D2D3D4D5D6');
call pg_temp.invite('owner_b', 'car_b', 'E2E3E4E5E6');
call pg_temp.invite('driver_x', 'car_x', 'F2F3F4F5F6');

-- 1) 기사 X가 차주 A의 코드를 받아 A의 기사가 된다(보통 수락).
set local role authenticated;
call pg_temp.act_as('driver_x');
select ok((select driver_id = pg_temp.id('driver_x') and status = 'linked' from public.redeem_driver_invite_code('D2D3D4D5D6')),
  '준비: 기사 X가 차주 A의 기사로 연동됨');

-- 2) 기사를 둔 차주 A는 남의 코드를 받을 수 없다.
call pg_temp.act_as('owner_a');
select throws_ok($$select public.redeem_driver_invite_code('E2E3E4E5E6')$$, 'P0001',
  '차주로 연동 중인 기사가 있어 기사로 연동할 수 없습니다. 기사 연동을 먼저 해제해 주세요.', '차주 A: 기사 둔 채로 남의 코드 거절');

-- 3) 자기 코드는 받을 수 없다.
call pg_temp.act_as('owner_b');
select throws_ok($$select public.redeem_driver_invite_code('E2E3E4E5E6')$$, 'P0001',
  '본인이 만든 초대 코드는 입력할 수 없습니다.', '차주 B: 자기 코드 거절');

-- 4) 남의 기사로 연동 중인 X가 만들어 둔 초대는 받을 수 없다.
call pg_temp.act_as('driver_d');
select throws_ok($$select public.redeem_driver_invite_code('F2F3F4F5F6')$$, 'P0001',
  '지금은 이 초대 코드로 연동할 수 없습니다. 초대한 차주에게 확인해 주세요.', '기사 D: 기사인 차주의 초대 거절');

-- 5) 보통 기사 D는 차주 B의 코드를 그대로 받는다.
select ok((select driver_id = pg_temp.id('driver_d') and status = 'linked' from public.redeem_driver_invite_code('E2E3E4E5E6')),
  '기사 D: 보통 차주 코드 수락은 그대로');

call pg_temp.act_as(null);
reset role;
select is((select count(*)::int from public.driver_links where id = pg_temp.id('link_driver_x') and status = 'pending' and driver_id is null), 1,
  '서버: 거절된 X의 초대는 대기 그대로');
select is((select count(*)::int from public.driver_links where owner_id = pg_temp.id('owner_a') and status = 'linked'), 1,
  '서버: 차주 A의 기존 연동은 그대로');
select is((select count(*)::int from public.driver_invite_redeem_attempts
  where user_id in (pg_temp.id('owner_a'), pg_temp.id('owner_b'), pg_temp.id('driver_d'))), 0,
  '서버: 겸하기 거절은 틀린 코드 횟수에 안 셈');

select * from finish();
rollback;
