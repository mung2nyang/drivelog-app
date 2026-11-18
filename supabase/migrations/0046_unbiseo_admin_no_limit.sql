-- 0046: 관리자 명단(admin_users)에 있는 계정은 운비서 하루 횟수를 세되 막지 않는다. 다시 실행해도 안전.
begin;

create or replace function public.use_unbiseo(p_kind text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_limit integer := case p_kind when 'parse' then 20 when 'voice' then 20 when 'weather' then 20 end;
  v_admin boolean;
  v_uses integer;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;
  if v_limit is null then
    raise exception '요청 모양이 맞지 않습니다.' using errcode = '22023';
  end if;
  v_admin := exists (select 1 from public.admin_users a where a.user_id = v_user);
  delete from public.unbiseo_usage where user_id = v_user and used_on < v_today - 7;
  insert into public.unbiseo_usage as u (user_id, used_on, kind, uses)
  values (v_user, v_today, p_kind, 1)
  on conflict (user_id, used_on, kind) do update set uses = u.uses + 1
    where v_admin or u.uses < v_limit
  returning u.uses into v_uses;
  return v_uses is not null;
end;
$$;

revoke all on function public.use_unbiseo(text) from public, anon;
grant execute on function public.use_unbiseo(text) to authenticated;

commit;

-- 사후검증 1(기대: true — 함수 안에 관리자 명단 확인이 있음)
-- select pg_get_functiondef('public.use_unbiseo(text)'::regprocedure) like '%admin_users a where a.user_id = v_user%';

-- 사후검증 2(기대: security_definer true, proconfig {search_path=public}, anon_exec false, auth_exec true)
-- select p.prosecdef as security_definer, p.proconfig,
--        has_function_privilege('anon', p.oid, 'execute') as anon_exec,
--        has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
-- from pg_proc p where p.oid = 'public.use_unbiseo(text)'::regprocedure;

-- 사후검증 3(기대: 모두 false — 회원·비회원은 관리자 명단을 읽거나 고칠 수 없음)
-- select has_table_privilege(r, 'public.admin_users', 'select') as can_read,
--        has_table_privilege(r, 'public.admin_users', 'insert') as can_insert,
--        has_table_privilege(r, 'public.admin_users', 'update') as can_update,
--        has_table_privilege(r, 'public.admin_users', 'delete') as can_delete
-- from unnest(array['anon', 'authenticated']) r;

-- 되돌리기: 0043의 use_unbiseo(text)를 다시 실행한다.
