-- 운영 DB 구조 시작점 2/4: 서버 함수.
-- 2026-11-02 운영 DB에서 읽어 옴(migrations 0031까지 반영). 구조만 담고 사용자 데이터는 없다.

-- 함수끼리 서로 부르므로 만들 때 본문 검사는 끈다.
set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.admin_answer_support_inquiry(inquiry_id uuid, answer_text text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
if not public.is_admin() then
raise exception '관리자만 답변할 수 있습니다.' using errcode = '42501';
end if;
if answer_text is null or btrim(answer_text) = '' then
raise exception '답변 내용이 비어 있습니다.' using errcode = '22023';
end if;
update public.support_inquiries
set answer = answer_text, status = 'answered', answered_at = now()
where id = inquiry_id;
if not found then
raise exception '없는 문의입니다.' using errcode = 'P0002';
end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_list_support_inquiries()
 RETURNS TABLE(id uuid, type text, title text, content text, status text, answer text, answered_at timestamp with time zone, created_at timestamp with time zone, user_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
if not public.is_admin() then
raise exception '관리자만 볼 수 있습니다.' using errcode = '42501';
end if;
return query
select q.id, q.type, q.title, q.content, q.status, q.answer, q.answered_at, q.created_at, p.name
from public.support_inquiries q
left join public.profiles p on p.id = q.user_id
order by (q.answer is null or btrim(q.answer) = '') desc, q.created_at desc;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.cancel_driver_unlink(p_link_id uuid)
 RETURNS SETOF driver_links
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform set_config('app.driver_link_internal', 'on', true);
  update public.driver_links
     set unlink_requested_by = null, unlink_requested_at = null, updated_at = now()
   where id = p_link_id and status = 'linked' and unlink_requested_by = auth.uid();
  if not found then
    perform set_config('app.driver_link_internal', 'off', true);
    raise exception '취소할 해제 요청이 없습니다.' using errcode = 'P0002';
  end if;
  perform set_config('app.driver_link_internal', 'off', true);
  return query select * from public.driver_links where id = p_link_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.consent_driver_unlink(p_link_id uuid)
 RETURNS SETOF driver_links
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.driver_links;
begin
  select * into v from public.driver_links
   where id = p_link_id and status = 'linked' and (owner_id = auth.uid() or driver_id = auth.uid())
   for update;
  if not found or v.unlink_requested_by is null or v.unlink_requested_by = auth.uid() then
    raise exception '동의할 해제 요청이 없습니다.' using errcode = 'P0002';
  end if;
  perform public.disconnect_driver_link_internal(p_link_id);
  return query select * from public.driver_links where id = p_link_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.copy_driver_link_records_internal(p_link_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l public.driver_links;
  v public.vehicles;
  d_vehicle uuid;
  d_log uuid;
  d_new boolean;
  r record;
  oc public.clients;
  dc_id uuid;
  dc_legacy text;
  cmap jsonb := '{}'::jsonb;
  off_t integer;
  off_f integer;
  off_m integer;
  off_x integer;
  fc public.clients;
  d_has_fixed boolean;
  route_keys jsonb;
  o_settings jsonb;
  d_settings jsonb;
  d_presets jsonb;
  p jsonb;
  added integer := 0;
begin
  select * into l from public.driver_links where id = p_link_id;
  if not found or l.driver_id is null then return; end if;
  if not exists (select 1 from public.profiles where id = l.driver_id) then return; end if;
  select * into v from public.vehicles where id = l.vehicle_id;
  if not found then return; end if;

  select id into d_vehicle from public.vehicles
   where user_id = l.driver_id and type = 'main' order by display_order, id limit 1;
  if d_vehicle is null then
    d_vehicle := gen_random_uuid();
    insert into public.vehicles (id, user_id, legacy_log_id, number, type, tonnage, display_order, raw)
    values (d_vehicle, l.driver_id, 'main', v.number, 'main', v.tonnage, 0,
            jsonb_build_object('type', 'main', 'number', v.number, 'tonnage', coalesce(v.tonnage, ''), 'supabaseId', d_vehicle));
  end if;

  -- 7-D-3 ②: 기사 계정에 원래 고정노선 거래처가 있었는지(있으면 복사본은 일반 거래처로). 복사 기간에 고정 횟수·파렛트가 있으면
  -- 앱과 같은 규칙(그 차량 전용 → 없으면 차주 공용)으로 차주 고정노선 거래처 1곳을 골라 아래 거래처 복사에 함께 넣는다.
  d_has_fixed := exists (select 1 from public.clients where user_id = l.driver_id and raw ->> 'fixedRouteLinked' = 'true');
  if exists (select 1 from public.daily_logs
              where vehicle_id = l.vehicle_id and (coalesce(fixed_count, 0) > 0 or coalesce(pallet_count, 0) > 0)
                and (l.assignment_start is null or work_date >= l.assignment_start)
                and (l.assignment_end is null or work_date <= l.assignment_end)) then
    select c.* into fc from public.clients c
     where c.user_id = l.owner_id and c.raw ->> 'fixedRouteLinked' = 'true' and c.raw ->> 'scopedToVehicleNumber' = v.number
     order by c.display_order, c.id limit 1;
    if fc.id is null then
      select c.* into fc from public.clients c
       where c.user_id = l.owner_id and c.raw ->> 'fixedRouteLinked' = 'true' and coalesce(c.raw ->> 'scopedToVehicleNumber', '') = ''
       order by c.display_order, c.id limit 1;
    end if;
  end if;

  for oc in
    select c.* from public.clients c
     where c.id in (
       select td.client_id from public.transport_details td
        where td.vehicle_id = l.vehicle_id and td.client_id is not null
          and (l.assignment_start is null or td.work_date >= l.assignment_start)
          and (l.assignment_end is null or td.work_date <= l.assignment_end))
        or c.id = fc.id
  loop
    select id, legacy_client_id into dc_id, dc_legacy from public.clients
     where user_id = l.driver_id and company_name is not distinct from oc.company_name order by id limit 1;
    if dc_id is null then
      dc_id := gen_random_uuid();
      dc_legacy := oc.legacy_client_id;
      if dc_legacy is not null and exists (select 1 from public.clients where user_id = l.driver_id and legacy_client_id = dc_legacy) then
        dc_legacy := dc_legacy || '-' || substr(dc_id::text, 1, 8);
      end if;
      insert into public.clients (id, user_id, legacy_client_id, company_name, manager_name, biz_number, phone,
                                  tax_invoice_enabled, is_pinned, comm_enabled, comm_type, comm_value,
                                  payment_term, payment_term_value, display_order, raw)
      values (dc_id, l.driver_id, dc_legacy, oc.company_name, oc.manager_name, oc.biz_number, oc.phone,
              oc.tax_invoice_enabled, oc.is_pinned, oc.comm_enabled, oc.comm_type, oc.comm_value,
              oc.payment_term, oc.payment_term_value,
              (select coalesce(max(display_order) + 1, 0) from public.clients where user_id = l.driver_id),
              case when oc.raw is null then null
                   when oc.raw ? 'fixedRouteLinked' then
                     jsonb_set(jsonb_set(oc.raw - 'scopedToVehicleNumber', '{id}', to_jsonb(coalesce(dc_legacy, dc_id::text))),
                               '{fixedRouteLinked}', to_jsonb(coalesce(oc.id = fc.id, false) and not d_has_fixed))
                   else jsonb_set(oc.raw - 'scopedToVehicleNumber', '{id}', to_jsonb(coalesce(dc_legacy, dc_id::text))) end);
    end if;
    cmap := cmap || jsonb_build_object(oc.id::text, jsonb_build_object('id', dc_id, 'legacy', dc_legacy, 'olegacy', oc.legacy_client_id));
    dc_id := null; dc_legacy := null;
  end loop;

  for r in
    select * from public.daily_logs
     where vehicle_id = l.vehicle_id
       and (l.assignment_start is null or work_date >= l.assignment_start)
       and (l.assignment_end is null or work_date <= l.assignment_end)
     order by work_date
  loop
    d_log := null;
    insert into public.daily_logs (user_id, vehicle_id, work_date, is_off, fixed_count, pallet_count, raw)
    values (l.driver_id, d_vehicle, r.work_date, r.is_off, r.fixed_count, r.pallet_count,
            coalesce(r.raw, '{}'::jsonb) || jsonb_build_object('assignedVehicleNumber', v.number))
    on conflict (vehicle_id, work_date) do nothing
    returning id into d_log;
    d_new := d_log is not null;
    if not d_new then
      select id into d_log from public.daily_logs where vehicle_id = d_vehicle and work_date = r.work_date;
    end if;

    if d_new then
      off_t := 0; off_f := 0; off_m := 0; off_x := 0;
    else
      select coalesce(max(sequence) + 1, 0) into off_t from public.transport_details where daily_log_id = d_log;
      select coalesce(max(sequence) + 1, 0) into off_f from public.fuel_records where daily_log_id = d_log;
      select coalesce(max(sequence) + 1, 0) into off_m from public.maintenance_records where daily_log_id = d_log;
      select coalesce(max(sequence) + 1, 0) into off_x from public.misc_expense_records where daily_log_id = d_log;
    end if;

    insert into public.transport_details (daily_log_id, user_id, vehicle_id, client_id, work_date, sequence, load_loc, unload_loc,
      fare_amount, distance_km, insurance_fee_amount, remarks, departure_time, arrival_time, receipt, start_odometer, end_odometer,
      vat_exempt, platform, cargo_tonnage, payment_status, payment_due_date, payments, commission_snapshot, raw)
    select d_log, l.driver_id, d_vehicle, (cmap -> t.client_id::text ->> 'id')::uuid, t.work_date, coalesce(t.sequence, 0) + off_t,
      t.load_loc, t.unload_loc, t.fare_amount, t.distance_km, t.insurance_fee_amount, t.remarks, t.departure_time, t.arrival_time,
      t.receipt, t.start_odometer, t.end_odometer, t.vat_exempt, t.platform, t.cargo_tonnage, t.payment_status, t.payment_due_date,
      t.payments, t.commission_snapshot,
      case when t.client_id is not null and t.raw is not null and (t.raw ->> 'clientId') is not distinct from (cmap -> t.client_id::text ->> 'olegacy')
                and (cmap -> t.client_id::text ->> 'legacy') is not null
           then jsonb_set(t.raw, '{clientId}', to_jsonb(cmap -> t.client_id::text ->> 'legacy'))
           else t.raw end
      from public.transport_details t where t.daily_log_id = r.id;

    insert into public.fuel_records (daily_log_id, user_id, vehicle_id, work_date, sequence, cost_amount, subsidy_amount, volume_liter, mileage_km, raw)
    select d_log, l.driver_id, d_vehicle, f.work_date, coalesce(f.sequence, 0) + off_f, f.cost_amount, f.subsidy_amount, f.volume_liter, f.mileage_km, f.raw
      from public.fuel_records f where f.daily_log_id = r.id;

    insert into public.maintenance_records (daily_log_id, user_id, vehicle_id, work_date, sequence, cost_amount, mileage_km, raw)
    select d_log, l.driver_id, d_vehicle, m.work_date, coalesce(m.sequence, 0) + off_m, m.cost_amount, m.mileage_km, m.raw
      from public.maintenance_records m where m.daily_log_id = r.id;

    insert into public.misc_expense_records (daily_log_id, user_id, vehicle_id, work_date, sequence, cost_amount, raw)
    select d_log, l.driver_id, d_vehicle, x.work_date, coalesce(x.sequence, 0) + off_x, x.cost_amount, x.raw
      from public.misc_expense_records x where x.daily_log_id = r.id;
  end loop;

  -- 9-A: 이번 연동 기간 그 차량 일상점검표를 기사 메인 차량으로 복사(작성자 = 기사, 같은 날짜에 기사 것이 있으면 기사 것 유지).
  insert into public.daily_inspections (user_id, vehicle_id, work_date, items, action_note, inspector_name, created_at, updated_at)
  select l.driver_id, d_vehicle, i.work_date, i.items, i.action_note, i.inspector_name, i.created_at, i.updated_at
    from public.daily_inspections i
   where i.vehicle_id = l.vehicle_id
     and (l.assignment_start is null or i.work_date >= l.assignment_start)
     and (l.assignment_end is null or i.work_date <= l.assignment_end)
  on conflict (vehicle_id, work_date) do nothing;

  -- 7-D-3 ①: 복사한 날들의 노선 칩 횟수에 나온 이름표를 차주 설정에서 찾아 기사 설정에 추가(앱 한도 10개), 추가했으면 칩 표시를 켠다.
  select coalesce(jsonb_agg(distinct k.key), '[]'::jsonb) into route_keys
    from public.daily_logs d
    cross join lateral jsonb_object_keys(case when jsonb_typeof(d.raw -> 'fixedRouteCounts') = 'object' then d.raw -> 'fixedRouteCounts' else '{}'::jsonb end) as k(key)
   where d.vehicle_id = l.vehicle_id
     and (l.assignment_start is null or d.work_date >= l.assignment_start)
     and (l.assignment_end is null or d.work_date <= l.assignment_end);
  if jsonb_array_length(route_keys) > 0 then
    select coalesce(settings, '{}'::jsonb) into o_settings from public.profiles where id = l.owner_id;
    select coalesce(settings, '{}'::jsonb) into d_settings from public.profiles where id = l.driver_id;
    d_presets := case when jsonb_typeof(d_settings -> 'fixedRoutePresets') = 'array' then d_settings -> 'fixedRoutePresets' else '[]'::jsonb end;
    for p in
      select e from jsonb_array_elements(case when jsonb_typeof(o_settings -> 'fixedRoutePresets') = 'array' then o_settings -> 'fixedRoutePresets' else '[]'::jsonb end) as e
    loop
      if route_keys ? (p ->> 'id') and jsonb_array_length(d_presets) < 10
         and not exists (select 1 from jsonb_array_elements(d_presets) as x where x ->> 'id' = p ->> 'id') then
        d_presets := d_presets || jsonb_build_array(p);
        added := added + 1;
      end if;
    end loop;
    if added > 0 then
      d_settings := jsonb_set(d_settings, '{fixedRoutePresets}', d_presets);
      if coalesce(d_settings ->> 'fixedRouteOn', '') <> 'true' then
        d_settings := jsonb_set(d_settings, '{fixedRouteOn}', 'true'::jsonb);
      end if;
      update public.profiles set settings = d_settings where id = l.driver_id;
    end if;
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_own_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ begin if exists (select 1 from public.driver_links where status = 'linked' and (owner_id = auth.uid() or driver_id = auth.uid())) then raise exception '연동을 먼저 해제해야 탈퇴할 수 있습니다.' using errcode = 'P0001'; end if; delete from auth.users where id = auth.uid(); end; $function$
;
CREATE OR REPLACE FUNCTION public.disconnect_driver_link_internal(p_link_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n integer;
begin
  perform set_config('app.driver_link_internal', 'on', true);
  update public.driver_links
     set status = 'disconnected', assignment_end = (now() at time zone 'Asia/Seoul')::date,
         unlink_requested_by = null, unlink_requested_at = null, updated_at = now()
   where id = p_link_id and status = 'linked';
  get diagnostics n = row_count;
  perform set_config('app.driver_link_internal', 'off', true);
  if n > 0 then
    perform public.copy_driver_link_records_internal(p_link_id);
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.driver_can_access_vehicle_date(p_vehicle_id uuid, p_work_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.driver_has_valid_vehicle_link(p_vehicle_id)
    and exists (select 1 from public.driver_links dl
      join public.vehicles v on v.id = dl.vehicle_id and v.user_id = dl.owner_id
      where dl.vehicle_id = p_vehicle_id and dl.driver_id = auth.uid()
        and dl.status in ('linked', 'disconnected')
        and (dl.assignment_start is null or p_work_date >= dl.assignment_start)
        and (dl.assignment_end is null or p_work_date <= dl.assignment_end));
$function$
;
CREATE OR REPLACE FUNCTION public.driver_has_valid_vehicle_link(p_vehicle_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.driver_links dl
    join public.vehicles v on v.id = dl.vehicle_id and v.user_id = dl.owner_id
    where dl.vehicle_id = p_vehicle_id and dl.driver_id = auth.uid() and dl.status = 'linked');
$function$
;
CREATE OR REPLACE FUNCTION public.get_assigned_vehicle_summary()
 RETURNS TABLE(id uuid, number text, type text, tonnage text, driver_pay_mode text, driver_salary_amount numeric, comm_enabled boolean, comm_type text, comm_value text, insurance_on boolean, driver_income_type text, withholding_on boolean, expense_rate text, insurance_rate text, driver_share_base text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select v.id, v.number, v.type, v.tonnage,
         v.driver_pay_mode, v.driver_salary_amount,
         v.comm_enabled, v.comm_type, v.comm_value,
         case when jsonb_typeof(v.raw -> 'insuranceOn') = 'boolean'
              then (v.raw ->> 'insuranceOn')::boolean
              else false end,
         v.raw ->> 'driverIncomeType',
         case when jsonb_typeof(v.raw -> 'withholdingOn') = 'boolean'
              then (v.raw ->> 'withholdingOn')::boolean
              else false end,
         v.raw ->> 'expenseRate',
         v.raw ->> 'insuranceRate',
         v.raw ->> 'driverShareBase'
  from public.vehicles v
  join public.driver_links dl on dl.vehicle_id = v.id
  where dl.driver_id = auth.uid() and dl.status = 'linked';
$function$
;
CREATE OR REPLACE FUNCTION public.get_linked_owner_business_info(p_owner_id uuid)
 RETURNS TABLE(name text, business_name text, business_representative text, business_number text, business_address text, business_type text, business_item text, business_email text, bank_name text, account_number text, account_holder text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.name, p.business_name, p.business_representative, p.business_number, p.business_address,
         p.business_type, p.business_item, p.business_email, p.bank_name, p.account_number, p.account_holder
    from public.profiles p
   where p.id = p_owner_id
     and exists (
       select 1 from public.driver_links dl
        where dl.owner_id = p_owner_id and dl.driver_id = auth.uid() and dl.status = 'linked'
     );
$function$
;
CREATE OR REPLACE FUNCTION public.get_linked_owner_profile_settings(p_owner_id uuid)
 RETURNS TABLE(name text, business_name text, settings jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.name, p.business_name, p.settings
  from public.profiles p
  where p.id = p_owner_id
    and exists (
      select 1 from public.driver_links dl
      where dl.owner_id = p_owner_id
        and dl.driver_id = auth.uid()
        and dl.status = 'linked'
    );
$function$
;
CREATE OR REPLACE FUNCTION public.guard_driver_link_invite_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  -- 0017과 같은 내부 경로(수락·해제 RPC)는 코드·기한을 건드리지 않는다.
  if tg_op = 'UPDATE' and current_user = 'postgres'
     and coalesce(current_setting('app.driver_link_internal', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' or new.invite_code is distinct from old.invite_code then
    if new.invite_code is null
       or new.invite_code !~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$' then
      raise exception '초대코드는 [코드 생성]으로 만든 10자리여야 합니다.' using errcode = '42501';
    end if;
    new.invite_expires_at := now() + interval '7 days';
  else
    new.invite_expires_at := old.invite_expires_at;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_driver_link_unlink()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'UPDATE' and current_user = 'postgres'
     and coalesce(current_setting('app.driver_link_internal', true), '') = 'on' then
    return new;
  end if;
  if auth.uid() is null or new.owner_id is distinct from auth.uid()
     or not public.owns_driver_link_vehicle(new.vehicle_id) then
    raise exception '본인 소유 차량만 초대할 수 있습니다.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending' or new.driver_id is not null
       or new.unlink_requested_by is not null or new.unlink_requested_at is not null then
      raise exception '기사 미지정 대기 초대만 만들 수 있습니다.' using errcode = '42501';
    end if;
  else
    if old.owner_id is distinct from auth.uid()
       or not public.owns_driver_link_vehicle(old.vehicle_id)
       or new.id is distinct from old.id
       or new.owner_id is distinct from old.owner_id
       or new.driver_id is distinct from old.driver_id
       or new.status is distinct from old.status
       or (old.status is distinct from 'pending' and new.vehicle_id is distinct from old.vehicle_id)
       or new.unlink_requested_by is distinct from old.unlink_requested_by
       or new.unlink_requested_at is distinct from old.unlink_requested_at then
      raise exception '연동 상태와 해제 요청은 전용 기능으로만 바꿀 수 있습니다.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_log_writer_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.user_id is distinct from old.user_id
    and new.user_id is not null
    and new.user_id is distinct from auth.uid() then
    raise exception '작성자 칸은 저장하는 본인으로만 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_vehicle_delete_while_linked()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ begin if exists (select 1 from public.driver_links where vehicle_id = old.id and status = 'linked') then raise exception '기사가 연동된 차량은 삭제할 수 없습니다. 기사 관리에서 연동을 먼저 해제해 주세요.' using errcode = 'P0001'; end if; return old; end; $function$
;
CREATE OR REPLACE FUNCTION public.has_linked_profile_access(p_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.driver_links dl
    join public.vehicles v on v.id = dl.vehicle_id and v.user_id = dl.owner_id
    where dl.status = 'linked' and (
      (dl.owner_id = auth.uid() and dl.driver_id = p_profile_id)
      or (dl.driver_id = auth.uid() and dl.owner_id = p_profile_id)));
$function$
;
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
select exists (select 1 from public.admin_users where user_id = auth.uid());
$function$
;
CREATE OR REPLACE FUNCTION public.owns_driver_link_vehicle(p_vehicle_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.vehicles
    where id = p_vehicle_id and user_id = auth.uid());
$function$
;
CREATE OR REPLACE FUNCTION public.redeem_driver_invite_code(p_invite_code text)
 RETURNS SETOF driver_links
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  select * into v_link from public.driver_links
    where invite_code = v_code and status = 'pending' and driver_id is null
      and invite_expires_at > now()
    for update;
  if not found then
    -- 오류로 끝내면 실패 기록도 되돌려지므로 빈 결과로 돌려준다(화면이 안내 문구로 바꿈).
    insert into public.driver_invite_redeem_attempts(user_id) values (v_driver);
    return;
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
$function$
;
CREATE OR REPLACE FUNCTION public.remove_day_log(p_vehicle_id uuid, p_work_date date)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  delete from public.transport_details where vehicle_id = p_vehicle_id and work_date = p_work_date;
  if exists (select 1 from public.fuel_records where vehicle_id = p_vehicle_id and work_date = p_work_date)
     or exists (select 1 from public.maintenance_records where vehicle_id = p_vehicle_id and work_date = p_work_date)
     or exists (select 1 from public.misc_expense_records where vehicle_id = p_vehicle_id and work_date = p_work_date) then
    update public.daily_logs
    set is_off = false, fixed_count = 0, pallet_count = 0, raw = '{}'::jsonb
    where vehicle_id = p_vehicle_id and work_date = p_work_date;
    return 'blanked';
  end if;
  delete from public.daily_logs where vehicle_id = p_vehicle_id and work_date = p_work_date;
  return 'deleted';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.rename_and_save_sub_vehicle(p_vehicle_id uuid, p_new_number text, p_row jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  r public.vehicles;
begin
  perform 1 from public.rename_sub_vehicle(p_vehicle_id, p_new_number);
  r := jsonb_populate_record(null::public.vehicles, p_row);
  update public.vehicles v
  set tonnage = r.tonnage,
      display_order = r.display_order,
      comm_enabled = r.comm_enabled,
      comm_type = r.comm_type,
      comm_value = r.comm_value,
      driver_pay_mode = r.driver_pay_mode,
      driver_salary_amount = r.driver_salary_amount,
      driver_link_id = r.driver_link_id,
      driver_name = r.driver_name,
      archived = r.archived,
      raw = r.raw
  where v.id = p_vehicle_id and v.user_id = auth.uid();
  if not found then
    raise exception '차량을 찾지 못했습니다.' using errcode = 'P0001';
  end if;
  return p_vehicle_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.rename_sub_vehicle(p_vehicle_id uuid, p_new_number text)
 RETURNS TABLE(old_number text, new_number text, clients_updated integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_old text;
  v_new text := btrim(coalesce(p_new_number, ''));
  v_clients integer := 0;
begin
  if v_new = '' then
    raise exception '차량번호를 입력해 주세요.' using errcode = 'P0001';
  end if;

  select v.number into v_old
  from public.vehicles v
  where v.id = p_vehicle_id and v.user_id = auth.uid() and v.type = 'sub'
  for update;
  if not found then
    raise exception '차량을 찾지 못했습니다.' using errcode = 'P0001';
  end if;

  if v_old = v_new then
    return query select v_old, v_new, 0;
    return;
  end if;

  if exists (select 1 from public.vehicles v where v.user_id = auth.uid() and v.number = v_new and v.id <> p_vehicle_id) then
    raise exception '이미 등록된 차량번호입니다.' using errcode = 'P0001';
  end if;

  update public.vehicles v
  set number = v_new,
      legacy_log_id = v_new,
      raw = jsonb_set(coalesce(v.raw, '{}'::jsonb), '{number}', to_jsonb(v_new))
  where v.id = p_vehicle_id;

  update public.clients c
  set raw = jsonb_set(c.raw, '{scopedToVehicleNumber}', to_jsonb(v_new))
  where c.user_id = auth.uid() and c.raw ->> 'scopedToVehicleNumber' = v_old;
  get diagnostics v_clients = row_count;

  update public.tax_invoices t
  set raw = t.raw || jsonb_strip_nulls(jsonb_build_object(
        'id', case when right(t.raw ->> 'id', length(v_old) + 2) = '__' || v_old
                   then left(t.raw ->> 'id', length(t.raw ->> 'id') - length(v_old)) || v_new end,
        'partyKey', case when right(t.raw ->> 'partyKey', length(v_old) + 2) = '__' || v_old
                         then left(t.raw ->> 'partyKey', length(t.raw ->> 'partyKey') - length(v_old)) || v_new end,
        'carNumber', case when t.raw ->> 'carNumber' = v_old then v_new end,
        'logId', case when t.raw ->> 'logId' = v_old then v_new end,
        'vehicleLabel', case when t.raw ->> 'vehicleLabel' = v_old then v_new
                             when right(t.raw ->> 'vehicleLabel', length(v_old) + 2) = ', ' || v_old
                             then left(t.raw ->> 'vehicleLabel', length(t.raw ->> 'vehicleLabel') - length(v_old)) || v_new end,
        'supplierKey', case when left(t.raw ->> 'supplierKey', length(v_old) + 5) = 'car:' || v_old || ':'
                            then 'car:' || v_new || substr(t.raw ->> 'supplierKey', length(v_old) + 5) end,
        'vehicleNumbers', case when jsonb_typeof(t.raw -> 'vehicleNumbers') = 'array' and (t.raw -> 'vehicleNumbers') ? v_old
                               then (select jsonb_agg(case when e = v_old then v_new else e end)
                                     from jsonb_array_elements_text(t.raw -> 'vehicleNumbers') e) end
      ))
  where t.user_id = auth.uid() and t.vehicle_id = p_vehicle_id;

  update public.profiles p
  set settings = jsonb_set(
        p.settings,
        '{subCarSettings}',
        ((p.settings -> 'subCarSettings') - v_old) || jsonb_build_object(v_new, p.settings -> 'subCarSettings' -> v_old)
      ),
      updated_at = now()
  where p.id = auth.uid()
    and jsonb_typeof(p.settings -> 'subCarSettings') = 'object'
    and (p.settings -> 'subCarSettings') ? v_old;

  return query select v_old, v_new, v_clients;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.replace_transport_details(p_daily_log_id uuid, p_rows jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ begin if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'p_rows는 배열이어야 합니다.' using errcode = 'P0001'; end if; delete from public.transport_details t where t.daily_log_id = p_daily_log_id; insert into public.transport_details ( daily_log_id, user_id, vehicle_id, client_id, work_date, sequence, load_loc, unload_loc, fare_amount, vat_exempt, payment_status, payment_due_date, payments, commission_snapshot, raw ) select p_daily_log_id, r.user_id, r.vehicle_id, r.client_id, r.work_date, r.sequence, r.load_loc, r.unload_loc, r.fare_amount, coalesce(r.vat_exempt, false), coalesce(r.payment_status, '미수'), r.payment_due_date, coalesce(r.payments, '[]'::jsonb), r.commission_snapshot, r.raw from jsonb_populate_recordset(null::public.transport_details, p_rows) as r; end; $function$
;
CREATE OR REPLACE FUNCTION public.request_driver_unlink(p_link_id uuid)
 RETURNS SETOF driver_links
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.driver_links;
begin
  select * into v from public.driver_links
   where id = p_link_id and status = 'linked' and (owner_id = auth.uid() or driver_id = auth.uid())
   for update;
  if not found then
    raise exception '연동 정보를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if v.unlink_requested_by is not null and v.unlink_requested_by <> auth.uid() then
    perform public.disconnect_driver_link_internal(p_link_id);
  elsif v.unlink_requested_by is null then
    perform set_config('app.driver_link_internal', 'on', true);
    update public.driver_links
       set unlink_requested_by = auth.uid(), unlink_requested_at = now(), updated_at = now()
     where id = p_link_id;
    perform set_config('app.driver_link_internal', 'off', true);
  end if;
  return query select * from public.driver_links where id = p_link_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.save_day_log(p_log jsonb, p_rows jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  r public.daily_logs;
  v_id uuid;
begin
  if jsonb_typeof(p_log) is distinct from 'object' then
    raise exception 'p_log는 객체여야 합니다.' using errcode = 'P0001';
  end if;
  r := jsonb_populate_record(null::public.daily_logs, p_log);

  insert into public.daily_logs (user_id, vehicle_id, work_date, is_off, fixed_count, pallet_count, raw)
  values (r.user_id, r.vehicle_id, r.work_date, r.is_off, r.fixed_count, r.pallet_count, r.raw)
  on conflict (vehicle_id, work_date) do update
    set user_id = excluded.user_id, is_off = excluded.is_off, fixed_count = excluded.fixed_count,
        pallet_count = excluded.pallet_count, raw = excluded.raw
  returning id into v_id;

  perform public.replace_transport_details(v_id, p_rows);
  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.settle_expired_driver_unlinks()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id from public.driver_links
     where status = 'linked' and unlink_requested_at is not null
       and unlink_requested_at < now() - interval '3 days'
       and (owner_id = auth.uid() or driver_id = auth.uid())
     for update
  loop
    perform public.disconnect_driver_link_internal(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.touch_daily_inspections_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.upsert_driver_link_idempotent(p_idempotency_key text, p_vehicle_id uuid, p_invite_code text, p_assignment_start date, p_assignment_end date)
 RETURNS SETOF driver_links
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'p_idempotency_key must not be null or blank'
      using errcode = '22023';
  end if;

  return query
  insert into public.driver_links
    (idempotency_key, owner_id, vehicle_id, invite_code, assignment_start, assignment_end, status, updated_at)
  values
    (p_idempotency_key, auth.uid(), p_vehicle_id, p_invite_code, p_assignment_start, p_assignment_end, 'pending', now())
  on conflict (owner_id, idempotency_key) where idempotency_key is not null do update
    set idempotency_key = excluded.idempotency_key
  returning *;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.vehicle_has_linked_driver_on(p_vehicle_id uuid, p_work_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.driver_links dl
      join public.vehicles v on v.id = dl.vehicle_id
     where dl.vehicle_id = p_vehicle_id and v.user_id = auth.uid() and dl.status = 'linked'
       and (dl.assignment_start is null or p_work_date >= dl.assignment_start)
       and (dl.assignment_end is null or p_work_date <= dl.assignment_end)
  );
$function$
;
