-- 보안 기본 시험(pgTAP): public 표는 모두 보안 규칙이 켜져 있고, 비로그인(anon)은 표·함수 어느 것도 못 쓴다. CI에서 supabase test db로 돈다.
begin;
select plan(3);

select is(
  array(
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
    order by 1
  ),
  array[]::text[],
  '보안 규칙이 꺼진 public 표가 없다'
);

select is(
  array(
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')
    order by 1
  ),
  array[]::text[],
  '비로그인이 쓸 수 있는 public 표·보기가 없다'
);

select is(
  array(
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
    order by 1
  ),
  array[]::text[],
  '비로그인이 부를 수 있는 public 함수가 없다'
);

select * from finish();
rollback;
