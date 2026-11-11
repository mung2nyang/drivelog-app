-- 초대 코드로 한 계정이 차주이자 기사가 되지 않게 막는다. 0019 수락 함수에 확인 3개와 초대한 차주 잠금만 더함.
-- 함수 이름·받는 값·돌려주는 값은 그대로라 지금 앱도 그대로 돈다. 표·데이터 변경 없음, 다시 실행해도 안전.
begin;

create or replace function public.redeem_driver_invite_code(p_invite_code text)
returns setof public.driver_links
language plpgsql security definer set search_path = public
as $$
declare
  v_driver uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_invite_code, ''), '[^0-9A-Za-z]', '', 'g'));
  v_link public.driver_links;
  v_owner uuid;
  v_previous text := coalesce(current_setting('app.driver_link_internal', true), 'off');
begin
  if v_driver is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;
  if v_code = '' then
    raise exception '초대코드를 입력해 주세요.' using errcode = '22023';
  end if;
  -- 동일 기사의 수락 시도를 줄 세워 실패 횟수 계산과 중복 수락을 막는다.
  perform 1 from public.profiles where id = v_driver for update;
  if not found then
    raise exception '먼저 본인 정보를 등록해 주세요.' using errcode = 'P0001';
  end if;
  delete from public.driver_invite_redeem_attempts
    where user_id = v_driver and attempted_at < now() - interval '1 day';
  if (select count(*) from public.driver_invite_redeem_attempts
        where user_id = v_driver and attempted_at > now() - interval '10 minutes') >= 5
     or (select count(*) from public.driver_invite_redeem_attempts where user_id = v_driver) >= 20 then
    raise exception '초대코드를 여러 번 틀렸습니다. 잠시 후 다시 시도해 주세요.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.driver_links where driver_id = v_driver and status = 'linked') then
    raise exception '이미 다른 차주에 연동된 계정입니다.' using errcode = 'P0001';
  end if;
  -- 차주로 연동 중인 기사가 있으면 기사가 될 수 없다(한 계정이 차주이자 기사가 되지 않게).
  if exists (select 1 from public.driver_links where owner_id = v_driver and status = 'linked') then
    raise exception '차주로 연동 중인 기사가 있어 기사로 연동할 수 없습니다. 기사 연동을 먼저 해제해 주세요.' using errcode = 'P0001';
  end if;
  select * into v_link from public.driver_links
    where invite_code = v_code and status = 'pending' and driver_id is null
      and invite_expires_at > now()
    for update;
  if not found then
    -- 오류로 끝내면 실패 기록도 되돌려지므로 빈 결과로 돌려준다(화면이 안내 문구로 바꿈).
    insert into public.driver_invite_redeem_attempts(user_id) values (v_driver);
    return;
  end if;
  if v_link.owner_id = v_driver then
    raise exception '본인이 만든 초대 코드는 입력할 수 없습니다.' using errcode = 'P0001';
  end if;
  -- 초대한 차주의 본인 정보도 잠가, 서로의 코드를 동시에 받을 때 둘 다 연결되지 않게 한다.
  perform 1 from public.profiles where id = v_link.owner_id for update;
  if exists (select 1 from public.driver_links where driver_id = v_link.owner_id and status = 'linked') then
    raise exception '지금은 이 초대 코드로 연동할 수 없습니다. 초대한 차주에게 확인해 주세요.' using errcode = 'P0001';
  end if;
  -- 차량도 잠가 소유 변경 및 같은 차량의 서로 다른 초대 동시 수락을 직렬화.
  select user_id into v_owner from public.vehicles where id = v_link.vehicle_id for update;
  if not found or v_owner is distinct from v_link.owner_id
     or v_link.unlink_requested_by is not null or v_link.unlink_requested_at is not null then
    raise exception '유효하지 않은 차량 초대입니다.' using errcode = '42501';
  end if;
  if exists (select 1 from public.driver_links where vehicle_id = v_link.vehicle_id and status = 'linked') then
    raise exception '이미 기사가 연동된 차량입니다.' using errcode = 'P0001';
  end if;
  perform set_config('app.driver_link_internal', 'on', true);
  return query update public.driver_links
    set driver_id = v_driver, status = 'linked', updated_at = now()
    where id = v_link.id returning *;
  perform set_config('app.driver_link_internal', v_previous, true);
exception when others then
  perform set_config('app.driver_link_internal', v_previous, true);
  raise;
end;
$$;
revoke all on function public.redeem_driver_invite_code(text) from public, anon;
grant execute on function public.redeem_driver_invite_code(text) to authenticated;

commit;

-- 사후검증:
-- select pg_get_userbyid(proowner) as owner, prosecdef, proconfig,
--        has_function_privilege('anon', oid, 'execute') as anon_exec,
--        has_function_privilege('authenticated', oid, 'execute') as auth_exec,
--        prosrc like '%차주로 연동 중인 기사가 있어%' as rule_owner,
--        prosrc like '%본인이 만든 초대 코드%' as rule_self,
--        prosrc like '%초대한 차주에게 확인해 주세요%' as rule_inviter
-- from pg_proc where oid = 'public.redeem_driver_invite_code(text)'::regprocedure;
--   기대: postgres, true, {search_path=public}, false, true, true, true, true
-- select count(*) from public.driver_links where status = 'linked';
--   기대: 적용 전과 같은 수(2026-11-11 기준 5)
