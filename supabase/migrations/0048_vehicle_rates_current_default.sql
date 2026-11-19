begin;

update public.vehicles
set raw = raw
  || case when raw->>'expenseRate' ~ '^\s*30\.50*\s*$' then '{"expenseRate":"49.9"}'::jsonb else '{}'::jsonb end
  || case when raw->>'insuranceRate' ~ '^\s*1\.80*\s*$' then '{"insuranceRate":"1.76"}'::jsonb else '{}'::jsonb end
where jsonb_typeof(raw) = 'object'
  and (raw->>'expenseRate' ~ '^\s*30\.50*\s*$' or raw->>'insuranceRate' ~ '^\s*1\.80*\s*$');

commit;

-- 사후 확인(기대: 0 / 0):
-- select count(*) filter (where raw->>'expenseRate' ~ '^\s*30\.50*\s*$'), count(*) filter (where raw->>'insuranceRate' ~ '^\s*1\.80*\s*$') from public.vehicles;
