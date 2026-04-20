create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'app_private'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hrd_documents',
  'hrd_documents',
  true,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.pdf_settings (
  team_id uuid primary key references public.teams(id) on delete cascade,
  header_color text,
  header_logo_file_id uuid references public.file_assets(id) on delete set null,
  footer_logo_file_id uuid references public.file_assets(id) on delete set null,
  company_name text,
  address text,
  phone text,
  extra jsonb,
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  legacy_firebase_id text,
  nama_penerima text not null,
  nik text,
  jenis_kelamin text,
  jenjang text,
  nama_instansi text,
  npsn_nspp text,
  jarak_meter integer,
  status text not null default 'active',
  data_status text,
  tempat_lahir text,
  tanggal_lahir date,
  district text,
  sub_district text,
  village text,
  hamlet text,
  rt text,
  rw text,
  alamat_lengkap text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint beneficiaries_status_check
    check (status in ('active', 'pending', 'inactive'))
);

create table if not exists public.hrd_applicants (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  legacy_firebase_id text,
  source_beneficiary_id uuid references public.beneficiaries(id) on delete set null,
  nama_lengkap text not null,
  email text,
  no_telepon text,
  jenis_kelamin text,
  nik text,
  no_kk text,
  tempat_lahir text,
  tanggal_lahir date,
  pendidikan_terakhir text,
  nama_institusi_pendidikan text,
  jurusan text,
  posisi_dilamar text,
  sumber_lowongan text,
  status_aplikasi text not null default 'screening',
  pengalaman_kerja text,
  skills text,
  district text,
  sub_district text,
  village text,
  hamlet text,
  rt text,
  rw text,
  alamat_lengkap text,
  alamat_domisili text,
  catatan_hrd text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint hrd_applicants_status_check
    check (status_aplikasi in ('screening', 'interview_hr', 'offering', 'diterima', 'ditolak'))
);

create table if not exists public.hrd_applicant_documents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  legacy_firebase_id text,
  applicant_id uuid not null references public.hrd_applicants(id) on delete cascade,
  document_type text not null,
  file_asset_id uuid not null references public.file_assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint hrd_applicant_documents_type_check
    check (document_type in ('cv', 'ktp', 'kk', 'pas_foto', 'surat_sehat', 'other')),
  constraint hrd_applicant_documents_unique
    unique (applicant_id, file_asset_id, document_type)
);

do $$
begin
  alter table public.beneficiaries
    add column if not exists team_id uuid references public.teams(id) on delete cascade,
    add column if not exists legacy_firebase_id text,
    add column if not exists nama_penerima text,
    add column if not exists jenis_kelamin text,
    add column if not exists jenjang text,
    add column if not exists nama_instansi text,
    add column if not exists npsn_nspp text,
    add column if not exists jarak_meter integer,
    add column if not exists status text not null default 'active',
    add column if not exists data_status text,
    add column if not exists tempat_lahir text,
    add column if not exists tanggal_lahir date,
    add column if not exists district text,
    add column if not exists sub_district text,
    add column if not exists village text,
    add column if not exists hamlet text,
    add column if not exists rt text,
    add column if not exists rw text,
    add column if not exists alamat_lengkap text,
    add column if not exists notes text,
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists deleted_at timestamptz;
exception
  when undefined_table then
    null;
end
$$;

do $$
begin
  alter table public.hrd_applicants
    add column if not exists team_id uuid references public.teams(id) on delete cascade,
    add column if not exists legacy_firebase_id text,
    add column if not exists source_beneficiary_id uuid references public.beneficiaries(id) on delete set null,
    add column if not exists nama_lengkap text,
    add column if not exists email text,
    add column if not exists no_telepon text,
    add column if not exists jenis_kelamin text,
    add column if not exists nik text,
    add column if not exists no_kk text,
    add column if not exists tempat_lahir text,
    add column if not exists tanggal_lahir date,
    add column if not exists pendidikan_terakhir text,
    add column if not exists nama_institusi_pendidikan text,
    add column if not exists jurusan text,
    add column if not exists posisi_dilamar text,
    add column if not exists sumber_lowongan text,
    add column if not exists pengalaman_kerja text,
    add column if not exists skills text,
    add column if not exists district text,
    add column if not exists sub_district text,
    add column if not exists village text,
    add column if not exists hamlet text,
    add column if not exists rt text,
    add column if not exists rw text,
    add column if not exists alamat_lengkap text,
    add column if not exists alamat_domisili text,
    add column if not exists catatan_hrd text,
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists deleted_at timestamptz;
exception
  when undefined_table then
    null;
