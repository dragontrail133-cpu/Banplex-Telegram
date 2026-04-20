begin;

alter table public.projects drop constraint if exists projects_name_key;
alter table public.suppliers drop constraint if exists suppliers_name_key;
alter table public.expense_categories drop constraint if exists expense_categories_name_key;
alter table public.funding_creditors drop constraint if exists funding_creditors_name_key;
alter table public.materials drop constraint if exists materials_name_key;
alter table public.workers drop constraint if exists workers_name_key;

alter table public.projects
  add column if not exists project_name text generated always as (name) stored,
  add column if not exists project_type text,
  add column if not exists budget numeric(16,2),
  add column if not exists is_wage_assignable boolean not null default false,
  add column if not exists status text not null default 'active',
  add column if not exists notes text;

alter table public.projects
  alter column team_id set not null;

create unique index if not exists projects_team_project_name_key
  on public.projects(team_id, project_name);

alter table public.suppliers
  add column if not exists supplier_name text generated always as (name) stored,
  add column if not exists supplier_type text,
  add column if not exists notes text;

update public.suppliers
set supplier_type = case
  when lower(coalesce(supplier_type, '')) in ('material', 'operasional', 'lainnya') then supplier_type
  else 'Material'
end
where supplier_type is distinct from case
  when lower(coalesce(supplier_type, '')) in ('material', 'operasional', 'lainnya') then supplier_type
  else 'Material'
end;

alter table public.suppliers
  alter column supplier_type set default 'Material',
  alter column supplier_type set not null,
  alter column team_id set not null;

alter table public.suppliers
  drop constraint if exists suppliers_supplier_type_check;

alter table public.suppliers
  add constraint suppliers_supplier_type_check
  check (supplier_type in ('Material', 'Operasional', 'Lainnya'));

create unique index if not exists suppliers_team_supplier_name_type_key
  on public.suppliers(team_id, supplier_name, supplier_type);

alter table public.expense_categories
  add column if not exists category_group text,
  add column if not exists notes text;

update public.expense_categories
set category_group = case
  when lower(coalesce(name, '')) like '%material%' then 'material'
  when lower(coalesce(name, '')) in ('lainnya', 'lain lain', 'lain-lain', 'other') then 'other'
  else 'operational'
end
where category_group is null
   or category_group not in ('operational', 'material', 'other');

alter table public.expense_categories
  alter column category_group set default 'operational',
  alter column category_group set not null,
  alter column team_id set not null;

alter table public.expense_categories
  drop constraint if exists expense_categories_category_group_check;

alter table public.expense_categories
  add constraint expense_categories_category_group_check
  check (category_group in ('operational', 'material', 'other'));

create unique index if not exists expense_categories_team_group_name_key
  on public.expense_categories(team_id, category_group, name);

alter table public.funding_creditors
  add column if not exists creditor_name text generated always as (name) stored,
  add column if not exists notes text;

alter table public.funding_creditors
  alter column team_id set not null;

create unique index if not exists funding_creditors_team_creditor_name_key
  on public.funding_creditors(team_id, creditor_name);

create table if not exists public.professions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  profession_name text not null,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists professions_team_profession_name_key
  on public.professions(team_id, profession_name);

alter table public.workers
  add column if not exists worker_name text generated always as (name) stored,
  add column if not exists profession_id uuid references public.professions(id) on delete set null,
  add column if not exists status text not null default 'active',
  add column if not exists default_project_id uuid references public.projects(id) on delete set null,
  add column if not exists default_role_name text,
  add column if not exists notes text;

alter table public.workers
  alter column team_id set not null;

create unique index if not exists workers_team_worker_name_key
  on public.workers(team_id, worker_name);

create table if not exists public.worker_wage_rates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  role_name text not null,
  wage_amount numeric(16,2) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists worker_wage_rates_worker_project_role_key
  on public.worker_wage_rates(worker_id, project_id, role_name);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  staff_name text not null,
  payment_type text not null,
  salary numeric(16,2),
  fee_percentage numeric(8,4),
  fee_amount numeric(16,2),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.staff
  drop constraint if exists staff_payment_type_check;

