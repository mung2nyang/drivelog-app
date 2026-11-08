-- 기사 연동 보안 시험(pgTAP): 공격 거절·정상 초대·수락·해제·기록 복사·재연동·비로그인.
-- 임시 사용자·차량만 만들고 끝에 되돌린다. CI에서 supabase test db로 돈다.
begin;
select plan(80);
set local statement_timeout = '30s';
set local lock_timeout = '3s';

-- 시험용 고정 아이디(이름마다 같은 값)와 로그인 사용자 흉내.
create function pg_temp.id(name text) returns uuid language sql immutable
as $$ select md5('link-test:' || name)::uuid $$;
create function pg_temp.day_a() returns date language sql stable
as $$ select (now() at time zone 'Asia/Seoul')::date - 10 $$;
create procedure pg_temp.act_as(name text) language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.id(name)::text, ''), true);
  perform set_config('request.jwt.claims', case when name is null then '{}'
    else jsonb_build_object('sub', pg_temp.id(name), 'role', 'authenticated')::text end, true);
end;
$$;
-- 바뀐 줄 수. 권한 거절(42501)이면 0으로 본다.
create function pg_temp.changed_rows(sql_text text) returns int language plpgsql as $$
declare n int;
begin
  execute sql_text;
  get diagnostics n = row_count;
  return n;
exception when insufficient_privilege then
  return 0;
end;
$$;
-- 기록 표 6개에서 그 차량 줄이 몇 개 보이는지.
create function pg_temp.visible_rows(car uuid, expected int, who text) returns setof text language plpgsql as $$
declare
  target text;
  n int;
begin
  foreach target in array array['daily_logs','transport_details','fuel_records','maintenance_records','misc_expense_records','daily_inspections'] loop
    execute format('select count(*)::int from public.%I where vehicle_id = %L', target, car) into n;
    return next is(n, expected, format('%s: %s 줄 %s개 보임', who, target, expected));
  end loop;
end;
$$;
-- 해제 뒤 기사: 차주 차량 기록 표 6개의 고치기·지우기에 바뀌는 줄이 없음.
create function pg_temp.blocked_after_unlink() returns setof text language plpgsql as $$
declare target text;
begin
  foreach target in array array['daily_logs','transport_details','fuel_records','maintenance_records','misc_expense_records','daily_inspections'] loop
    return next is(pg_temp.changed_rows(format('update public.%I set work_date = work_date where vehicle_id = %L', target, pg_temp.id('car_a'))), 0,
      format('해제 뒤 기사: %s 고치기 안 됨', target));
    return next is(pg_temp.changed_rows(format('delete from public.%I where vehicle_id = %L', target, pg_temp.id('car_a'))), 0,
      format('해제 뒤 기사: %s 지우기 안 됨', target));
  end loop;
end;
$$;
-- 해제 뒤 기사: 차주 차량에 일지 딸린 기록 4종을 새로 넣을 수 없음.
create function pg_temp.detail_insert_denied() returns setof text language plpgsql as $$
declare target text;
begin
  foreach target in array array['transport_details','fuel_records','maintenance_records','misc_expense_records'] loop
    return next throws_ok(format('insert into public.%I(daily_log_id,user_id,vehicle_id,work_date) values(%L,%L,%L,%L)',
      target, pg_temp.id('log_a'), pg_temp.id('driver_c'), pg_temp.id('car_a'), pg_temp.day_a()),
      '42501', null, format('해제 뒤 기사: %s 넣기 거절', target));
  end loop;
end;
$$;

-- 준비: 차주 A·다른 차주 B·기사 C, 차량 3대, 차량 A의 일지와 딸린 기록.
select is(current_user::text, 'postgres', '준비: postgres로 실행');
insert into auth.users(id) values (pg_temp.id('owner_a')), (pg_temp.id('owner_b')), (pg_temp.id('driver_c'));
insert into public.profiles(id, name) values
  (pg_temp.id('owner_a'), '임시 차주'), (pg_temp.id('owner_b'), '임시 타인'), (pg_temp.id('driver_c'), '임시 기사');
insert into public.vehicles(id, user_id, number, type, driver_name) values
  (pg_temp.id('car_a'), pg_temp.id('owner_a'), '연동 시험 A', 'sub', ' 연동 시험 기사 '),
  (pg_temp.id('car_a2'), pg_temp.id('owner_a'), '연동 시험 A2', 'sub', null),
  (pg_temp.id('car_b'), pg_temp.id('owner_b'), '연동 시험 B', 'sub', null);
insert into public.daily_logs(id, user_id, vehicle_id, work_date, raw)
  values (pg_temp.id('log_a'), pg_temp.id('owner_a'), pg_temp.id('car_a'), pg_temp.day_a(), '{}');