end
$$;

do $$
begin
  alter table public.hrd_applicant_documents
    add column if not exists team_id uuid references public.teams(id) on delete cascade,
    add column if not exists legacy_firebase_id text,
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists deleted_at timestamptz;
exception
  when undefined_table then
    null;
end
$$;

update public.beneficiaries
set
  data_status = coalesce(data_status, status),
  updated_at = coalesce(updated_at, created_at, now())
where
  (data_status is null and status is not null)
  or updated_at is null;

update public.hrd_applicant_documents d
set
  team_id = coalesce(
    d.team_id,
    a.team_id
  ),
  updated_at = coalesce(d.updated_at, d.created_at, now())
from public.hrd_applicants a
where a.id = d.applicant_id
  and (d.team_id is null or d.updated_at is null);

do $$
declare
  target_table text;
  target_tables text[] := array[
    'teams',
    'profiles',
    'team_members',
    'projects',
    'suppliers',
    'expense_categories',
    'funding_creditors',
    'professions',
    'staff',
    'workers',
    'worker_wage_rates',
    'materials',
    'transactions',
    'expenses',
    'expense_line_items',
    'expense_attachments',
    'bills',
    'bill_payments',
    'project_incomes',
    'loans',
    'loan_payments',
    'attendance_records',
    'stock_transactions',
    'file_assets',
    'invite_tokens',
    'beneficiaries',
    'hrd_applicants',
    'hrd_applicant_documents'
  ];
begin
  foreach target_table in array target_tables loop
    execute format(
      'alter table public.%I add column if not exists updated_at timestamptz not null default now()',
      target_table
    );
    execute format(
      'alter table public.%I add column if not exists deleted_at timestamptz',
      target_table
    );
    execute format(
      'alter table public.%I add column if not exists legacy_firebase_id text',
      target_table
    );
  end loop;
end
$$;

alter table public.attendance_records
  add column if not exists worker_name_snapshot text,
  add column if not exists project_name_snapshot text;

alter table public.bills
  add column if not exists worker_name_snapshot text,
  add column if not exists project_name_snapshot text,
  add column if not exists creditor_name_snapshot text;

alter table public.bill_payments
  add column if not exists worker_name_snapshot text,
  add column if not exists supplier_name_snapshot text,
  add column if not exists project_name_snapshot text;

alter table public.loan_payments
  add column if not exists creditor_name_snapshot text;

alter table public.transactions
  add column if not exists worker_name_snapshot text,
  add column if not exists supplier_name_snapshot text,
  add column if not exists project_name_snapshot text,
  add column if not exists creditor_name_snapshot text;

alter table public.stock_transactions
  add column if not exists team_id uuid references public.teams(id) on delete set null,
  add column if not exists price_per_unit numeric(16,2),
  add column if not exists notes text,
  add column if not exists created_by_user_id uuid references public.profiles(id) on delete set null;

update public.attendance_records ar
set
  worker_name_snapshot = coalesce(ar.worker_name_snapshot, w.worker_name, w.name),
  project_name_snapshot = coalesce(ar.project_name_snapshot, p.project_name, p.name),
  updated_at = coalesce(ar.updated_at, ar.created_at, now())
from public.workers w,
     public.projects p
where w.id = ar.worker_id
  and p.id = ar.project_id
  and (
    ar.worker_name_snapshot is null
    or ar.project_name_snapshot is null
    or ar.updated_at is null
  );

update public.bills b
set
  worker_name_snapshot = coalesce(b.worker_name_snapshot, w.worker_name, w.name)
from public.workers w
where w.id = b.worker_id
  and b.worker_name_snapshot is null;