alter table public.staff
  add constraint staff_payment_type_check
  check (payment_type in ('monthly', 'per_termin', 'fixed_per_termin'));

create unique index if not exists staff_team_staff_name_key
  on public.staff(team_id, staff_name);

alter table public.materials
  add column if not exists material_name text generated always as (name) stored,
  add column if not exists category_id uuid references public.expense_categories(id) on delete set null,
  add column if not exists usage_count integer not null default 0,
  add column if not exists reorder_point numeric(14,3) not null default 0,
  add column if not exists notes text;

alter table public.materials
  alter column team_id set not null;

create unique index if not exists materials_team_material_name_key
  on public.materials(team_id, material_name);

create table if not exists public.file_assets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  storage_bucket text not null,
  bucket_name text,
  storage_path text not null,
  public_url text,
  mime_type text,
  original_name text,
  file_name text,
  size_bytes bigint,
  file_size bigint,
  uploaded_by_user_id uuid references public.profiles(id) on delete set null,
  uploaded_by text,
  created_at timestamptz not null default now()
);

alter table public.file_assets
  add column if not exists team_id uuid references public.teams(id) on delete cascade,
  add column if not exists storage_bucket text,
  add column if not exists bucket_name text,
  add column if not exists public_url text,
  add column if not exists original_name text,
  add column if not exists size_bytes bigint,
  add column if not exists uploaded_by_user_id uuid references public.profiles(id) on delete set null;

update public.file_assets
set storage_bucket = coalesce(
  nullif(btrim(storage_bucket), ''),
  nullif(btrim(bucket_name), ''),
  'hrd_documents'
)
where storage_bucket is null
   or btrim(storage_bucket) = '';

alter table public.file_assets
  alter column storage_bucket set not null;

create unique index if not exists file_assets_storage_bucket_path_key
  on public.file_assets(storage_bucket, storage_path);

create or replace function public.fn_sync_file_assets_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_telegram_user_id text;
begin
  if new.storage_bucket is null then
    new.storage_bucket := nullif(btrim(new.bucket_name), '');
  end if;

  if new.bucket_name is null then
    new.bucket_name := new.storage_bucket;
  end if;

  if new.original_name is null then
    new.original_name := nullif(btrim(new.file_name), '');
  end if;

  if new.file_name is null then
    new.file_name := new.original_name;
  end if;

  if new.size_bytes is null then
    new.size_bytes := new.file_size;
  end if;

  if new.file_size is null then
    new.file_size := new.size_bytes;
  end if;

  if new.uploaded_by_user_id is null and nullif(btrim(new.uploaded_by), '') is not null then
    select p.id
    into v_profile_id
    from public.profiles p
    where p.telegram_user_id = new.uploaded_by
    limit 1;

    new.uploaded_by_user_id := v_profile_id;
  end if;

  if new.uploaded_by is null and new.uploaded_by_user_id is not null then
    select p.telegram_user_id
    into v_telegram_user_id
    from public.profiles p
    where p.id = new.uploaded_by_user_id
    limit 1;

    new.uploaded_by := v_telegram_user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_file_assets_columns on public.file_assets;
create trigger trg_sync_file_assets_columns
before insert or update on public.file_assets
for each row
execute function public.fn_sync_file_assets_columns();

alter table public.project_incomes
  add column if not exists notes text,
  add column if not exists created_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists project_name_snapshot text;

update public.project_incomes pi
set project_name_snapshot = p.project_name
from public.projects p
where p.id = pi.project_id
  and pi.project_name_snapshot is null;

alter table public.project_incomes
  alter column team_id set not null;

alter table public.loans
  add column if not exists paid_amount numeric(16,2) not null default 0,
  add column if not exists interest_rate numeric(8,4),
  add column if not exists tenor_months integer,
  add column if not exists notes text,
  add column if not exists created_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists creditor_name_snapshot text;

