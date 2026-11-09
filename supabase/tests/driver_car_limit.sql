-- 기사 차량 3대 제한 시험(pgTAP): 4대째 넣기·메인→기사 바꾸기 거절, 메인·다른 칸 수정·다른 계정은 그대로.
-- 임시 사용자·차량만 만들고 끝에 되돌린다. CI에서 supabase test db로 돈다.
begin;
select plan(9);
set local statement_timeout = '30s';
set local lock_timeout = '3s';

create function pg_temp.id(name text) returns uuid language sql immutable
as $$ select md5('car-limit-test:' || name)::uuid $$;
create procedure pg_temp.act_as(name text) language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.id(name)::text, ''), true);
  perform set_config('request.jwt.claims', case when name is null then '{}'
    else jsonb_build_object('sub', pg_temp.id(name), 'role', 'authenticated')::text end, true);
end;
$$;

insert into auth.users(id) values (pg_temp.id('user_a')), (pg_temp.id('user_b'));
insert into public.profiles(id, name) values (pg_temp.id('user_a'), '임시 차주 A'), (pg_temp.id('user_b'), '임시 차주 B');

set local role authenticated;
call pg_temp.act_as('user_a');
select lives_ok(format('insert into public.vehicles(id, user_id, number, type) values (%L, auth.uid(), ''제한 1'', ''sub''), (%L, auth.uid(), ''제한 2'', ''sub'')',
  pg_temp.id('sub_1'), pg_temp.id('sub_2')), 'A: 기사 차량 2대 한 번에 넣기');
select lives_ok(format('insert into public.vehicles(id, user_id, number, type) values (%L, auth.uid(), ''제한 3'', ''sub'')', pg_temp.id('sub_3')),
  'A: 3대째 넣기');
select throws_ok($$ insert into public.vehicles(user_id, number, type) values (auth.uid(), '제한 4', 'sub') $$,
  'P0001', '기사 차량은 연동, 미연동 합쳐 최대 3대까지 등록할 수 있습니다.', 'A: 4대째 넣기 거절(앱과 같은 문구)');
select lives_ok(format('insert into public.vehicles(id, user_id, number, type) values (%L, auth.uid(), ''제한 메인'', ''main'')', pg_temp.id('main')),
  'A: 메인 차량 넣기는 그대로');
select throws_ok(format('update public.vehicles set type = ''sub'' where id = %L', pg_temp.id('main')),
  'P0001', null, 'A: 메인 → 기사 차량 바꾸기 거절');
select lives_ok(format('update public.vehicles set type = ''sub'', tonnage = ''5'', archived = true where id = %L', pg_temp.id('sub_3')),
  'A: 3번째 기사 차량 다른 칸 수정(종류 그대로 보내도)은 그대로');

call pg_temp.act_as('user_b');
select lives_ok($$ insert into public.vehicles(user_id, number, type) values (auth.uid(), '제한 B1', 'sub') $$,
  'B: 다른 계정 기사 차량 넣기는 그대로');
select throws_ok($$ insert into public.vehicles(user_id, number, type) values (auth.uid(), '제한 B2', 'sub'), (auth.uid(), '제한 B3', 'sub'), (auth.uid(), '제한 B4', 'sub') $$,
  'P0001', null, 'B: 한 번에 여러 대로 3대 넘기기 거절');
select is((select count(*)::int from public.vehicles where user_id = auth.uid() and type = 'sub'), 1, 'B: 거절된 묶음은 하나도 안 들어감');

call pg_temp.act_as(null);
reset role;

select * from finish();
rollback;