update public.bills b
set
  project_name_snapshot = coalesce(b.project_name_snapshot, p.project_name, p.name)
from public.projects p
where p.id = b.project_id
  and b.project_name_snapshot is null;

update public.loans l
set updated_at = coalesce(l.updated_at, l.created_at, now())
where l.updated_at is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'beneficiaries'
      and column_name = 'name'
  ) then
    execute $sql$
      update public.beneficiaries
      set
        nama_penerima = coalesce(nama_penerima, name),
        updated_at = coalesce(updated_at, created_at, now())
      where (nama_penerima is null and name is not null)
         or updated_at is null
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'beneficiaries'
      and column_name = 'institution'
  ) then
    execute $sql$
      update public.beneficiaries
      set
        nama_instansi = coalesce(nama_instansi, institution),
        updated_at = coalesce(updated_at, created_at, now())
      where (nama_instansi is null and institution is not null)
         or updated_at is null
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hrd_applicants'
      and column_name = 'name'
  ) then
    execute $sql$
      update public.hrd_applicants
      set
        nama_lengkap = coalesce(nama_lengkap, name),
        updated_at = coalesce(updated_at, created_at, now())
      where (nama_lengkap is null and name is not null)
         or updated_at is null
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hrd_applicants'
      and column_name = 'position'
  ) then
    execute $sql$
      update public.hrd_applicants
      set
        posisi_dilamar = coalesce(posisi_dilamar, position),
        updated_at = coalesce(updated_at, created_at, now())
      where (posisi_dilamar is null and position is not null)
         or updated_at is null
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hrd_applicants'
      and column_name = 'notes'
  ) then
    execute $sql$
      update public.hrd_applicants
      set
        catatan_hrd = coalesce(catatan_hrd, notes),
        updated_at = coalesce(updated_at, created_at, now())
      where (catatan_hrd is null and notes is not null)
         or updated_at is null
    $sql$;
  end if;
end
$$;

update public.loan_payments lp
set
  creditor_name_snapshot = coalesce(lp.creditor_name_snapshot, l.creditor_name_snapshot),
  updated_at = coalesce(lp.updated_at, lp.created_at, now())
from public.loans l
where l.id = lp.loan_id
  and (lp.creditor_name_snapshot is null or lp.updated_at is null);

update public.bill_payments bp
set
  worker_name_snapshot = coalesce(bp.worker_name_snapshot, b.worker_name_snapshot),
  supplier_name_snapshot = coalesce(bp.supplier_name_snapshot, b.supplier_name_snapshot),
  project_name_snapshot = coalesce(bp.project_name_snapshot, b.project_name_snapshot),
  updated_at = coalesce(bp.updated_at, bp.created_at, now())
from public.bills b
where b.id = bp.bill_id
  and (
    bp.worker_name_snapshot is null
    or bp.supplier_name_snapshot is null
    or bp.project_name_snapshot is null
    or bp.updated_at is null
  );

update public.transactions t
set updated_at = coalesce(t.updated_at, t.created_at, now())
where t.updated_at is null;

update public.stock_transactions st
set team_id = coalesce(
  st.team_id,
  (
    select e.team_id
    from public.expenses e
    where e.id = st.expense_id
    limit 1
  ),
  (
    select m.team_id
    from public.materials m
    where m.id = st.material_id
    limit 1
  )
)
where st.team_id is null;

drop index if exists beneficiaries_team_nik_key;
create unique index if not exists beneficiaries_team_nik_active_key
  on public.beneficiaries (team_id, nik)
  where nik is not null and deleted_at is null;

drop index if exists hrd_applicants_team_nik_key;
create unique index if not exists hrd_applicants_team_nik_active_key
  on public.hrd_applicants (team_id, nik)
  where nik is not null and deleted_at is null;

create index if not exists idx_beneficiaries_team_id
  on public.beneficiaries (team_id)
  where deleted_at is null;

create index if not exists idx_hrd_applicants_team_id
  on public.hrd_applicants (team_id)
  where deleted_at is null;

create index if not exists idx_hrd_applicant_documents_team_id
  on public.hrd_applicant_documents (team_id)
  where deleted_at is null;

