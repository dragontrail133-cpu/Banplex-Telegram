create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  telegram_user_id text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text,
  type text not null,
  amount numeric not null default 0,
  description text,
  transaction_date date not null default current_date,
  source_table text,
  worker_name_snapshot text,
  supplier_name_snapshot text,
  project_name_snapshot text,
  creditor_name_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text not null,
  project_id uuid not null references public.projects(id),
  supplier_name text not null,
  expense_date date not null,
  total_amount numeric not null default 0,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null unique references public.expenses(id) on delete cascade,
  telegram_user_id text,
  team_id uuid,
  project_id uuid references public.projects(id),
  supplier_id uuid references public.suppliers(id),
  bill_type text,
  description text,
  amount numeric not null default 0,
  due_date date not null,
  status text not null default 'unpaid',
  paid_amount numeric not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.bills
  add column if not exists paid_amount numeric not null default 0,
  add column if not exists paid_at timestamp with time zone;

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid,
  telegram_user_id text,
  amount numeric not null default 0,
  description text,
  disbursed_date date not null default current_date,
  transaction_date date not null default current_date,
  principal_amount numeric not null default 0,
  repayment_amount numeric not null default 0,
  interest_type text not null default 'no_interest',
  status text not null default 'unpaid',
  paid_amount numeric not null default 0,
  interest_rate numeric(8,4),
  tenor_months integer,
  notes text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  creditor_name_snapshot text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  team_id uuid,
  amount numeric not null,
  payment_date date not null,
  notes text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.project_incomes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid,
  project_id uuid references public.projects(id),
  amount numeric not null,
  income_date date not null,
  description text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  telegram_user_id text,
  team_id uuid,
  amount numeric not null,
  payment_date date not null,
  notes text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_bill_payments_bill_id on public.bill_payments(bill_id);
create index if not exists idx_loan_payments_loan_id on public.loan_payments(loan_id);
create index if not exists idx_project_incomes_project_id on public.project_incomes(project_id);

create or replace function public.fn_update_bill_status_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bills
  set
    paid_amount = coalesce(public.bills.paid_amount, 0) + coalesce(new.amount, 0),
    status = case
      when coalesce(public.bills.paid_amount, 0) + coalesce(new.amount, 0) >= coalesce(public.bills.amount, 0)
        and coalesce(public.bills.amount, 0) > 0
        then 'paid'
      when coalesce(public.bills.paid_amount, 0) + coalesce(new.amount, 0) > 0
        then 'partial'
      else 'unpaid'
    end,
    paid_at = case
      when coalesce(public.bills.paid_amount, 0) + coalesce(new.amount, 0) >= coalesce(public.bills.amount, 0)
        and coalesce(public.bills.amount, 0) > 0
        then coalesce(public.bills.paid_at, now())
      else null
    end
  where public.bills.id = new.bill_id;

  return new;
end;
$$;

revoke all on function public.fn_update_bill_status_on_payment() from public, anon, authenticated;

drop trigger if exists trg_after_payment_insert on public.bill_payments;
create trigger trg_after_payment_insert
after insert on public.bill_payments
for each row
execute function public.fn_update_bill_status_on_payment();

create or replace view public.vw_cash_mutation
with (security_invoker = true)
as
  select
    bp.payment_date as transaction_date,
    'out'::text as type,
    bp.amount,
    coalesce(bp.notes, b.description, 'Pembayaran tagihan') as description,
    'bill_payments'::text as source_table,
    coalesce(bp.team_id, b.team_id) as team_id
  from public.bill_payments bp
  left join public.bills b on b.id = bp.bill_id

  union all

  select
    lp.payment_date as transaction_date,
    'out'::text as type,
    lp.amount,
    coalesce(lp.notes, l.description, 'Pembayaran pinjaman') as description,
    'loan_payments'::text as source_table,
    coalesce(lp.team_id, l.team_id) as team_id
  from public.loan_payments lp
  left join public.loans l on l.id = lp.loan_id

  union all

  select
    pi.income_date as transaction_date,
    'in'::text as type,
    pi.amount,
    coalesce(pi.description, 'Pemasukan proyek') as description,
    'project_incomes'::text as source_table,
    pi.team_id
  from public.project_incomes pi

  union all

  select
    l.disbursed_date as transaction_date,
    'in'::text as type,
    l.amount,
    coalesce(l.description, 'Pencairan pinjaman') as description,
    'loans'::text as source_table,
    l.team_id
  from public.loans l;

grant select, insert on table public.bill_payments to anon, authenticated;
grant select, insert on table public.loan_payments to anon, authenticated;
grant select, insert on table public.project_incomes to anon, authenticated;
grant select, insert on table public.loans to anon, authenticated;
grant select on table public.vw_cash_mutation to anon, authenticated;
