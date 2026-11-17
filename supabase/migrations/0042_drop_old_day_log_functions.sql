-- 0042: 고친 시각을 확인하지 않고 덮어쓰는 옛 2개짜리 save_day_log·remove_day_log를 지운다.
-- 앱은 시각을 받는 3개짜리만 부른다(0041). 표·칸·기록은 건드리지 않는다. 다시 실행해도 안전.
begin;

drop function if exists public.save_day_log(jsonb, jsonb);
drop function if exists public.remove_day_log(uuid, date);

commit;

-- 사후검증(기대: 3줄 — lock_unchanged_day_log, remove_day_log, save_day_log 각 1줄, 모두 끝 인자가 timestamp with time zone.
--   모두 security_definer = false, proconfig = {search_path=public}, anon_exec = false, auth_exec = true)
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer, p.proconfig,
--        has_function_privilege('anon', p.oid, 'execute') as anon_exec,
--        has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname in ('lock_unchanged_day_log', 'save_day_log', 'remove_day_log')
-- order by 1, 2;

-- 되돌리기: supabase/baseline/02_functions.sql의 remove_day_log(uuid, date)·save_day_log(jsonb, jsonb) 본문과
-- 04_grants.sql의 두 함수 grant 줄을 다시 실행하고, revoke all ... from public, anon.