create index if not exists idx_hrd_applicant_documents_applicant_active
  on public.hrd_applicant_documents (applicant_id)
  where deleted_at is null;

create index if not exists idx_pdf_settings_team_id
  on public.pdf_settings (team_id);

alter table public.attendance_records
  drop constraint if exists attendance_records_billing_status_check;

alter table public.attendance_records
  add constraint attendance_records_billing_status_check
  check (billing_status in ('unbilled', 'billed', 'paid'));

create or replace function public.fn_auto_update_stock_from_line_item()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_expense_type text;
  v_document_type text;
  v_transaction_date date;
  v_source_type text;
  v_direction text;
  v_stock_delta numeric(14,3);
  v_inserted_rows integer := 0;
begin
  select e.expense_type, e.document_type, e.expense_date
  into v_expense_type, v_document_type, v_transaction_date
  from public.expenses e
  where e.id = new.expense_id;

  if coalesce(v_expense_type, '') <> 'material' then
    return new;
  end if;

  if coalesce(v_document_type, 'faktur') = 'surat_jalan' then
    v_direction := 'out';
    v_source_type := 'delivery_order';
    v_stock_delta := coalesce(new.qty, 0) * -1;
  else
    v_direction := 'in';
    v_source_type := 'invoice';
    v_stock_delta := coalesce(new.qty, 0);
  end if;

  insert into public.stock_transactions (
    team_id,
    material_id,
    project_id,
    expense_id,
    expense_line_item_id,
    quantity,
    direction,
    source_type,
    transaction_date,
    price_per_unit
  )
  values (
    (select team_id from public.expenses where id = new.expense_id),
    new.material_id,
    (select project_id from public.expenses where id = new.expense_id),
    new.expense_id,
    new.id,
    new.qty,
    v_direction,
    v_source_type,
    coalesce(v_transaction_date, current_date),
    nullif(new.unit_price, 0)
  )
  on conflict (expense_line_item_id) do nothing;

  get diagnostics v_inserted_rows = row_count;

  if v_inserted_rows > 0 then
    update public.materials
    set current_stock = coalesce(current_stock, 0) + v_stock_delta
    where id = new.material_id;
  end if;

  return new;
end;
$$;

drop view if exists public.vw_billing_stats;

create view public.vw_billing_stats
with (security_invoker = on)
as
select
  b.team_id,
  coalesce(
    sum(
      case
        when b.status in ('unpaid', 'partial') then greatest(coalesce(b.amount, 0) - coalesce(b.paid_amount, 0), 0)
        else 0
      end
    ),
    0
  )::numeric(16,2) as total_outstanding,
  coalesce(sum(coalesce(b.paid_amount, 0)), 0)::numeric(16,2) as total_paid,
  count(*)::bigint as total_bill_count,
  coalesce(
    sum(
      case
        when b.bill_type = 'gaji' and b.status in ('unpaid', 'partial')
          then greatest(coalesce(b.amount, 0) - coalesce(b.paid_amount, 0), 0)
        else 0
      end
    ),
    0
  )::numeric(16,2) as total_outstanding_salary
from public.bills b
where b.deleted_at is null
group by b.team_id;

drop view if exists public.vw_project_financial_summary;

