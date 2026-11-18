-- 0043: 운비서 하루 횟수 한도를 서버 함수 안에 고정하고(말 읽기·목소리·날씨 각 20), 실패한 요청의 횟수를 돌려주는 함수를 더한다.
-- 돌려주기는 관리자 열쇠(서버 함수)만 부른다. 못 알아들음으로 돌려받는 것은 하루 20번까지(종류 parse_miss로 셈).
-- 옛 use_unbiseo(text, integer)는 서버 함수 배포 뒤 0044에서 지운다. 다시 실행해도 안전.
begin;

alter table public.unbiseo_usage drop constraint if exists unbiseo_usage_kind_check;
alter table public.unbiseo_usage add constraint unbiseo_usage_kind_check
  check (kind in ('parse', 'voice', 'weather', 'parse_miss'));

create or replace function public.use_unbiseo(p_kind text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_limit integer := case p_kind when 'parse' then 20 when 'voice' then 20 when 'weather' then 20 end;
  v_uses integer;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;
  if v_limit is null then
    raise exception '요청 모양이 맞지 않습니다.' using errcode = '22023';
  end if;
  delete from public.unbiseo_usage where user_id = v_user and used_on < v_today - 7;
  insert into public.unbiseo_usage as u (user_id, used_on, kind, uses)
  values (v_user, v_today, p_kind, 1)
  on conflict (user_id, used_on, kind) do update set uses = u.uses + 1
    where u.uses < v_limit
  returning u.uses into v_uses;
  return v_uses is not null;
end;
$$;

create or replace function public.return_unbiseo(p_user uuid, p_kind text, p_miss boolean)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_misses integer;
begin
  if p_user is null or p_miss is null or p_kind is null or p_kind not in ('parse', 'voice', 'weather') or (p_miss and p_kind <> 'parse') then
    raise exception '요청 모양이 맞지 않습니다.' using errcode = '22023';
  end if;
  if p_miss then
    insert into public.unbiseo_usage as u (user_id, used_on, kind, uses)
    values (p_user, v_today, 'parse_miss', 1)
    on conflict (user_id, used_on, kind) do update set uses = u.uses + 1
      where u.uses < 20
    returning u.uses into v_misses;
    if v_misses is null then
      return false;
    end if;
  end if;
  update public.unbiseo_usage set uses = uses - 1
  where user_id = p_user and used_on = v_today and kind = p_kind and uses > 0;
  return found;
end;
$$;

revoke all on function public.use_unbiseo(text) from public, anon;
grant execute on function public.use_unbiseo(text) to authenticated;
revoke all on function public.return_unbiseo(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.return_unbiseo(uuid, text, boolean) to service_role;

commit;

-- 사후검증 1(기대: CHECK ((kind = ANY (ARRAY['parse'::text, 'voice'::text, 'weather'::text, 'parse_miss'::text]))))
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'unbiseo_usage_kind_check';

-- 사후검증 2(기대: 3줄 — return_unbiseo(p_user uuid, p_kind text, p_miss boolean): anon false, auth false, service true /
--   use_unbiseo(p_kind text): anon false, auth true / use_unbiseo(p_kind text, p_limit integer): anon false, auth true(0044 전까지).
--   모두 security_definer = true, proconfig = {search_path=public})
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer, p.proconfig,
--        has_function_privilege('anon', p.oid, 'execute') as anon_exec,
--        has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
--        has_function_privilege('service_role', p.oid, 'execute') as service_exec
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname in ('use_unbiseo', 'return_unbiseo')
-- order by 1, 2;

-- 되돌리기(서버 함수를 먼저 이전 판으로 되돌린 뒤):
-- drop function if exists public.return_unbiseo(uuid, text, boolean);
-- drop function if exists public.use_unbiseo(text);
-- delete from public.unbiseo_usage where kind in ('weather', 'parse_miss');
-- alter table public.unbiseo_usage drop constraint if exists unbiseo_usage_kind_check;
-- alter table public.unbiseo_usage add constraint unbiseo_usage_kind_check check (kind in ('parse', 'voice'));
