-- 0045: 앱과 보안 규칙이 자주 찾는 칸에 색인 18개를 더한다. 표·칸·기록·규칙·함수는 그대로. 다시 실행해도 안전.
begin;
set local lock_timeout = '5s';

create index if not exists transport_details_vehicle_id_work_date_idx on public.transport_details (vehicle_id, work_date);
create index if not exists fuel_records_vehicle_id_work_date_idx on public.fuel_records (vehicle_id, work_date);
create index if not exists maintenance_records_vehicle_id_work_date_idx on public.maintenance_records (vehicle_id, work_date);
create index if not exists misc_expense_records_vehicle_id_work_date_idx on public.misc_expense_records (vehicle_id, work_date);

create index if not exists transport_details_daily_log_id_idx on public.transport_details (daily_log_id);
create index if not exists fuel_records_daily_log_id_idx on public.fuel_records (daily_log_id);
create index if not exists maintenance_records_daily_log_id_idx on public.maintenance_records (daily_log_id);
create index if not exists misc_expense_records_daily_log_id_idx on public.misc_expense_records (daily_log_id);

create index if not exists transport_details_client_id_idx on public.transport_details (client_id);

create index if not exists vehicles_user_id_idx on public.vehicles (user_id);
create index if not exists clients_user_id_idx on public.clients (user_id);
create index if not exists tax_invoices_user_id_idx on public.tax_invoices (user_id);
create index if not exists support_inquiries_user_id_idx on public.support_inquiries (user_id);

create index if not exists tax_invoices_client_id_idx on public.tax_invoices (client_id);
create index if not exists tax_invoices_vehicle_id_idx on public.tax_invoices (vehicle_id);

create index if not exists driver_links_vehicle_id_idx on public.driver_links (vehicle_id);
create index if not exists driver_links_driver_id_idx on public.driver_links (driver_id);
create index if not exists driver_links_owner_id_idx on public.driver_links (owner_id);

commit;

-- 사후검증(기대: 18)
-- select count(*) from pg_indexes
-- where schemaname = 'public' and indexname in (
--   'transport_details_vehicle_id_work_date_idx', 'fuel_records_vehicle_id_work_date_idx',
--   'maintenance_records_vehicle_id_work_date_idx', 'misc_expense_records_vehicle_id_work_date_idx',
--   'transport_details_daily_log_id_idx', 'fuel_records_daily_log_id_idx',
--   'maintenance_records_daily_log_id_idx', 'misc_expense_records_daily_log_id_idx',
--   'transport_details_client_id_idx', 'vehicles_user_id_idx', 'clients_user_id_idx',
--   'tax_invoices_user_id_idx', 'support_inquiries_user_id_idx', 'tax_invoices_client_id_idx',
--   'tax_invoices_vehicle_id_idx', 'driver_links_vehicle_id_idx', 'driver_links_driver_id_idx',
--   'driver_links_owner_id_idx');

-- 되돌리기: 위 18개 이름마다 drop index if exists public.<이름>; 기록은 그대로.
