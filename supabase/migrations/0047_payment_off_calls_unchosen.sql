begin;

with off_owners as (
  select p.id
  from public.profiles p
  where not exists (select 1 from public.driver_links l where l.driver_id = p.id and l.status = 'linked')
    and coalesce(p.settings->>'paymentOn', '') <> 'true'
), changed as (
  update public.transport_details t
  set payment_status = '선택 안 함',
      raw = jsonb_set(t.raw, '{paymentStatus}', '"선택 안 함"'::jsonb)
  from public.vehicles v
  where v.id = t.vehicle_id
    and t.user_id = v.user_id
    and v.user_id in (select id from off_owners)
    and jsonb_typeof(t.raw) = 'object'
    and coalesce(nullif(t.raw->>'paymentStatus', ''), '미수') = '미수'
    and coalesce(nullif(t.payment_status, ''), '미수') = '미수'
    and coalesce(jsonb_array_length(case when jsonb_typeof(t.raw->'payments') = 'array' then t.raw->'payments' end), 0) = 0
    and coalesce(jsonb_array_length(case when jsonb_typeof(t.payments) = 'array' then t.payments end), 0) = 0
  returning t.daily_log_id
)
update public.daily_logs d
set updated_at = clock_timestamp()
where d.id in (select daily_log_id from changed);

commit;
