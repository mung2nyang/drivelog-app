-- 0037: 해제 기록에 그때 차량의 기사 이름을 남긴다 — 매출·기사 관리의 이전 기사 줄 이름용.
-- 칸 추가·create or replace라 다시 실행해도 안전. 이미 해제된 기록은 비워 둔다.
begin;

alter table public.driver_links add column if not exists driver_name text;

create or replace function public.disconnect_driver_link_internal(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  perform set_config('app.driver_link_internal', 'on', true);
  update public.driver_links
     set status = 'disconnected', assignment_end = (now() at time zone 'Asia/Seoul')::date,
         unlink_requested_by = null, unlink_requested_at = null, updated_at = now(),
         -- 해제 순간 차량 기사 이름(비었으면 null).
         driver_name = (select nullif(btrim(v.driver_name), '') from public.vehicles v where v.id = driver_links.vehicle_id)
   where id = p_link_id and status = 'linked';
  get diagnostics n = row_count;
  perform set_config('app.driver_link_internal', 'off', true);
  if n > 0 then
    perform public.copy_driver_link_records_internal(p_link_id);
  end if;
end;
$$;
revoke all on function public.disconnect_driver_link_internal(uuid) from public;
revoke execute on function public.disconnect_driver_link_internal(uuid) from anon, authenticated;

commit;

-- 사후 확인(기대: text 1줄 / true·{search_path=public}·true·true / false / 0):
-- select data_type from information_schema.columns where table_schema = 'public' and table_name = 'driver_links' and column_name = 'driver_name';
-- select prosecdef, proconfig, position('copy_driver_link_records_internal' in prosrc) > 0 as has_copy, position('driver_name' in prosrc) > 0 as has_name from pg_proc where proname = 'disconnect_driver_link_internal';
-- select has_function_privilege('authenticated', 'public.disconnect_driver_link_internal(uuid)', 'execute') as auth_can;
-- select count(*) from public.driver_links where status = 'disconnected' and driver_name is not null;
-- 되돌리기: disconnect_driver_link_internal을 0012 본문(이름 줄 없는 버전)으로 다시 만든다. (칸은 남겨 둠 — 옛 앱 무해)
