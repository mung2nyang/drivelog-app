-- 운영 DB 구조 시작점 4/4: 권한.
-- 2026-11-02 운영 DB에서 읽어 옴(migrations 0031까지 반영). 구조만 담고 사용자 데이터는 없다.

-- 로컬 기본 권한을 지우고 운영과 똑같이 다시 준다

revoke all on all tables in schema public from public, anon, authenticated, service_role;
revoke all on all sequences in schema public from public, anon, authenticated, service_role;
revoke all on all functions in schema public from public, anon, authenticated, service_role;

-- 표·순번

grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_users to service_role;
grant insert on table public.client_errors to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.client_errors to service_role;
grant delete, insert, maintain, select, update on table public.clients to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.clients to service_role;
grant delete, insert, maintain, select, update on table public.daily_inspections to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.daily_inspections to service_role;
grant delete, insert, maintain, select, update on table public.daily_logs to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.daily_logs to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.driver_invite_redeem_attempts to service_role;
grant delete, insert, maintain, select, update on table public.driver_links to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.driver_links to service_role;
grant delete, insert, maintain, select, update on table public.fuel_records to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.fuel_records to service_role;
grant delete, insert, maintain, select, update on table public.maintenance_records to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.maintenance_records to service_role;
grant delete, insert, maintain, select, update on table public.misc_expense_records to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.misc_expense_records to service_role;
grant delete, insert, maintain, select, update on table public.profiles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.profiles to service_role;
grant select on table public.support_inquiries to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.support_inquiries to service_role;
grant delete, insert, maintain, select, update on table public.tax_invoices to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.tax_invoices to service_role;
grant delete, insert, maintain, select, update on table public.transport_details to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.transport_details to service_role;
grant delete, insert, maintain, select, update on table public.vehicles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.vehicles to service_role;
grant select, update, usage on sequence public.client_errors_id_seq to anon;
grant select, update, usage on sequence public.client_errors_id_seq to authenticated;
grant select, update, usage on sequence public.client_errors_id_seq to service_role;
grant select, update, usage on sequence public.driver_invite_redeem_attempts_id_seq to anon;
grant select, update, usage on sequence public.driver_invite_redeem_attempts_id_seq to authenticated;
grant select, update, usage on sequence public.driver_invite_redeem_attempts_id_seq to service_role;

-- 열 단위

grant insert (content) on table public.support_inquiries to authenticated;
grant insert (status) on table public.support_inquiries to authenticated;
grant insert (title) on table public.support_inquiries to authenticated;
grant insert (type) on table public.support_inquiries to authenticated;
grant insert (user_id) on table public.support_inquiries to authenticated;

-- 함수

grant execute on function public.admin_answer_support_inquiry(inquiry_id uuid, answer_text text) to authenticated;
grant execute on function public.admin_answer_support_inquiry(inquiry_id uuid, answer_text text) to service_role;
grant execute on function public.admin_list_support_inquiries() to authenticated;
grant execute on function public.admin_list_support_inquiries() to service_role;
grant execute on function public.cancel_driver_unlink(p_link_id uuid) to authenticated;
grant execute on function public.cancel_driver_unlink(p_link_id uuid) to service_role;
grant execute on function public.consent_driver_unlink(p_link_id uuid) to authenticated;
grant execute on function public.consent_driver_unlink(p_link_id uuid) to service_role;
grant execute on function public.copy_driver_link_records_internal(p_link_id uuid) to service_role;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.delete_own_account() to service_role;
grant execute on function public.disconnect_driver_link_internal(p_link_id uuid) to service_role;
grant execute on function public.driver_can_access_vehicle_date(p_vehicle_id uuid, p_work_date date) to authenticated;
grant execute on function public.driver_can_access_vehicle_date(p_vehicle_id uuid, p_work_date date) to service_role;
grant execute on function public.driver_has_valid_vehicle_link(p_vehicle_id uuid) to authenticated;
grant execute on function public.driver_has_valid_vehicle_link(p_vehicle_id uuid) to service_role;
grant execute on function public.get_assigned_vehicle_summary() to authenticated;
grant execute on function public.get_assigned_vehicle_summary() to service_role;
grant execute on function public.get_linked_owner_business_info(p_owner_id uuid) to authenticated;
grant execute on function public.get_linked_owner_business_info(p_owner_id uuid) to service_role;
grant execute on function public.get_linked_owner_profile_settings(p_owner_id uuid) to service_role;
grant execute on function public.guard_driver_link_invite_code() to service_role;
grant execute on function public.guard_driver_link_unlink() to service_role;
grant execute on function public.guard_log_writer_change() to service_role;
grant execute on function public.guard_vehicle_delete_while_linked() to service_role;
grant execute on function public.has_linked_profile_access(p_profile_id uuid) to authenticated;
grant execute on function public.has_linked_profile_access(p_profile_id uuid) to service_role;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;
grant execute on function public.owns_driver_link_vehicle(p_vehicle_id uuid) to authenticated;
grant execute on function public.owns_driver_link_vehicle(p_vehicle_id uuid) to service_role;
grant execute on function public.redeem_driver_invite_code(p_invite_code text) to authenticated;
grant execute on function public.redeem_driver_invite_code(p_invite_code text) to service_role;
grant execute on function public.remove_day_log(p_vehicle_id uuid, p_work_date date) to authenticated;
grant execute on function public.remove_day_log(p_vehicle_id uuid, p_work_date date) to service_role;
grant execute on function public.rename_and_save_sub_vehicle(p_vehicle_id uuid, p_new_number text, p_row jsonb) to authenticated;
grant execute on function public.rename_and_save_sub_vehicle(p_vehicle_id uuid, p_new_number text, p_row jsonb) to service_role;
grant execute on function public.rename_sub_vehicle(p_vehicle_id uuid, p_new_number text) to authenticated;
grant execute on function public.rename_sub_vehicle(p_vehicle_id uuid, p_new_number text) to service_role;
grant execute on function public.replace_transport_details(p_daily_log_id uuid, p_rows jsonb) to authenticated;
grant execute on function public.replace_transport_details(p_daily_log_id uuid, p_rows jsonb) to service_role;
grant execute on function public.request_driver_unlink(p_link_id uuid) to authenticated;
grant execute on function public.request_driver_unlink(p_link_id uuid) to service_role;
grant execute on function public.save_day_log(p_log jsonb, p_rows jsonb) to authenticated;
grant execute on function public.save_day_log(p_log jsonb, p_rows jsonb) to service_role;
grant execute on function public.settle_expired_driver_unlinks() to authenticated;
grant execute on function public.settle_expired_driver_unlinks() to service_role;
grant execute on function public.touch_daily_inspections_updated_at() to service_role;
grant execute on function public.upsert_driver_link_idempotent(p_idempotency_key text, p_vehicle_id uuid, p_invite_code text, p_assignment_start date, p_assignment_end date) to authenticated;
grant execute on function public.upsert_driver_link_idempotent(p_idempotency_key text, p_vehicle_id uuid, p_invite_code text, p_assignment_start date, p_assignment_end date) to service_role;
grant execute on function public.vehicle_has_linked_driver_on(p_vehicle_id uuid, p_work_date date) to authenticated;
grant execute on function public.vehicle_has_linked_driver_on(p_vehicle_id uuid, p_work_date date) to service_role;
