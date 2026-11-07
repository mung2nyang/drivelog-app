-- 0035: 문의 답변 알림을 "봤음"으로 서버에 저장 — 어느 기기·연동 상태에서든 한 번 닫으면 다시 안 뜨게.
-- 본 시각 칸에는 그때의 답변 시각을 넣는다. 관리자가 답변을 다시 저장하면 답변 시각이 늦어져 다시 뜬다.
-- 칸 추가·create or replace라 다시 실행해도 안전.
begin;

alter table public.support_inquiries add column if not exists answer_seen_at timestamptz;

-- 본인 문의이고 답변 시각이 그대로일 때만 저장한다. 바뀐 줄 수(0 또는 1)를 돌려준다.
create or replace function public.mark_inquiry_answer_seen(p_inquiry_id uuid, p_answered_at timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;
  update public.support_inquiries
     set answer_seen_at = p_answered_at
   where id = p_inquiry_id
     and user_id = auth.uid()
     and answered_at = p_answered_at;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_inquiry_answer_seen(uuid, timestamptz) from public;
revoke execute on function public.mark_inquiry_answer_seen(uuid, timestamptz) from anon;
grant execute on function public.mark_inquiry_answer_seen(uuid, timestamptz) to authenticated;

commit;

-- 사후 확인(기대: 칸 1줄 timestamp with time zone, 함수 1줄 security definer true, anon 실행 false·authenticated 실행 true):
-- select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'support_inquiries' and column_name = 'answer_seen_at';
-- select proname, prosecdef from pg_proc where proname = 'mark_inquiry_answer_seen';
-- select has_function_privilege('anon', 'public.mark_inquiry_answer_seen(uuid, timestamptz)', 'execute') as anon_can,
--        has_function_privilege('authenticated', 'public.mark_inquiry_answer_seen(uuid, timestamptz)', 'execute') as auth_can;
-- 되돌리기: drop function if exists public.mark_inquiry_answer_seen(uuid, timestamptz); (칸은 남겨 둠 — 데이터 보존)
