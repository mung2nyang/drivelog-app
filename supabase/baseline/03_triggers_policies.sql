-- 운영 DB 구조 시작점 3/4: 트리거·행 보안.
-- 2026-11-02 운영 DB에서 읽어 옴(migrations 0031까지 반영). 구조만 담고 사용자 데이터는 없다.

-- 트리거

CREATE TRIGGER daily_inspections_guard_writer BEFORE UPDATE OF user_id ON public.daily_inspections FOR EACH ROW EXECUTE FUNCTION guard_log_writer_change();
CREATE TRIGGER daily_inspections_touch BEFORE UPDATE ON public.daily_inspections FOR EACH ROW EXECUTE FUNCTION touch_daily_inspections_updated_at();
CREATE TRIGGER daily_logs_guard_writer BEFORE UPDATE OF user_id ON public.daily_logs FOR EACH ROW EXECUTE FUNCTION guard_log_writer_change();
CREATE TRIGGER driver_links_guard_invite_code BEFORE INSERT OR UPDATE ON public.driver_links FOR EACH ROW EXECUTE FUNCTION guard_driver_link_invite_code();
CREATE TRIGGER driver_links_guard_unlink BEFORE INSERT OR UPDATE ON public.driver_links FOR EACH ROW EXECUTE FUNCTION guard_driver_link_unlink();
CREATE TRIGGER fuel_records_guard_writer BEFORE UPDATE OF user_id ON public.fuel_records FOR EACH ROW EXECUTE FUNCTION guard_log_writer_change();
CREATE TRIGGER maintenance_records_guard_writer BEFORE UPDATE OF user_id ON public.maintenance_records FOR EACH ROW EXECUTE FUNCTION guard_log_writer_change();
CREATE TRIGGER misc_expense_records_guard_writer BEFORE UPDATE OF user_id ON public.misc_expense_records FOR EACH ROW EXECUTE FUNCTION guard_log_writer_change();
CREATE TRIGGER transport_details_guard_writer BEFORE UPDATE OF user_id ON public.transport_details FOR EACH ROW EXECUTE FUNCTION guard_log_writer_change();
CREATE TRIGGER vehicles_guard_linked_delete BEFORE DELETE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION guard_vehicle_delete_while_linked();

-- 행 보안(RLS) 켜기

alter table public.admin_users enable row level security;
alter table public.client_errors enable row level security;
alter table public.clients enable row level security;
alter table public.daily_inspections enable row level security;
alter table public.daily_logs enable row level security;
alter table public.driver_invite_redeem_attempts enable row level security;
alter table public.driver_links enable row level security;
alter table public.fuel_records enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.misc_expense_records enable row level security;
alter table public.profiles enable row level security;
alter table public.support_inquiries enable row level security;
alter table public.tax_invoices enable row level security;
alter table public.transport_details enable row level security;
alter table public.vehicles enable row level security;

-- 행 보안 규칙

create policy "본인 오류 기록 넣기" on public.client_errors as permissive for insert to authenticated
  with check ((user_id = auth.uid()));
create policy "linked driver can read owner scoped clients" on public.clients as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM (driver_links dl
     JOIN vehicles v ON ((v.id = dl.vehicle_id)))
  WHERE ((dl.driver_id = auth.uid()) AND (dl.status = 'linked'::text) AND (dl.owner_id = clients.user_id) AND (v.number = (clients.raw ->> 'scopedToVehicleNumber'::text))))));
create policy "linked driver can write owner scoped clients" on public.clients as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM (driver_links dl
     JOIN vehicles v ON ((v.id = dl.vehicle_id)))
  WHERE ((dl.driver_id = auth.uid()) AND (dl.status = 'linked'::text) AND (dl.owner_id = clients.user_id) AND (v.number = (clients.raw ->> 'scopedToVehicleNumber'::text))))))
  with check ((EXISTS ( SELECT 1
   FROM (driver_links dl
     JOIN vehicles v ON ((v.id = dl.vehicle_id)))
  WHERE ((dl.driver_id = auth.uid()) AND (dl.status = 'linked'::text) AND (dl.owner_id = clients.user_id) AND (v.number = (clients.raw ->> 'scopedToVehicleNumber'::text))))));
create policy "본인 거래처만 CRUD" on public.clients as permissive for all to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy "일상점검 삭제" on public.daily_inspections as permissive for delete to public
  using ((driver_can_access_vehicle_date(vehicle_id, work_date) OR ((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) AND (NOT vehicle_has_linked_driver_on(vehicle_id, work_date)))));
create policy "일상점검 수정" on public.daily_inspections as permissive for update to public
  using ((driver_can_access_vehicle_date(vehicle_id, work_date) OR ((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) AND (NOT vehicle_has_linked_driver_on(vehicle_id, work_date)))))
  with check ((driver_can_access_vehicle_date(vehicle_id, work_date) OR ((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) AND (NOT vehicle_has_linked_driver_on(vehicle_id, work_date)))));
