-- 운영 DB 구조 시작점 1/4: 확장·표·제약·색인.
-- 2026-11-02 운영 DB에서 읽어 옴(migrations 0031까지 반영). 구조만 담고 사용자 데이터는 없다.

-- 확장

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- 표

create table public.admin_users (
  user_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table public.client_errors (
  id bigint generated always as identity not null,
  created_at timestamp with time zone default now() not null,
  user_id uuid default auth.uid() not null,
  kind text not null,
  message text default ''::text not null,
  stack text default ''::text not null,
  path text default ''::text not null,
  user_agent text default ''::text not null
);

create table public.clients (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  legacy_client_id text,
  company_name text,
  manager_name text,
  biz_number text,
  phone text,
  tax_invoice_enabled boolean default false,
  is_pinned boolean default false,
  comm_enabled boolean default false,
  comm_type text,
  comm_value text,
  payment_term text,
  payment_term_value text,
  display_order integer default 0,
  raw jsonb
);

create table public.daily_inspections (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  vehicle_id uuid not null,
  work_date date not null,
  items jsonb default '{}'::jsonb not null,
  action_note text,
  inspector_name text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.daily_logs (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  vehicle_id uuid not null,
  work_date date not null,
  is_off boolean default false,
  fixed_count numeric default 0,
  pallet_count numeric default 0,
  raw jsonb
);

create table public.driver_invite_redeem_attempts (
  id bigint generated always as identity not null,
  user_id uuid not null,
  attempted_at timestamp with time zone default now() not null
);

create table public.driver_links (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  driver_id uuid,
  vehicle_id uuid not null,
  invite_code text,
  status text default 'pending'::text,
  assignment_start date,
  assignment_end date,
  linked_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  idempotency_key text,
  salary_amount numeric,
  unlink_requested_by uuid,
  unlink_requested_at timestamp with time zone,
  invite_expires_at timestamp with time zone
);

create table public.fuel_records (
  id uuid default gen_random_uuid() not null,
  daily_log_id uuid not null,
  user_id uuid,
  vehicle_id uuid not null,
  work_date date,
  sequence integer default 0,
  cost_amount numeric default 0,
  subsidy_amount numeric default 0,
  volume_liter numeric default 0,
  mileage_km numeric default 0,
  raw jsonb
);

create table public.maintenance_records (
  id uuid default gen_random_uuid() not null,
  daily_log_id uuid not null,
  user_id uuid,
  vehicle_id uuid not null,
  work_date date,
  sequence integer default 0,
  cost_amount numeric default 0,
  mileage_km numeric default 0,
  raw jsonb
);

create table public.misc_expense_records (
  id uuid default gen_random_uuid() not null,
  daily_log_id uuid not null,
  user_id uuid,
  vehicle_id uuid not null,
  work_date date,
  sequence integer default 0,
  cost_amount numeric default 0,
  raw jsonb
);

create table public.profiles (
  id uuid not null,
  account_type text,
  name text,
  phone text,
  business_name text,
  business_number text,
  business_address text,
  business_type text,
  business_item text,
  business_email text,
  bank_name text,
  account_number text,
  settings jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default now(),
  business_representative text,
  account_holder text
);

create table public.support_inquiries (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  type text,
  title text,
  content text,
  status text default 'open'::text,
  answer text,
  answered_at timestamp with time zone,
  raw jsonb,
  created_at timestamp with time zone default now()
);

create table public.tax_invoices (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  vehicle_id uuid,
  client_id uuid,
  flow text,
  month_key text,
  supply_amount numeric default 0,
  tax_amount numeric default 0,
  total_amount numeric default 0,
  status text default 'draft'::text,
  raw jsonb
);

create table public.transport_details (
  id uuid default gen_random_uuid() not null,
  daily_log_id uuid not null,
  user_id uuid,
  vehicle_id uuid not null,
  client_id uuid,
  work_date date,
  sequence integer default 0,
  load_loc text,
  unload_loc text,
  fare_amount numeric default 0,
  distance_km numeric default 0,
  insurance_fee_amount numeric default 0,
  remarks text,
  departure_time text,
  arrival_time text,
  receipt text,
  start_odometer text,
  end_odometer text,
  vat_exempt boolean default false,
  platform text,
  cargo_tonnage text,
  payment_status text default '미수'::text,
  payment_due_date date,
  payments jsonb default '[]'::jsonb,
  commission_snapshot jsonb,
  raw jsonb
);

create table public.vehicles (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  legacy_log_id text,
  number text,
  type text,
  tonnage text,
  display_order integer default 0,
  comm_enabled boolean default false,
  comm_type text,
  comm_value text,
  driver_link_id text,
  driver_name text,
  driver_legal_name text,
  driver_business_number text,
  driver_bank_name text,
  driver_account_number text,
  archived boolean default false,
  raw jsonb,
  driver_pay_mode text,
  driver_salary_amount numeric
);

-- 기본키·고유·검사 제약

alter table public.admin_users add constraint admin_users_pkey PRIMARY KEY (user_id);
alter table public.client_errors add constraint client_errors_kind_check CHECK ((kind = ANY (ARRAY['render'::text, 'error'::text, 'unhandledrejection'::text])));
alter table public.client_errors add constraint client_errors_message_check CHECK ((char_length(message) <= 500));
alter table public.client_errors add constraint client_errors_path_check CHECK ((char_length(path) <= 300));
alter table public.client_errors add constraint client_errors_stack_check CHECK ((char_length(stack) <= 2000));
alter table public.client_errors add constraint client_errors_user_agent_check CHECK ((char_length(user_agent) <= 200));
alter table public.client_errors add constraint client_errors_pkey PRIMARY KEY (id);
alter table public.clients add constraint clients_pkey PRIMARY KEY (id);
alter table public.daily_inspections add constraint daily_inspections_items_check CHECK (((jsonb_typeof(items) = 'object'::text) AND (NOT jsonb_path_exists(items, '$.*?(@.type() != "string" || @ != "good" && @ != "bad")'::jsonpath))));
alter table public.daily_inspections add constraint daily_inspections_pkey PRIMARY KEY (id);
alter table public.daily_inspections add constraint daily_inspections_vehicle_date_key UNIQUE (vehicle_id, work_date);
alter table public.daily_logs add constraint daily_logs_pkey PRIMARY KEY (id);
alter table public.daily_logs add constraint daily_logs_vehicle_id_work_date_key UNIQUE (vehicle_id, work_date);
alter table public.driver_invite_redeem_attempts add constraint driver_invite_redeem_attempts_pkey PRIMARY KEY (id);
alter table public.driver_links add constraint driver_links_pkey PRIMARY KEY (id);
alter table public.driver_links add constraint driver_links_invite_code_key UNIQUE (invite_code);
alter table public.fuel_records add constraint fuel_records_pkey PRIMARY KEY (id);
alter table public.maintenance_records add constraint maintenance_records_pkey PRIMARY KEY (id);
alter table public.misc_expense_records add constraint misc_expense_records_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.support_inquiries add constraint support_inquiries_pkey PRIMARY KEY (id);
alter table public.tax_invoices add constraint tax_invoices_pkey PRIMARY KEY (id);
alter table public.transport_details add constraint transport_details_pkey PRIMARY KEY (id);
alter table public.vehicles add constraint vehicles_pkey PRIMARY KEY (id);

-- 외래키

alter table public.admin_users add constraint admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.client_errors add constraint client_errors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.clients add constraint clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.daily_inspections add constraint daily_inspections_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.daily_inspections add constraint daily_inspections_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
alter table public.daily_logs add constraint daily_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.daily_logs add constraint daily_logs_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
alter table public.driver_invite_redeem_attempts add constraint driver_invite_redeem_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.driver_links add constraint driver_links_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.driver_links add constraint driver_links_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.driver_links add constraint driver_links_unlink_requested_by_fkey FOREIGN KEY (unlink_requested_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.driver_links add constraint driver_links_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
alter table public.fuel_records add constraint fuel_records_daily_log_id_fkey FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE;
alter table public.fuel_records add constraint fuel_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.fuel_records add constraint fuel_records_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
alter table public.maintenance_records add constraint maintenance_records_daily_log_id_fkey FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE;
alter table public.maintenance_records add constraint maintenance_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.maintenance_records add constraint maintenance_records_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
alter table public.misc_expense_records add constraint misc_expense_records_daily_log_id_fkey FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE;
alter table public.misc_expense_records add constraint misc_expense_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.misc_expense_records add constraint misc_expense_records_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.support_inquiries add constraint support_inquiries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.tax_invoices add constraint tax_invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public.tax_invoices add constraint tax_invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.tax_invoices add constraint tax_invoices_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
alter table public.transport_details add constraint transport_details_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public.transport_details add constraint transport_details_daily_log_id_fkey FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE;
alter table public.transport_details add constraint transport_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.transport_details add constraint transport_details_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
alter table public.vehicles add constraint vehicles_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 색인

CREATE INDEX driver_invite_redeem_attempts_user_time ON public.driver_invite_redeem_attempts USING btree (user_id, attempted_at);
CREATE UNIQUE INDEX driver_links_owner_idempotency_key_key ON public.driver_links USING btree (owner_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);
