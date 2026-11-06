-- 0033: 휴대폰 알림 받을 주소 — 기기마다 구글이 준 주소(token) 1줄, 어느 계정 것인지.
-- 표는 아무도 직접 못 만지고 함수 2개로만 넣고 지운다. 보내는 서버 코드(service_role)만 읽는다. 다시 실행해도 안전.
begin;

create table if not exists public.push_devices (
  token text primary key check (char_length(token) between 1 and 4096),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android' check (platform in ('android')),
  updated_at timestamptz not null default now()
);
create index if not exists push_devices_user_id_idx on public.push_devices (user_id);

alter table public.push_devices enable row level security;
revoke all on public.push_devices from public, anon, authenticated;

-- 같은 휴대폰에서 계정을 바꾸면 그 주소는 새 계정 것으로 옮긴다.
create or replace function public.register_push_device(p_token text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;
  if p_token is null or char_length(p_token) not between 1 and 4096 then
    raise exception '요청 모양이 맞지 않습니다.' using errcode = '22023';
  end if;
  insert into public.push_devices as d (token, user_id, platform, updated_at)
  values (p_token, v_user, 'android', now())
  on conflict (token) do update set user_id = excluded.user_id, updated_at = excluded.updated_at;
end;
$$;

-- 내 줄만 지운다(남의 주소는 몰라도 못 지움).
create or replace function public.unregister_push_device(p_token text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;
  delete from public.push_devices where token = p_token and user_id = auth.uid();
end;
$$;

revoke all on function public.register_push_device(text) from public, anon;
grant execute on function public.register_push_device(text) to authenticated;
revoke all on function public.unregister_push_device(text) from public, anon;
grant execute on function public.unregister_push_device(text) to authenticated;

commit;

-- 사후검증 1(기대: rls = true)
-- select relrowsecurity as rls from pg_class where oid = 'public.push_devices'::regclass;
-- 사후검증 2(기대: 0줄 — anon·authenticated에게 표 권한 없음)
-- select grantee, privilege_type from information_schema.role_table_grants where table_name = 'push_devices' and grantee in ('anon', 'authenticated');
-- 사후검증 3(기대: 2줄, security_definer = true, anon_exec = false, auth_exec = true)
-- select p.proname, p.prosecdef as security_definer, has_function_privilege('anon', p.oid, 'execute') as anon_exec, has_function_privilege('authenticated', p.oid, 'execute') as auth_exec from pg_proc p where p.proname in ('register_push_device', 'unregister_push_device');
-- 되돌리기: drop function public.register_push_device(text); drop function public.unregister_push_device(text); drop table public.push_devices;