create policy "일상점검 작성" on public.daily_inspections as permissive for insert to public
  with check (((user_id = auth.uid()) AND (driver_can_access_vehicle_date(vehicle_id, work_date) OR ((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) AND (NOT vehicle_has_linked_driver_on(vehicle_id, work_date))))));
create policy "일상점검 조회" on public.daily_inspections as permissive for select to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "linked driver reads own assigned vehicle daily_logs" on public.daily_logs as permissive for select to public
  using (driver_can_access_vehicle_date(vehicle_id, work_date));
create policy "운행기록 삭제" on public.daily_logs as permissive for delete to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "운행기록 수정" on public.daily_logs as permissive for update to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "운행기록 작성" on public.daily_logs as permissive for insert to public
  with check (((user_id = auth.uid()) AND ((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date))));
create policy "운행기록 조회" on public.daily_logs as permissive for select to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "driver reads own driver_links row" on public.driver_links as permissive for select to public
  using ((driver_id = auth.uid()));
create policy "연동 정보 조회" on public.driver_links as permissive for select to public
  using (((owner_id = auth.uid()) OR (driver_id = auth.uid())));
create policy "차주만 초대 삭제" on public.driver_links as permissive for delete to public
  using (((owner_id = auth.uid()) AND (status IS DISTINCT FROM 'linked'::text)));
create policy "차주만 초대 생성" on public.driver_links as permissive for insert to authenticated
  with check (((owner_id = auth.uid()) AND owns_driver_link_vehicle(vehicle_id) AND (status = 'pending'::text) AND (driver_id IS NULL) AND (unlink_requested_by IS NULL) AND (unlink_requested_at IS NULL)));
create policy "차주만 초대 수정" on public.driver_links as permissive for update to authenticated
  using (((owner_id = auth.uid()) AND owns_driver_link_vehicle(vehicle_id)))
  with check (((owner_id = auth.uid()) AND owns_driver_link_vehicle(vehicle_id)));
create policy "유류기록 삭제" on public.fuel_records as permissive for delete to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "유류기록 수정" on public.fuel_records as permissive for update to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "유류기록 작성" on public.fuel_records as permissive for insert to public
  with check (((user_id = auth.uid()) AND ((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date))));
create policy "유류기록 조회" on public.fuel_records as permissive for select to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "정비기록 삭제" on public.maintenance_records as permissive for delete to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "정비기록 수정" on public.maintenance_records as permissive for update to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "정비기록 작성" on public.maintenance_records as permissive for insert to public
  with check (((user_id = auth.uid()) AND ((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date))));
create policy "정비기록 조회" on public.maintenance_records as permissive for select to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "기타지출 삭제" on public.misc_expense_records as permissive for delete to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "기타지출 수정" on public.misc_expense_records as permissive for update to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "기타지출 작성" on public.misc_expense_records as permissive for insert to public
  with check (((user_id = auth.uid()) AND ((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date))));
create policy "기타지출 조회" on public.misc_expense_records as permissive for select to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "본인 프로필 생성" on public.profiles as permissive for insert to public
  with check ((id = auth.uid()));
create policy "본인 프로필 수정" on public.profiles as permissive for update to public
  using ((id = auth.uid()));
create policy "본인 프로필 조회" on public.profiles as permissive for select to authenticated
  using (((id = auth.uid()) OR has_linked_profile_access(id)));
create policy "본인 문의만 작성" on public.support_inquiries as permissive for insert to authenticated
  with check ((auth.uid() = user_id));
create policy "본인 문의만 조회" on public.support_inquiries as permissive for select to authenticated
  using ((auth.uid() = user_id));
create policy "본인 세금계산서만 CRUD" on public.tax_invoices as permissive for all to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy "linked driver reads own assigned vehicle transport_details" on public.transport_details as permissive for select to public
  using (driver_can_access_vehicle_date(vehicle_id, work_date));
create policy "콜상세 삭제" on public.transport_details as permissive for delete to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "콜상세 수정" on public.transport_details as permissive for update to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "콜상세 작성" on public.transport_details as permissive for insert to public
  with check (((user_id = auth.uid()) AND ((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date))));
create policy "콜상세 조회" on public.transport_details as permissive for select to public
  using (((vehicle_id IN ( SELECT v.id
   FROM vehicles v
  WHERE (v.user_id = auth.uid()))) OR driver_can_access_vehicle_date(vehicle_id, work_date)));
create policy "본인 차량 등록" on public.vehicles as permissive for insert to public
  with check ((user_id = auth.uid()));
create policy "본인 차량 삭제" on public.vehicles as permissive for delete to public
  using ((user_id = auth.uid()));
create policy "본인 차량 수정" on public.vehicles as permissive for update to public
  using ((user_id = auth.uid()));
create policy "차량 조회" on public.vehicles as permissive for select to authenticated
  using (((user_id = auth.uid()) OR driver_has_valid_vehicle_link(id)));