update public.loans l
set interest_type = case
  when lower(coalesce(l.interest_type, '')) in ('none', 'no_interest') then 'none'
  when lower(coalesce(l.interest_type, '')) = 'interest' then 'interest'
  else 'none'
end
where lower(coalesce(l.interest_type, '')) not in ('none', 'interest')
   or l.interest_type is null;

update public.loans l
set creditor_name_snapshot = fc.creditor_name
from public.funding_creditors fc
where fc.id = l.creditor_id
  and l.creditor_name_snapshot is null;

alter table public.loans
  alter column interest_type set default 'none',
  alter column interest_type set not null,
  alter column team_id set not null;

alter table public.loans
  drop constraint if exists loans_interest_type_check;

alter table public.loans
  add constraint loans_interest_type_check
  check (interest_type in ('none', 'interest'));

alter table public.loans
  drop constraint if exists loans_status_check;

alter table public.loans
  add constraint loans_status_check
  check (status in ('unpaid', 'paid', 'partial', 'cancelled'));

alter table public.expenses
  add column if not exists category_id uuid references public.expense_categories(id) on delete set null,
  add column if not exists document_type text,
  add column if not exists notes text,
  add column if not exists created_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists project_name_snapshot text,
  add column if not exists supplier_name_snapshot text;

update public.expenses
set expense_type = case
  when lower(coalesce(expense_type, '')) in ('material', 'material_invoice', 'expense') then 'material'
  when lower(coalesce(expense_type, '')) in ('operasional', 'lainnya') then lower(expense_type)
  else 'material'
end;

update public.expenses
set document_type = case
  when lower(coalesce(document_type, '')) = 'surat_jalan' then 'surat_jalan'
  else 'faktur'
end
where document_type is null
   or document_type not in ('faktur', 'surat_jalan');

update public.expenses
set status = case
  when document_type = 'surat_jalan' then 'delivery_order'
  when lower(coalesce(status, '')) = 'paid' then 'paid'
  when lower(coalesce(status, '')) = 'cancelled' then 'cancelled'
  else 'unpaid'
end
where status is null
   or status not in ('unpaid', 'paid', 'delivery_order', 'cancelled');

update public.expenses e
set project_name_snapshot = p.project_name
from public.projects p
where p.id = e.project_id
  and e.project_name_snapshot is null;

update public.expenses e
set supplier_name_snapshot = coalesce(s.supplier_name, e.supplier_name)
from public.suppliers s
where s.id = e.supplier_id
  and e.supplier_name_snapshot is null;

update public.expenses
set supplier_name_snapshot = supplier_name
where supplier_name_snapshot is null
  and nullif(btrim(supplier_name), '') is not null;

alter table public.expenses
  alter column expense_type set default 'material',
  alter column expense_type set not null,
  alter column document_type set default 'faktur',
  alter column document_type set not null,
  alter column status set default 'unpaid',
  alter column status set not null,
  alter column team_id set not null;

alter table public.expenses
  drop constraint if exists expenses_expense_type_check;

alter table public.expenses
  add constraint expenses_expense_type_check
  check (expense_type in ('material', 'operasional', 'lainnya'));

alter table public.expenses
  drop constraint if exists expenses_document_type_check;

alter table public.expenses
  add constraint expenses_document_type_check
  check (document_type in ('faktur', 'surat_jalan'));

alter table public.expenses
  drop constraint if exists expenses_status_check;

alter table public.expenses
  add constraint expenses_status_check
  check (status in ('unpaid', 'paid', 'delivery_order', 'cancelled'));

alter table public.expense_line_items
  add column if not exists sort_order integer not null default 1;

alter table public.expense_line_items
  alter column unit_price set default 0,
  alter column line_total set default 0;

create table if not exists public.expense_attachments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  file_asset_id uuid not null references public.file_assets(id) on delete cascade,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create unique index if not exists expense_attachments_expense_file_key
  on public.expense_attachments(expense_id, file_asset_id);

