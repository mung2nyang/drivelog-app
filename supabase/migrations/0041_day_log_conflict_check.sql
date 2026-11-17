-- 0041: 그날 일지를 다른 기기가 먼저 고쳤으면 저장·지우기를 거절한다.
-- daily_logs에 고친 시각(updated_at)을 더하고, 저장·지우기 때 "알던 시각"을 받는 함수를 새로 만든다.
-- 옛 save_day_log(jsonb, jsonb)·remove_day_log(uuid, date)는 그대로 둔다. 칸 추가만 하는 보존적 변경, 다시 실행해도 안전.
begin;

alter table public.daily_logs add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_daily_logs_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.touch_daily_logs_updated_at() from public, anon, authenticated;

drop trigger if exists daily_logs_touch on public.daily_logs;
create trigger daily_logs_touch before update on public.daily_logs
  for each row execute function public.touch_daily_logs_updated_at();

create or replace function public.lock_unchanged_day_log(p_vehicle_id uuid, p_work_date date, p_expected_updated_at timestamptz)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  cur public.daily_logs;
begin
  select * into cur from public.daily_logs
  where vehicle_id = p_vehicle_id and work_date = p_work_date
  for update;

  if not found then
    if p_expected_updated_at is not null then
      raise exception '다른 기기에서 먼저 고친 일지입니다.' using errcode = 'DL409';
    end if;
    return null;
  end if;

  if p_expected_updated_at is null then
    if exists (select 1 from public.transport_details t where t.daily_log_id = cur.id) then
      raise exception '다른 기기에서 먼저 고친 일지입니다.' using errcode = 'DL409';
    end if;
  elsif cur.updated_at is distinct from p_expected_updated_at then
    raise exception '다른 기기에서 먼저 고친 일지입니다.' using errcode = 'DL409';
  end if;

  return cur.id;
end;
$$;

create or replace function public.save_day_log(p_log jsonb, p_rows jsonb, p_expected_updated_at timestamptz)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  r public.daily_logs;
  v_id uuid;
  v_at timestamptz;
begin
  if jsonb_typeof(p_log) is distinct from 'object' then
    raise exception 'p_log는 객체여야 합니다.' using errcode = 'P0001';
  end if;
  r := jsonb_populate_record(null::public.daily_logs, p_log);

  v_id := public.lock_unchanged_day_log(r.vehicle_id, r.work_date, p_expected_updated_at);
  if v_id is null then
    begin
      insert into public.daily_logs (user_id, vehicle_id, work_date, is_off, fixed_count, pallet_count, raw)
      values (r.user_id, r.vehicle_id, r.work_date, r.is_off, r.fixed_count, r.pallet_count, r.raw)
      returning id, updated_at into v_id, v_at;
    exception when unique_violation then
      raise exception '다른 기기에서 먼저 고친 일지입니다.' using errcode = 'DL409';
    end;
  else
    update public.daily_logs
    set user_id = r.user_id, is_off = r.is_off, fixed_count = r.fixed_count, pallet_count = r.pallet_count, raw = r.raw
    where id = v_id
    returning updated_at into v_at;
  end if;

  perform public.replace_transport_details(v_id, p_rows);
  return v_at;
end;
$$;

create or replace function public.remove_day_log(p_vehicle_id uuid, p_work_date date, p_expected_updated_at timestamptz)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_at timestamptz;
begin
  v_id := public.lock_unchanged_day_log(p_vehicle_id, p_work_date, p_expected_updated_at);
  delete from public.transport_details where vehicle_id = p_vehicle_id and work_date = p_work_date;
  if v_id is null then
    return null;
  end if;
  if exists (select 1 from public.fuel_records where vehicle_id = p_vehicle_id and work_date = p_work_date)
     or exists (select 1 from public.maintenance_records where vehicle_id = p_vehicle_id and work_date = p_work_date)
     or exists (select 1 from public.misc_expense_records where vehicle_id = p_vehicle_id and work_date = p_work_date) then
    update public.daily_logs
    set is_off = false, fixed_count = 0, pallet_count = 0, raw = '{}'::jsonb
    where id = v_id
    returning updated_at into v_at;
    return v_at;
  end if;
  delete from public.daily_logs where id = v_id;
  return null;
end;
$$;

revoke all on function public.lock_unchanged_day_log(uuid, date, timestamptz) from public, anon;
grant execute on function public.lock_unchanged_day_log(uuid, date, timestamptz) to authenticated;
revoke all on function public.save_day_log(jsonb, jsonb, timestamptz) from public, anon;
grant execute on function public.save_day_log(jsonb, jsonb, timestamptz) to authenticated;
revoke all on function public.remove_day_log(uuid, date, timestamptz) from public, anon;
grant execute on function public.remove_day_log(uuid, date, timestamptz) to authenticated;

commit;

-- 사후검증 1(기대: 1줄, updated_at / timestamp with time zone / NO / now())
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns where table_schema = 'public' and table_name = 'daily_logs' and column_name = 'updated_at';

-- 사후검증 2(기대: daily_logs_touch 1줄, BEFORE UPDATE ... touch_daily_logs_updated_at())
-- select tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid = 'public.daily_logs'::regclass and tgname = 'daily_logs_touch';

-- 사후검증 3(기대: 5줄 — lock_unchanged_day_log 1, remove_day_log 2, save_day_log 2.
--   모두 security_definer = false, proconfig = {search_path=public}, anon_exec = false, auth_exec = true)
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer, p.proconfig,
--        has_function_privilege('anon', p.oid, 'execute') as anon_exec,
--        has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname in ('lock_unchanged_day_log', 'save_day_log', 'remove_day_log')
-- order by 1, 2;

-- 되돌리기(앱을 먼저 되돌린 뒤, 칸은 남겨도 무해):
-- drop function if exists public.save_day_log(jsonb, jsonb, timestamptz);
-- drop function if exists public.remove_day_log(uuid, date, timestamptz);
-- drop function if exists public.lock_unchanged_day_log(uuid, date, timestamptz);
-- drop trigger if exists daily_logs_touch on public.daily_logs;
-- drop function if exists public.touch_daily_logs_updated_at();