insert into public.transport_details(daily_log_id, user_id, vehicle_id, work_date)
  values (pg_temp.id('log_a'), pg_temp.id('owner_a'), pg_temp.id('car_a'), pg_temp.day_a());
insert into public.fuel_records(daily_log_id, user_id, vehicle_id, work_date)
  values (pg_temp.id('log_a'), pg_temp.id('owner_a'), pg_temp.id('car_a'), pg_temp.day_a());
insert into public.maintenance_records(daily_log_id, user_id, vehicle_id, work_date)
  values (pg_temp.id('log_a'), pg_temp.id('owner_a'), pg_temp.id('car_a'), pg_temp.day_a());
insert into public.misc_expense_records(daily_log_id, user_id, vehicle_id, work_date)
  values (pg_temp.id('log_a'), pg_temp.id('owner_a'), pg_temp.id('car_a'), pg_temp.day_a());
insert into public.daily_inspections(user_id, vehicle_id, work_date, items, inspector_name)
  values (pg_temp.id('owner_a'), pg_temp.id('car_a'), pg_temp.day_a(), '{"brakes":"good"}', '연동 시험');

-- 1) 차주 A: 정상 초대는 되고, 남의 차량·상태·기사 칸을 조작한 초대는 모두 거절.
call pg_temp.act_as('owner_a');
set local role authenticated;
select ok(current_user = 'authenticated' and auth.uid() = pg_temp.id('owner_a'), '차주: 로그인 사용자 문맥');
insert into public.driver_links(id, owner_id, vehicle_id, invite_code, status, assignment_start)
  values (pg_temp.id('link_a'), pg_temp.id('owner_a'), pg_temp.id('car_a'), 'M2N3P4Q5R6', 'pending', pg_temp.day_a());
update public.driver_links set assignment_end = pg_temp.day_a() + 30 where id = pg_temp.id('link_a');
select is((select count(*)::int from public.driver_links where id = pg_temp.id('link_a') and assignment_end = pg_temp.day_a() + 30), 1,
  '차주: 정상 초대 만들기·계약 기간 수정');
select throws_ok(format('insert into public.driver_links(owner_id,vehicle_id) values(%L,%L)', pg_temp.id('owner_a'), pg_temp.id('car_b')),
  '42501', null, '차주: 남의 차량 초대 거절');
select throws_ok(format('insert into public.driver_links(owner_id,vehicle_id,status) values(%L,%L,''linked'')', pg_temp.id('owner_a'), pg_temp.id('car_a')),
  '42501', null, '차주: 연동됨 상태로 넣기 거절');
select throws_ok(format('insert into public.driver_links(owner_id,vehicle_id,status) values(%L,%L,''disconnected'')', pg_temp.id('owner_a'), pg_temp.id('car_a')),
  '42501', null, '차주: 해제됨 상태로 넣기 거절');
select throws_ok(format('insert into public.driver_links(owner_id,vehicle_id,status) values(%L,%L,NULL)', pg_temp.id('owner_a'), pg_temp.id('car_a')),
  '42501', null, '차주: 상태 없이 넣기 거절');
select throws_ok(format('insert into public.driver_links(owner_id,vehicle_id,driver_id) values(%L,%L,%L)', pg_temp.id('owner_a'), pg_temp.id('car_a'), pg_temp.id('owner_a')),
  '42501', null, '차주: 자기를 기사로 넣기 거절');
select throws_ok(format('insert into public.driver_links(owner_id,vehicle_id,driver_id) values(%L,%L,%L)', pg_temp.id('owner_a'), pg_temp.id('car_a'), pg_temp.id('driver_c')),
  '42501', null, '차주: 기사를 바로 넣기 거절');
select throws_ok(format('insert into public.driver_links(owner_id,vehicle_id,unlink_requested_by) values(%L,%L,%L)', pg_temp.id('owner_a'), pg_temp.id('car_a'), pg_temp.id('owner_a')),
  '42501', null, '차주: 해제 요청자 칸 넣기 거절');
select throws_ok(format('insert into public.driver_links(owner_id,vehicle_id,unlink_requested_at) values(%L,%L,now())', pg_temp.id('owner_a'), pg_temp.id('car_a')),
  '42501', null, '차주: 해제 요청 시각 칸 넣기 거절');
select throws_ok(format('update public.driver_links set status=''linked'' where id=%L', pg_temp.id('link_a')),
  '42501', null, '차주: 상태를 연동됨으로 바꾸기 거절');
