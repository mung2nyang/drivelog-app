-- 0044: 한도를 부르는 쪽에서 받던 옛 use_unbiseo(text, integer)를 지운다.
-- 서버 함수 unbiseo-parse·unbiseo-voice·unbiseo-weather가 0043의 use_unbiseo(text)를 부르도록 배포된 뒤에 넣는다. 다시 실행해도 안전.
begin;

drop function if exists public.use_unbiseo(text, integer);

commit;

-- 사후검증(기대: 2줄 — return_unbiseo(p_user uuid, p_kind text, p_miss boolean), use_unbiseo(p_kind text))
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname in ('use_unbiseo', 'return_unbiseo')
-- order by 1, 2;

-- 되돌리기: supabase/migrations/0032_unbiseo_daily_limit.sql의 use_unbiseo(text, integer) 본문과 revoke·grant 줄을 다시 실행.
