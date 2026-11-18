-- 자주 찾는 칸 색인 시험(pgTAP): 0045가 더한 색인 18개가 맞는 칸에 있는지. CI에서 supabase test db로 돈다.
begin;
select plan(18);

select has_index('public', 'transport_details', 'transport_details_vehicle_id_work_date_idx', array['vehicle_id', 'work_date'], '콜: 차량+날짜');
select has_index('public', 'fuel_records', 'fuel_records_vehicle_id_work_date_idx', array['vehicle_id', 'work_date'], '주유: 차량+날짜');
select has_index('public', 'maintenance_records', 'maintenance_records_vehicle_id_work_date_idx', array['vehicle_id', 'work_date'], '정비: 차량+날짜');
select has_index('public', 'misc_expense_records', 'misc_expense_records_vehicle_id_work_date_idx', array['vehicle_id', 'work_date'], '기타 지출: 차량+날짜');

select has_index('public', 'transport_details', 'transport_details_daily_log_id_idx', array['daily_log_id'], '콜: 하루 일지');
select has_index('public', 'fuel_records', 'fuel_records_daily_log_id_idx', array['daily_log_id'], '주유: 하루 일지');
select has_index('public', 'maintenance_records', 'maintenance_records_daily_log_id_idx', array['daily_log_id'], '정비: 하루 일지');
select has_index('public', 'misc_expense_records', 'misc_expense_records_daily_log_id_idx', array['daily_log_id'], '기타 지출: 하루 일지');

select has_index('public', 'transport_details', 'transport_details_client_id_idx', array['client_id'], '콜: 거래처');

select has_index('public', 'vehicles', 'vehicles_user_id_idx', array['user_id'], '차량: 계정');
select has_index('public', 'clients', 'clients_user_id_idx', array['user_id'], '거래처: 계정');
select has_index('public', 'tax_invoices', 'tax_invoices_user_id_idx', array['user_id'], '세금계산서: 계정');
select has_index('public', 'support_inquiries', 'support_inquiries_user_id_idx', array['user_id'], '문의: 계정');

select has_index('public', 'tax_invoices', 'tax_invoices_client_id_idx', array['client_id'], '세금계산서: 거래처');
select has_index('public', 'tax_invoices', 'tax_invoices_vehicle_id_idx', array['vehicle_id'], '세금계산서: 차량');

select has_index('public', 'driver_links', 'driver_links_vehicle_id_idx', array['vehicle_id'], '기사 연동: 차량');
select has_index('public', 'driver_links', 'driver_links_driver_id_idx', array['driver_id'], '기사 연동: 기사');
select has_index('public', 'driver_links', 'driver_links_owner_id_idx', array['owner_id'], '기사 연동: 차주');

select * from finish();
rollback;
