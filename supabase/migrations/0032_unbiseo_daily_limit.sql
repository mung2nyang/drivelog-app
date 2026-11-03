-- 0032: 운비서 하루 사용 횟수 — 회원·한국 날짜·종류별 횟수 표와, 한도 안이면 1 더하고 넘으면 거절하는 함수.
-- 본인 줄 읽기만 허용, 쓰기는 함수만. 8일 지난 줄은 함수가 그 회원 것만 지운다. if not exists·create or replace라 다시 실행해도 안전.
begin;

create table if not exists public.unbiseo_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  used_on date not null,
  kind text not null check (kind in ('parse', 'voice')),
  uses integer not null default 0 check (uses >= 0),
  primary key (user_id, used_on, kind)
);

alter table public.unbiseo_usage enable row level security;

drop policy if exists "본인 운비서 횟수 읽기" on public.unbiseo_usage;
create policy "본인 운비서 횟수 읽기" on public.unbiseo_usage
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.unbiseo_usage from public, anon, authenticated;
grant select on public.unbiseo_usage to authenticated;

create or replace function public.use_unbiseo(p_kind text, p_limit integer)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_uses integer;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in ('parse', 'voice') or p_limit is null or p_limit < 1 then
    raise exception '요청 모양이 맞지 않습니다.' using errcode = '22023';
  end if;
  delete from public.unbiseo_usage where user_id = v_user and used_on < v_today - 7;
  -- 같은 줄 동시 요청은 on conflict 잠금으로 줄을 서서 한도를 넘지 않는다.
  insert into public.unbiseo_usage as u (user_id, used_on, kind, uses)
  values (v_user, v_today, p_kind, 1)
  on conflict (user_id, used_on, kind) do update set uses = u.uses + 1
    where u.uses < p_limit
  returning u.uses into v_uses;
  return v_uses is not null;
end;
$$;

revoke all on function public.use_unbiseo(text, integer) from public, anon;
grant execute on function public.use_unbiseo(text, integer) to authenticated;

commit;

-- 사후검증 1(기대: rls = true)
-- select relrowsecurity as rls from pg_class where oid = 'public.unbiseo_usage'::regclass;
-- 사후검증 2(기대: 1줄 "본인 운비서 횟수 읽기", SELECT, {authenticated})
-- select policyname, cmd, roles::text from pg_policies where tablename = 'unbiseo_usage';
-- 사후검증 3(기대: authenticated SELECT 1줄만, anon 없음)
-- select grantee, privilege_type from information_schema.role_table_grants where table_name = 'unbiseo_usage' and grantee in ('anon', 'authenticated');
-- 사후검증 4(기대: 1줄, security_definer = true, proconfig = {search_path=public}, anon_exec = false, auth_exec = true)
-- select p.proname, p.prosecdef as security_definer, p.proconfig,
--        has_function_privilege('anon', p.oid, 'execute') as anon_exec,
--        has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
-- from pg_proc p where p.proname = 'use_unbiseo';

-- 되돌리기(서버 함수를 먼저 이전 판으로 되돌린 뒤):
-- drop function if exists public.use_unbiseo(text, integer);
-- drop table if exists public.unbiseo_usage;
