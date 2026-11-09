-- 0038: 기사 차량(type 'sub')은 계정마다 3대까지 — 넣기와 메인→기사 차량 바꾸기를 서버에서도 막는다(앱 화면 제한과 같은 기준·문구).
-- 있는 차량은 그대로 두고 더 넣는 것만 막는다. create or replace·drop trigger if exists라 다시 실행해도 안전.
begin;

create or replace function public.guard_driver_car_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  if new.type is distinct from 'sub' then return new; end if;
  if tg_op = 'UPDATE' and old.type = 'sub' then return new; end if;
  -- 같은 계정 검사는 한 번에 하나씩(두 기기 동시 등록 대비).
  perform pg_advisory_xact_lock(hashtextextended('driver_car_limit:' || new.user_id::text, 0));
  select count(*) into n from public.vehicles
   where user_id = new.user_id and type = 'sub' and id is distinct from new.id;
  if n >= 3 then
    raise exception '기사 차량은 연동, 미연동 합쳐 최대 3대까지 등록할 수 있습니다.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_driver_car_limit() from public, anon, authenticated;

drop trigger if exists vehicles_guard_driver_car_limit on public.vehicles;
create trigger vehicles_guard_driver_car_limit
  before insert or update of type on public.vehicles
  for each row execute function public.guard_driver_car_limit();

commit;

-- 사후 확인(기대: 자동 검사 2줄 vehicles_guard_driver_car_limit·vehicles_guard_linked_delete / false·{search_path=public} / 3):
-- select tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid = 'public.vehicles'::regclass and not tgisinternal order by tgname;
-- select prosecdef, proconfig from pg_proc where proname = 'guard_driver_car_limit';
-- select max(c) from (select count(*) filter (where type = 'sub') c from public.vehicles group by user_id) t;
-- 되돌리기: drop trigger if exists vehicles_guard_driver_car_limit on public.vehicles; drop function if exists public.guard_driver_car_limit();
