-- 서버 알림 트리거 시험(pgTAP): 문의 넣기·답변·기사 연결 때만 부르기 요청이 쌓이고, 금고 값이 없어도 원래 일은 성공한다.
-- 임시 사용자·문의·연결만 만들고 끝에 되돌린다. CI에서 supabase test db로 돈다.
begin;
select plan(10);
set local statement_timeout = '30s';
set local lock_timeout = '3s';

create function pg_temp.id(name text) returns uuid language sql immutable
as $$ select md5('push-trigger-test:' || name)::uuid $$;
create procedure pg_temp.act_as(name text) language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.id(name)::text, ''), true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id(name), 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.queued() returns int language sql
as $$ select count(*)::int from net.http_request_queue $$;
create function pg_temp.last_body() returns jsonb language sql
as $$ select convert_from(body, 'utf8')::jsonb from net.http_request_queue order by id desc limit 1 $$;

insert into auth.users(id) values (pg_temp.id('admin')), (pg_temp.id('user')), (pg_temp.id('owner')), (pg_temp.id('driver'));
insert into public.profiles(id, name) values
  (pg_temp.id('admin'), '임시 관리자'), (pg_temp.id('user'), '임시 사용자'), (pg_temp.id('owner'), '임시 차주'), (pg_temp.id('driver'), '임시 기사');
insert into public.admin_users(user_id) values (pg_temp.id('admin'));

-- 금고 값이 없으면 부르지 않지만 문의 넣기는 성공.
create temp table counts(n int);
insert into counts select pg_temp.queued();
select lives_ok(format($$ insert into public.support_inquiries(id, user_id, type, title, content) values (%L, %L, 'etc', '제목', '내용') $$, pg_temp.id('q0'), pg_temp.id('user')),
  '금고 값 없음: 문의 넣기 성공');
select is(pg_temp.queued(), (select n from counts), '금고 값 없음: 부르기 요청 없음');

select vault.create_secret('http://127.0.0.1:9/functions/v1/send-push', 'push_function_url');
select vault.create_secret('test-secret', 'push_secret');

delete from counts; insert into counts select pg_temp.queued();
insert into public.support_inquiries(id, user_id, type, title, content) values (pg_temp.id('q1'), pg_temp.id('user'), 'etc', '제목', '내용');
select is(pg_temp.queued(), (select n from counts) + 1, '새 문의: 부르기 요청 1개');
select is(pg_temp.last_body(), jsonb_build_object('kind', 'adminInquiry', 'userIds', jsonb_build_array(pg_temp.id('admin'))), '새 문의: 관리자에게, 제목·내용 없음');

delete from counts; insert into counts select pg_temp.queued();
update public.support_inquiries set answer = '답변', status = 'answered', answered_at = now() where id = pg_temp.id('q1');
select is(pg_temp.queued(), (select n from counts) + 1, '답변: 부르기 요청 1개');
select is(pg_temp.last_body(), jsonb_build_object('kind', 'inquiryAnswer', 'userIds', jsonb_build_array(pg_temp.id('user'))), '답변: 문의한 사람에게');

delete from counts; insert into counts select pg_temp.queued();
update public.support_inquiries set answer = '답변', status = 'answered' where id = pg_temp.id('q1');
select is(pg_temp.queued(), (select n from counts), '같은 답변으로 다시 저장: 요청 없음');

-- 실제 경로: 사장님이 초대를 만들고 기사가 초대 코드 함수로 수락한다.
insert into public.vehicles(id, user_id, number, type) values (pg_temp.id('car'), pg_temp.id('owner'), '트리거 시험', 'sub');
call pg_temp.act_as('owner');
set local role authenticated;
insert into public.driver_links(id, owner_id, vehicle_id, invite_code, status, assignment_start)
  values (pg_temp.id('link'), pg_temp.id('owner'), pg_temp.id('car'), 'P2Q3R4S5T6', 'pending', (now() at time zone 'Asia/Seoul')::date);
reset role;
delete from counts; insert into counts select pg_temp.queued();
call pg_temp.act_as('driver');
set local role authenticated;
select lives_ok($$ select public.redeem_driver_invite_code('P2Q3R4S5T6') $$, '기사 연결: 초대 코드 수락 성공');
reset role;
select is(pg_temp.queued(), (select n from counts) + 1, '기사 연결: 부르기 요청 1개');
select is(pg_temp.last_body(), jsonb_build_object('kind', 'driverLinked', 'userIds', jsonb_build_array(pg_temp.id('owner'))), '기사 연결: 사장님에게');

select * from finish();
rollback;