create view public.vw_project_financial_summary
with (security_invoker = on)
as
with project_base as (
  select
    p.id as project_id,
    p.team_id,
    coalesce(p.project_name, p.name) as project_name,
    coalesce(p.status, case when coalesce(p.is_active, true) then 'active' else 'inactive' end) as project_status
  from public.projects p
  where p.deleted_at is null
),
income_totals as (
  select
    pi.project_id,
    pi.team_id,
    coalesce(sum(coalesce(pi.amount, 0)), 0) as total_income
  from public.project_incomes pi
  where pi.deleted_at is null
    and pi.project_id is not null
  group by pi.project_id, pi.team_id
),
material_expense_totals as (
  select
    e.project_id,
    e.team_id,
    coalesce(sum(coalesce(e.total_amount, e.amount, 0)), 0) as material_expense
  from public.expenses e
  where e.deleted_at is null
    and e.project_id is not null
    and lower(coalesce(e.expense_type, '')) in ('material', 'material_invoice')
  group by e.project_id, e.team_id
),
operating_expense_totals as (
  select
    e.project_id,
    e.team_id,
    coalesce(sum(coalesce(e.total_amount, e.amount, 0)), 0) as operating_expense
  from public.expenses e
  where e.deleted_at is null
    and e.project_id is not null
    and lower(coalesce(e.expense_type, '')) in ('operasional', 'operational', 'lainnya', 'other')
  group by e.project_id, e.team_id
),
salary_breakdown as (
  select
    ar.project_id,
    coalesce(ar.team_id, b.team_id) as team_id,
    coalesce(sum(coalesce(ar.total_pay, 0)), 0) as salary_expense,
    coalesce(
      sum(
        case
          when b.status = 'paid' then coalesce(ar.total_pay, 0)
          else 0
        end
      ),
      0
    ) as salary_paid,
    coalesce(
      sum(
        case
          when b.status in ('unpaid', 'partial') or b.id is null then coalesce(ar.total_pay, 0)
          else 0
        end
      ),
      0
    ) as salary_outstanding
  from public.attendance_records ar
  left join public.bills b
    on b.id = ar.salary_bill_id
   and b.deleted_at is null
   and b.bill_type = 'gaji'
  where ar.deleted_at is null
    and ar.project_id is not null
    and ar.billing_status in ('billed', 'paid')
  group by ar.project_id, coalesce(ar.team_id, b.team_id)
)
select
  pb.project_id,
  pb.team_id,
  pb.project_name,
  pb.project_status,
  coalesce(it.total_income, 0) as total_income,
  coalesce(me.material_expense, 0) as material_expense,
  coalesce(oe.operating_expense, 0) as operating_expense,
  coalesce(sb.salary_expense, 0) as salary_expense,
  (
    coalesce(it.total_income, 0)
    - coalesce(me.material_expense, 0)
    - coalesce(oe.operating_expense, 0)
  ) as gross_profit,
  (
    coalesce(it.total_income, 0)
    - coalesce(me.material_expense, 0)
    - coalesce(oe.operating_expense, 0)
    - coalesce(sb.salary_expense, 0)
  ) as net_profit,
  coalesce(sb.salary_paid, 0) as salary_paid_expense,
  coalesce(sb.salary_outstanding, 0) as salary_outstanding_expense
from project_base pb
left join income_totals it
  on it.project_id = pb.project_id
 and it.team_id = pb.team_id
left join material_expense_totals me
  on me.project_id = pb.project_id
 and me.team_id = pb.team_id
left join operating_expense_totals oe
  on oe.project_id = pb.project_id
 and oe.team_id = pb.team_id
left join salary_breakdown sb
  on sb.project_id = pb.project_id
 and sb.team_id = pb.team_id;

alter table public.teams enable row level security;
alter table public.transactions enable row level security;
alter table public.file_assets enable row level security;
alter table public.pdf_settings enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.hrd_applicants enable row level security;
alter table public.hrd_applicant_documents enable row level security;

drop policy if exists teams_select_member on public.teams;
create policy teams_select_member
on public.teams
for select
to authenticated
using (app_private.can_access_team(id));

drop policy if exists teams_update_owner_admin on public.teams;
create policy teams_update_owner_admin
on public.teams
for update
to authenticated
using (app_private.has_team_role(id, array['Owner','Admin']))
with check (app_private.has_team_role(id, array['Owner','Admin']));