select throws_ok(format('update public.driver_links set driver_id=%L where id=%L', pg_temp.id('driver_c'), pg_temp.id('link_a')),
  '42501', null, '차주: 기사 칸 바꾸기 거절');
select throws_ok(format('update public.driver_links set vehicle_id=%L where id=%L', pg_temp.id('car_b'), pg_temp.id('link_a')),
  '42501', null, '차주: 남의 차량으로 바꾸기 거절');
select throws_ok(format('update public.driver_links set owner_id=%L where id=%L', pg_temp.id('owner_b'), pg_temp.id('link_a')),
  '42501', null, '차주: 차주 칸 바꾸기 거절');
-- 내부 허용 표시를 켜도 로그인 사용자는 막힌다.
set local app.driver_link_internal = 'on';
select throws_ok(format('update public.driver_links set status=''linked'', driver_id=%L where id=%L', pg_temp.id('driver_c'), pg_temp.id('link_a')),
  '42501', null, '차주: 내부 표시를 켜고 연동됨으로 바꾸기 거절');
set local app.driver_link_internal = 'off';
select is((select count(*)::int from public.driver_links where owner_id = pg_temp.id('owner_a')), 1, '차주: 공격 행이 남지 않음');

-- 2) 기사 C: 정상 수락, 중복 수락 거절, 계약 기간 안만 접근, 연동 중엔 차주 기록이 보임.
reset role;
call pg_temp.act_as('driver_c');
set local role authenticated;
select ok((select driver_id = pg_temp.id('driver_c') and status = 'linked' from public.redeem_driver_invite_code('M2N3P4Q5R6')),
  '기사: 정상 수락');
select is(current_setting('app.driver_link_internal', true), 'off', '서버: 내부 허용 표시가 남지 않음');
select throws_ok($$select public.redeem_driver_invite_code('M2N3P4Q5R6')$$, 'P0001',
  '이미 다른 차주에 연동된 계정입니다.', '기사: 중복 수락 거절');
select ok(public.driver_can_access_vehicle_date(pg_temp.id('car_a'), pg_temp.day_a()), '기사: 계약 시작일은 접근됨');
select ok(not public.driver_can_access_vehicle_date(pg_temp.id('car_a'), pg_temp.day_a() - 1), '기사: 계약 시작 전날은 접근 안 됨');
select is((select count(*)::int from public.profiles where id = pg_temp.id('owner_a')), 1, '기사: 연동 중 차주 프로필 보임');
select * from pg_temp.visible_rows(pg_temp.id('car_a'), 1, '연동 중 기사');
select lives_ok(format('select public.request_driver_unlink(%L)', pg_temp.id('link_a')), '기사: 해제 요청');
select lives_ok(format('select public.cancel_driver_unlink(%L)', pg_temp.id('link_a')), '기사: 해제 요청 취소');
select is((select count(*)::int from public.driver_links where id = pg_temp.id('link_a') and unlink_requested_by is null), 1,
  '기사: 취소 뒤 해제 요청자 비어 있음');
select lives_ok(format('select public.request_driver_unlink(%L)', pg_temp.id('link_a')), '기사: 다시 해제 요청');

-- 3) 차주 A: 해제 요청 중 차량·기사 바꾸기 거절, 동의 해제 뒤 다시 연동됨으로 못 바꿈, 기사 프로필 안 보임.
reset role;
call pg_temp.act_as('owner_a');
set local role authenticated;
update public.driver_links set assignment_end = null where id = pg_temp.id('link_a');
select throws_ok(format('update public.driver_links set vehicle_id=%L where id=%L', pg_temp.id('car_a2'), pg_temp.id('link_a')),
  '42501', null, '차주: 연동 중 차량 바꾸기 거절');
select throws_ok(format('update public.driver_links set driver_id=%L where id=%L', pg_temp.id('owner_b'), pg_temp.id('link_a')),
  '42501', null, '차주: 연동 중 기사 바꾸기 거절');
select is((select status from public.consent_driver_unlink(pg_temp.id('link_a'))), 'disconnected', '차주: 해제 동의');
select is((select driver_name from public.driver_links where id = pg_temp.id('link_a')), '연동 시험 기사', '차주: 해제 기록에 그때 차량 기사 이름이 남음');
select throws_ok(format('update public.driver_links set status=''linked'' where id=%L', pg_temp.id('link_a')),
  '42501', null, '차주: 해제 뒤 연동됨으로 되돌리기 거절');
select is((select count(*)::int from public.profiles where id = pg_temp.id('driver_c')), 0, '차주: 해제 뒤 기사 프로필 안 보임');