alter table public.bills
  add column if not exists staff_id uuid references public.staff(id) on delete set null,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists supplier_name_snapshot text;

update public.bills
set bill_type = case
  when lower(coalesce(bill_type, '')) in ('material', 'material_invoice', 'expense') then 'material'
  when lower(coalesce(bill_type, '')) in ('operasional', 'lainnya', 'gaji', 'fee') then lower(bill_type)
  else 'material'
end
where bill_type is null
   or lower(coalesce(bill_type, '')) not in ('material', 'operasional', 'lainnya', 'gaji', 'fee');

update public.bills b
set supplier_name_snapshot = s.supplier_name
from public.suppliers s
where s.id = b.supplier_id
  and b.supplier_name_snapshot is null;

alter table public.bills
  alter column team_id set not null,
  alter column bill_type set not null;

alter table public.bills
  drop constraint if exists bills_bill_type_check;

alter table public.bills
  add constraint bills_bill_type_check
  check (bill_type in ('material', 'operasional', 'lainnya', 'gaji', 'fee'));

alter table public.bills
  drop constraint if exists bills_status_check;

alter table public.bills
  add constraint bills_status_check
  check (status in ('unpaid', 'partial', 'paid', 'cancelled'));

create or replace function public.fn_auto_create_bill_from_expense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill_id uuid;
  v_bill_amount numeric := coalesce(new.amount, new.total_amount, 0);
  v_expense_status text := coalesce(new.status, 'unpaid');
  v_payment_notes text := coalesce(
    new.description,
    'Pembayaran cash otomatis dari faktur material'
  );
begin
  if coalesce(new.document_type, 'faktur') = 'surat_jalan'
     or v_expense_status = 'delivery_order' then
    return new;
  end if;

  insert into public.bills (
    expense_id,
    telegram_user_id,
    team_id,
    project_id,
    supplier_id,
    bill_type,
    description,
    amount,
    due_date,
    status,
    paid_amount,
    paid_at,
    supplier_name_snapshot
  )
  values (
    new.id,
    new.telegram_user_id,
    new.team_id,
    new.project_id,
    new.supplier_id,
    new.expense_type,
    new.description,
    v_bill_amount,
    new.expense_date,
    case when v_expense_status = 'paid' then 'paid' else 'unpaid' end,
    case when v_expense_status = 'paid' then v_bill_amount else 0 end,
    case when v_expense_status = 'paid' then now() else null end,
    new.supplier_name_snapshot
  )
  on conflict (expense_id) do update
    set
      bill_type = excluded.bill_type,
      description = excluded.description,
      amount = excluded.amount,
      due_date = excluded.due_date,
      status = excluded.status,
      paid_amount = excluded.paid_amount,
      paid_at = excluded.paid_at,
      supplier_name_snapshot = excluded.supplier_name_snapshot
  returning id into v_bill_id;

  if v_expense_status = 'paid' then
    insert into public.bill_payments (
      bill_id,
      telegram_user_id,
      team_id,
      amount,
      payment_date,
      notes
    )
    select
      v_bill_id,
      new.telegram_user_id,
      new.team_id,
      v_bill_amount,
      coalesce(new.expense_date, current_date),
      v_payment_notes
    where not exists (
      select 1
      from public.bill_payments bp
      where bp.bill_id = v_bill_id
        and bp.payment_date = coalesce(new.expense_date, current_date)
        and bp.amount = v_bill_amount
        and coalesce(bp.notes, '') = coalesce(v_payment_notes, '')
    );
  end if;

  return new;
end;
$$;

create or replace function public.fn_auto_update_stock_from_line_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_type text;
  v_document_type text;
  v_transaction_date date;
  v_source_type text;
  v_inserted_rows integer := 0;
