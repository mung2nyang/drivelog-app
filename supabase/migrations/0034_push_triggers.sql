-- 0034: 서버 알림 보내기 — 문의 넣기·답변 저장·기사 연결 때 서버 함수 send-push를 부른다(누구에게·무슨 종류만).
-- 함수 주소·보내기 암호는 금고(vault)의 push_function_url·push_secret. 없거나 부르기가 실패해도 원래 일은 그대로 성공한다(알림만 빠짐).
-- create or replace·drop trigger if exists라 다시 실행해도 안전.
begin;

create extension if not exists pg_net with schema extensions;

create or replace function public.request_push(p_kind text, p_user_ids uuid[])
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if p_kind not in ('adminInquiry', 'inquiryAnswer', 'driverLinked') or coalesce(array_length(p_user_ids, 1), 0) = 0 then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('kind', p_kind, 'userIds', to_jsonb(p_user_ids)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning '[send-push] 부르기 실패: %', sqlstate;
end;
$$;

revoke all on function public.request_push(text, uuid[]) from public, anon, authenticated;

-- 새 문의 → 관리자 명단 모두에게.
create or replace function public.push_on_inquiry_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.request_push('adminInquiry', array(select user_id from public.admin_users));
  return null;
end;
$$;

-- 답변이 새로 달리거나 바뀌면 → 문의한 사람에게.
create or replace function public.push_on_inquiry_answer()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.user_id is not null and btrim(coalesce(new.answer, '')) <> '' and new.answer is distinct from old.answer then
    perform public.request_push('inquiryAnswer', array[new.user_id]);
  end if;
  return null;
end;
$$;

-- 기사가 초대 코드를 넣어 연결되면 → 사장님에게.
create or replace function public.push_on_driver_linked()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'linked' and old.status is distinct from 'linked' and new.owner_id is not null then
    perform public.request_push('driverLinked', array[new.owner_id]);
  end if;
  return null;
end;
$$;

revoke all on function public.push_on_inquiry_insert() from public, anon, authenticated;
revoke all on function public.push_on_inquiry_answer() from public, anon, authenticated;
revoke all on function public.push_on_driver_linked() from public, anon, authenticated;

drop trigger if exists push_on_inquiry_insert on public.support_inquiries;
create trigger push_on_inquiry_insert after insert on public.support_inquiries
  for each row execute function public.push_on_inquiry_insert();

drop trigger if exists push_on_inquiry_answer on public.support_inquiries;
create trigger push_on_inquiry_answer after update of answer on public.support_inquiries
  for each row execute function public.push_on_inquiry_answer();

drop trigger if exists push_on_driver_linked on public.driver_links;
create trigger push_on_driver_linked after update of status on public.driver_links
  for each row execute function public.push_on_driver_linked();

commit;

-- 적용 뒤 금고 값 넣기(값은 저장소에 남기지 않는다 — SQL Editor에서 한 번):
-- select vault.create_secret('https://<프로젝트>.supabase.co/functions/v1/send-push', 'push_function_url');
-- select vault.create_secret('<보내기 암호>', 'push_secret');
-- 사후검증 1(기대: 3줄 push_on_driver_linked·push_on_inquiry_answer·push_on_inquiry_insert)
-- select tgname from pg_trigger where tgname like 'push_on_%' order by tgname;
-- 사후검증 2(기대: 4줄 모두 anon_exec = false, auth_exec = false)
-- select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_exec, has_function_privilege('authenticated', p.oid, 'execute') as auth_exec from pg_proc p where p.proname in ('request_push', 'push_on_inquiry_insert', 'push_on_inquiry_answer', 'push_on_driver_linked');
-- 사후검증 3(기대: 2줄 push_function_url·push_secret — 값은 보지 않음)
-- select name from vault.secrets where name in ('push_function_url', 'push_secret');
-- 되돌리기: drop trigger push_on_inquiry_insert on public.support_inquiries; drop trigger push_on_inquiry_answer on public.support_inquiries; drop trigger push_on_driver_linked on public.driver_links; drop function public.push_on_inquiry_insert(); drop function public.push_on_inquiry_answer(); drop function public.push_on_driver_linked(); drop function public.request_push(text, uuid[]);