-- 4) 기사 C: 해제 뒤 차주 정보·기록을 못 보고 못 바꾸며, 자기 메인 차량으로 기록이 복사됨.
reset role;
call pg_temp.act_as('driver_c');
set local role authenticated;
select is((select count(*)::int from public.profiles where id = pg_temp.id('owner_a')), 0, '해제 뒤 기사: 차주 프로필 안 보임');
select is((select count(*)::int from public.vehicles where id = pg_temp.id('car_a')), 0, '해제 뒤 기사: 차주 차량 안 보임');
select * from pg_temp.visible_rows(pg_temp.id('car_a'), 0, '해제 뒤 기사');
select * from pg_temp.blocked_after_unlink();
select throws_ok(format('insert into public.daily_logs(user_id,vehicle_id,work_date) values(%L,%L,%L)',
  pg_temp.id('driver_c'), pg_temp.id('car_a'), pg_temp.day_a() - 2), '42501', null, '해제 뒤 기사: daily_logs 넣기 거절');
select * from pg_temp.detail_insert_denied();
select throws_ok(format('insert into public.daily_inspections(user_id,vehicle_id,work_date,items) values(%L,%L,%L,''{}'')',
  pg_temp.id('driver_c'), pg_temp.id('car_a'), pg_temp.day_a() - 2), '42501', null, '해제 뒤 기사: daily_inspections 넣기 거절');
select isnt((select id from public.vehicles where user_id = pg_temp.id('driver_c') and type = 'main'), null,
  '해제 뒤 기사: 메인 차량이 복사됨');
select * from pg_temp.visible_rows((select id from public.vehicles where user_id = pg_temp.id('driver_c') and type = 'main'), 1,
  '해제 뒤 기사 메인 차량');

-- 5) 같은 기사 재연동: 지난 계약 기간도 계속 접근되고, 3일 지난 해제 요청은 한 번만 정리됨.
reset role;
call pg_temp.act_as('owner_a');
set local role authenticated;
insert into public.driver_links(id, owner_id, vehicle_id, invite_code, assignment_start)
  values (pg_temp.id('link_again'), pg_temp.id('owner_a'), pg_temp.id('car_a'), 'M7N8P9Q2R3', pg_temp.day_a() + 10);
reset role;
call pg_temp.act_as('driver_c');
set local role authenticated;
select lives_ok($$select public.redeem_driver_invite_code('M7N8P9Q2R3')$$, '재연동: 기사 수락');
select ok(public.driver_can_access_vehicle_date(pg_temp.id('car_a'), pg_temp.day_a()), '재연동: 지난 계약 기간도 접근됨');
select lives_ok(format('select public.request_driver_unlink(%L)', pg_temp.id('link_again')), '재연동: 기사 해제 요청');
reset role;
-- 시험 행 하나만 4일 전 요청으로 돌린다(서버 준비라 공격으로 세지 않음).
set local app.driver_link_internal = 'on';
update public.driver_links set unlink_requested_at = now() - interval '4 days' where id = pg_temp.id('link_again');
set local app.driver_link_internal = 'off';
set local role authenticated;
select is(public.settle_expired_driver_unlinks(), 1, '재연동: 3일 지난 해제 요청 1건 정리');
select is(public.settle_expired_driver_unlinks(), 0, '재연동: 같은 요청을 두 번 정리하지 않음');

-- 6) 비로그인은 초대 넣기·계정 삭제·접근 판단 함수를 쓸 수 없음.
reset role;
call pg_temp.act_as(null);
set local role anon;
select throws_ok(format('insert into public.driver_links(owner_id,vehicle_id) values(%L,%L)', pg_temp.id('owner_a'), pg_temp.id('car_a')),
  '42501', null, '비로그인: 초대 넣기 거절');
select throws_ok('select public.delete_own_account()', '42501', null, '비로그인: 계정 삭제 거절');
select throws_ok(format('select public.driver_can_access_vehicle_date(%L,%L)', pg_temp.id('car_a'), pg_temp.day_a()),
  '42501', null, '비로그인: 접근 판단 함수 거절');
reset role;

select * from finish();
rollback;

-- 동시 수락 별도 검증(아직 미실행): 격리된 시험 DB에서 두 로그인 연결을 사용한다.
-- 1) 같은 기사·다른 초대, 2) 다른 기사·같은 초대, 3) 다른 기사·같은 차량의 다른 초대.
-- 첫 연결의 수락 트랜잭션을 열어 둔 채 두 번째 수락이 대기하는지 관찰한다.
-- 첫 연결 COMMIT 후 두 번째는 이미 연동 오류; 최종 linked가 한 건인지 확인한다.
-- 준비 데이터가 두 연결에 보여야 하므로 위 단일 트랜잭션 시험으로 동시성을 주장하지 않는다.