begin
  select e.expense_type, e.document_type, e.expense_date
  into v_expense_type, v_document_type, v_transaction_date
  from public.expenses e
  where e.id = new.expense_id;

  if coalesce(v_expense_type, '') <> 'material' then
    return new;
  end if;

  v_source_type := case
    when coalesce(v_document_type, 'faktur') = 'surat_jalan' then 'delivery_order'
    else 'invoice'
  end;

  insert into public.stock_transactions (
    material_id,
    expense_id,
    expense_line_item_id,
    quantity,
    direction,
    source_type,
    transaction_date
  )
  values (
    new.material_id,
    new.expense_id,
    new.id,
    new.qty,
    'in',
    v_source_type,
    coalesce(v_transaction_date, current_date)
  )
  on conflict (expense_line_item_id) do nothing;

  get diagnostics v_inserted_rows = row_count;

  if v_inserted_rows > 0 then
    update public.materials
    set current_stock = coalesce(current_stock, 0) + coalesce(new.qty, 0)
    where id = new.material_id;
  end if;

  return new;
end;
$$;

alter table public.professions enable row level security;
alter table public.staff enable row level security;
alter table public.worker_wage_rates enable row level security;
alter table public.file_assets enable row level security;
alter table public.expense_attachments enable row level security;

drop policy if exists projects_insert_team on public.projects;
create policy projects_insert_team
on public.projects
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists projects_update_team on public.projects;
create policy projects_update_team
on public.projects
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists expense_categories_insert_team on public.expense_categories;
create policy expense_categories_insert_team
on public.expense_categories
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists expense_categories_update_team on public.expense_categories;
create policy expense_categories_update_team
on public.expense_categories
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists professions_select_team on public.professions;
create policy professions_select_team
on public.professions
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists professions_insert_team on public.professions;
create policy professions_insert_team
on public.professions
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists professions_update_team on public.professions;
create policy professions_update_team
on public.professions
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists staff_select_team on public.staff;
create policy staff_select_team
on public.staff
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists staff_insert_team on public.staff;
create policy staff_insert_team
on public.staff
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists staff_update_team on public.staff;
create policy staff_update_team
on public.staff
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists worker_wage_rates_select_team on public.worker_wage_rates;
create policy worker_wage_rates_select_team
on public.worker_wage_rates
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists worker_wage_rates_insert_team on public.worker_wage_rates;
create policy worker_wage_rates_insert_team
on public.worker_wage_rates
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists worker_wage_rates_update_team on public.worker_wage_rates;
create policy worker_wage_rates_update_team
on public.worker_wage_rates
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

drop policy if exists expense_attachments_select_team on public.expense_attachments;
create policy expense_attachments_select_team
on public.expense_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_attachments.expense_id
      and app_private.can_access_team(e.team_id)
  )
);

drop policy if exists expense_attachments_insert_team on public.expense_attachments;
create policy expense_attachments_insert_team
on public.expense_attachments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_attachments.expense_id
      and app_private.can_access_team(e.team_id)
  )
);

drop policy if exists expense_attachments_update_team on public.expense_attachments;
create policy expense_attachments_update_team
on public.expense_attachments
for update
to authenticated
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_attachments.expense_id
      and app_private.can_access_team(e.team_id)
  )
)
with check (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_attachments.expense_id
      and app_private.can_access_team(e.team_id)
  )
);

create index if not exists idx_staff_team_name on public.staff(team_id, staff_name);
create index if not exists idx_professions_team_name on public.professions(team_id, profession_name);
create index if not exists idx_worker_wage_rates_team_worker on public.worker_wage_rates(team_id, worker_id);
create index if not exists idx_worker_wage_rates_team_project on public.worker_wage_rates(team_id, project_id);
create index if not exists idx_expenses_category_id on public.expenses(category_id);
create index if not exists idx_expenses_document_type on public.expenses(document_type);
create index if not exists idx_project_incomes_project_id_date on public.project_incomes(project_id, transaction_date);
create index if not exists idx_loans_creditor_id_date on public.loans(creditor_id, transaction_date);
create index if not exists idx_expense_attachments_expense_id on public.expense_attachments(expense_id);
create index if not exists idx_file_assets_team_created_at on public.file_assets(team_id, created_at desc);

commit;