drop policy if exists transactions_select_team on public.transactions;
create policy transactions_select_team
on public.transactions
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists transactions_insert_team on public.transactions;
create policy transactions_insert_team
on public.transactions
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists transactions_update_team on public.transactions;
create policy transactions_update_team
on public.transactions
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists file_assets_select_team on public.file_assets;
create policy file_assets_select_team
on public.file_assets
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists file_assets_insert_team on public.file_assets;
create policy file_assets_insert_team
on public.file_assets
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists file_assets_update_team on public.file_assets;
create policy file_assets_update_team
on public.file_assets
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists pdf_settings_select_team on public.pdf_settings;
create policy pdf_settings_select_team
on public.pdf_settings
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists pdf_settings_insert_team on public.pdf_settings;
create policy pdf_settings_insert_team
on public.pdf_settings
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists pdf_settings_update_team on public.pdf_settings;
create policy pdf_settings_update_team
on public.pdf_settings
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists beneficiaries_select_team on public.beneficiaries;
create policy beneficiaries_select_team
on public.beneficiaries
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists beneficiaries_insert_team on public.beneficiaries;
create policy beneficiaries_insert_team
on public.beneficiaries
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists beneficiaries_update_team on public.beneficiaries;
create policy beneficiaries_update_team
on public.beneficiaries
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists hrd_applicants_select_team on public.hrd_applicants;
create policy hrd_applicants_select_team
on public.hrd_applicants
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists hrd_applicants_insert_team on public.hrd_applicants;
create policy hrd_applicants_insert_team
on public.hrd_applicants
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists hrd_applicants_update_team on public.hrd_applicants;
create policy hrd_applicants_update_team
on public.hrd_applicants
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists hrd_applicant_documents_select_team on public.hrd_applicant_documents;
create policy hrd_applicant_documents_select_team
on public.hrd_applicant_documents
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists hrd_applicant_documents_insert_team on public.hrd_applicant_documents;
create policy hrd_applicant_documents_insert_team
on public.hrd_applicant_documents
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists hrd_applicant_documents_update_team on public.hrd_applicant_documents;
create policy hrd_applicant_documents_update_team
on public.hrd_applicant_documents
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop trigger if exists set_updated_at_pdf_settings on public.pdf_settings;
create trigger set_updated_at_pdf_settings
before update on public.pdf_settings
for each row
execute function app_private.set_updated_at();

drop trigger if exists set_updated_at_beneficiaries on public.beneficiaries;
create trigger set_updated_at_beneficiaries
before update on public.beneficiaries
for each row
execute function app_private.set_updated_at();

drop trigger if exists set_updated_at_hrd_applicants on public.hrd_applicants;
create trigger set_updated_at_hrd_applicants
before update on public.hrd_applicants
for each row
execute function app_private.set_updated_at();

drop trigger if exists set_updated_at_hrd_applicant_documents on public.hrd_applicant_documents;
create trigger set_updated_at_hrd_applicant_documents
before update on public.hrd_applicant_documents
for each row
execute function app_private.set_updated_at();

drop trigger if exists set_updated_at_file_assets on public.file_assets;
create trigger set_updated_at_file_assets
before update on public.file_assets
for each row
execute function app_private.set_updated_at();

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  begin
    execute 'drop policy if exists "hrd_documents_select" on storage.objects';
    execute $policy$
      create policy "hrd_documents_select"
      on storage.objects
      for select
      to authenticated, anon
      using (bucket_id = 'hrd_documents')
    $policy$;
    execute 'drop policy if exists "hrd_documents_insert" on storage.objects';
    execute $policy$
      create policy "hrd_documents_insert"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'hrd_documents')
    $policy$;
    execute 'drop policy if exists "hrd_documents_update" on storage.objects';
    execute $policy$
      create policy "hrd_documents_update"
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'hrd_documents')
      with check (bucket_id = 'hrd_documents')
    $policy$;
    execute 'drop policy if exists "hrd_documents_delete" on storage.objects';
    execute $policy$
      create policy "hrd_documents_delete"
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'hrd_documents')
    $policy$;
  exception
    when insufficient_privilege then
      raise notice 'Skipping storage.objects policy refresh in 20260411235900 due to ownership mismatch.';
  end;
end
$$;

grant select, insert, update on public.pdf_settings to authenticated;
grant select, insert, update on public.beneficiaries to authenticated;
grant select, insert, update on public.hrd_applicants to authenticated;
grant select, insert, update on public.hrd_applicant_documents to authenticated;
grant select, insert, update on public.file_assets to authenticated;

grant select on public.vw_billing_stats to authenticated;
grant select on public.vw_project_financial_summary to authenticated;
