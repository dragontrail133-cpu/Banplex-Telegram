create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  telegram_user_id text not null,
  role text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  constraint team_members_role_check
    check (role in ('Owner', 'Admin', 'Logistik', 'Payroll', 'Administrasi', 'Viewer')),
  constraint team_members_team_id_telegram_user_id_key
    unique (team_id, telegram_user_id)
);

alter table public.projects
  add column if not exists team_id uuid references public.teams(id);

alter table public.suppliers
  add column if not exists team_id uuid references public.teams(id);

alter table public.expense_categories
  add column if not exists team_id uuid references public.teams(id);

alter table public.funding_creditors
  add column if not exists team_id uuid references public.teams(id);

alter table public.transactions
  add column if not exists team_id uuid references public.teams(id);

do $$
declare
  v_default_team_id uuid;
  v_profile_role_expr text;
begin
  insert into public.teams (name, slug, is_active)
  values ('Default Workspace', 'default-workspace', true)
  on conflict (slug) do update
    set name = excluded.name,
        is_active = excluded.is_active
  returning id into v_default_team_id;

  if v_default_team_id is null then
    select id
    into v_default_team_id
    from public.teams
    where slug = 'default-workspace'
    limit 1;
  end if;

  update public.projects
  set team_id = v_default_team_id
  where team_id is null;

  update public.suppliers
  set team_id = v_default_team_id
  where team_id is null;

  update public.expense_categories
  set team_id = v_default_team_id
  where team_id is null;

  update public.funding_creditors
  set team_id = v_default_team_id
  where team_id is null;

  update public.transactions
  set team_id = v_default_team_id
  where team_id is null;

  update public.materials
  set team_id = v_default_team_id
  where team_id is null;

  update public.workers
  set team_id = v_default_team_id
  where team_id is null;

  update public.expenses
  set team_id = v_default_team_id
  where team_id is null;

  update public.bills
  set team_id = coalesce(public.bills.team_id, public.expenses.team_id, v_default_team_id)
  from public.expenses
  where public.expenses.id = public.bills.expense_id
    and public.bills.team_id is null;

  update public.project_incomes
  set team_id = v_default_team_id
  where team_id is null;

  update public.loans
  set team_id = v_default_team_id
  where team_id is null;

  update public.attendance_records
  set team_id = v_default_team_id
  where team_id is null;

  update public.bill_payments
  set team_id = coalesce(public.bill_payments.team_id, public.bills.team_id, v_default_team_id)
  from public.bills
  where public.bills.id = public.bill_payments.bill_id
    and public.bill_payments.team_id is null;

  update public.loan_payments
  set team_id = coalesce(public.loan_payments.team_id, public.loans.team_id, v_default_team_id)
  from public.loans
  where public.loans.id = public.loan_payments.loan_id
    and public.loan_payments.team_id is null;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ) then
    v_profile_role_expr := $sql$
      case
        when p.role in ('Owner', 'Admin', 'Logistik', 'Payroll', 'Administrasi', 'Viewer')
          then p.role
        else 'Viewer'
      end
    $sql$;
  else
    v_profile_role_expr := '''Viewer''';
  end if;

  execute format(
    $sql$
      insert into public.team_members (team_id, telegram_user_id, role, is_default)
      select
        %L::uuid,
        p.telegram_user_id,
        %s,
        true
      from public.profiles p
      where p.telegram_user_id is not null
      on conflict (team_id, telegram_user_id) do update
        set role = excluded.role,
            is_default = excluded.is_default
    $sql$,
    v_default_team_id,
    v_profile_role_expr
  );
end $$;

create schema if not exists app_private;

create or replace function app_private.current_telegram_user_id()
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select p.telegram_user_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function app_private.can_access_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.telegram_user_id = app_private.current_telegram_user_id()
  )
$$;

grant usage on schema app_private to authenticated;
grant execute on function app_private.current_telegram_user_id() to authenticated;
grant execute on function app_private.can_access_team(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.projects enable row level security;
alter table public.expense_categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.materials enable row level security;
alter table public.funding_creditors enable row level security;
alter table public.workers enable row level security;
alter table public.transactions enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_line_items enable row level security;
alter table public.bills enable row level security;
alter table public.bill_payments enable row level security;
alter table public.project_incomes enable row level security;
alter table public.loans enable row level security;
alter table public.loan_payments enable row level security;
alter table public.attendance_records enable row level security;
alter table public.stock_transactions enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists teams_select_member on public.teams;
create policy teams_select_member
on public.teams
for select
to authenticated
using (app_private.can_access_team(id));

drop policy if exists team_members_select_own on public.team_members;
create policy team_members_select_own
on public.team_members
for select
to authenticated
using (telegram_user_id = app_private.current_telegram_user_id());

drop policy if exists projects_select_team on public.projects;
create policy projects_select_team
on public.projects
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists expense_categories_select_team on public.expense_categories;
create policy expense_categories_select_team
on public.expense_categories
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists suppliers_select_team on public.suppliers;
create policy suppliers_select_team
on public.suppliers
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists suppliers_insert_team on public.suppliers;
create policy suppliers_insert_team
on public.suppliers
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists suppliers_update_team on public.suppliers;
create policy suppliers_update_team
on public.suppliers
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists materials_select_team on public.materials;
create policy materials_select_team
on public.materials
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists materials_insert_team on public.materials;
create policy materials_insert_team
on public.materials
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists materials_update_team on public.materials;
create policy materials_update_team
on public.materials
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists funding_creditors_select_team on public.funding_creditors;
create policy funding_creditors_select_team
on public.funding_creditors
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists funding_creditors_insert_team on public.funding_creditors;
create policy funding_creditors_insert_team
on public.funding_creditors
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists funding_creditors_update_team on public.funding_creditors;
create policy funding_creditors_update_team
on public.funding_creditors
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists workers_select_team on public.workers;
create policy workers_select_team
on public.workers
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists workers_insert_team on public.workers;
create policy workers_insert_team
on public.workers
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists workers_update_team on public.workers;
create policy workers_update_team
on public.workers
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

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

drop policy if exists expenses_select_team on public.expenses;
create policy expenses_select_team
on public.expenses
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists expenses_insert_team on public.expenses;
create policy expenses_insert_team
on public.expenses
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists expenses_update_team on public.expenses;
create policy expenses_update_team
on public.expenses
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists expense_line_items_select_team on public.expense_line_items;
create policy expense_line_items_select_team
on public.expense_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_line_items.expense_id
      and app_private.can_access_team(e.team_id)
  )
);

drop policy if exists expense_line_items_insert_team on public.expense_line_items;
create policy expense_line_items_insert_team
on public.expense_line_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_line_items.expense_id
      and app_private.can_access_team(e.team_id)
  )
);

drop policy if exists expense_line_items_update_team on public.expense_line_items;
create policy expense_line_items_update_team
on public.expense_line_items
for update
to authenticated
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_line_items.expense_id
      and app_private.can_access_team(e.team_id)
  )
)
with check (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_line_items.expense_id
      and app_private.can_access_team(e.team_id)
  )
);

drop policy if exists bills_select_team on public.bills;
create policy bills_select_team
on public.bills
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists bills_insert_team on public.bills;
create policy bills_insert_team
on public.bills
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists bills_update_team on public.bills;
create policy bills_update_team
on public.bills
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists bill_payments_select_team on public.bill_payments;
create policy bill_payments_select_team
on public.bill_payments
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists bill_payments_insert_team on public.bill_payments;
create policy bill_payments_insert_team
on public.bill_payments
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists bill_payments_update_team on public.bill_payments;
create policy bill_payments_update_team
on public.bill_payments
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists project_incomes_select_team on public.project_incomes;
create policy project_incomes_select_team
on public.project_incomes
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists project_incomes_insert_team on public.project_incomes;
create policy project_incomes_insert_team
on public.project_incomes
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists project_incomes_update_team on public.project_incomes;
create policy project_incomes_update_team
on public.project_incomes
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists loans_select_team on public.loans;
create policy loans_select_team
on public.loans
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists loans_insert_team on public.loans;
create policy loans_insert_team
on public.loans
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists loans_update_team on public.loans;
create policy loans_update_team
on public.loans
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists loan_payments_select_team on public.loan_payments;
create policy loan_payments_select_team
on public.loan_payments
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists loan_payments_insert_team on public.loan_payments;
create policy loan_payments_insert_team
on public.loan_payments
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists loan_payments_update_team on public.loan_payments;
create policy loan_payments_update_team
on public.loan_payments
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists attendance_records_select_team on public.attendance_records;
create policy attendance_records_select_team
on public.attendance_records
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists attendance_records_insert_team on public.attendance_records;
create policy attendance_records_insert_team
on public.attendance_records
for insert
to authenticated
with check (app_private.can_access_team(team_id));

drop policy if exists attendance_records_update_team on public.attendance_records;
create policy attendance_records_update_team
on public.attendance_records
for update
to authenticated
using (app_private.can_access_team(team_id))
with check (app_private.can_access_team(team_id));

drop policy if exists stock_transactions_select_team on public.stock_transactions;
create policy stock_transactions_select_team
on public.stock_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.materials m
    where m.id = stock_transactions.material_id
      and app_private.can_access_team(m.team_id)
  )
);

create or replace view public.vw_cash_mutation
with (security_invoker = true)
as
  select
    bp.payment_date as transaction_date,
    'expense'::text as type,
    bp.amount,
    coalesce(bp.notes, b.description, 'Pembayaran tagihan'::text) as description,
    'bill_payments'::text as source_table,
    coalesce(bp.team_id, b.team_id) as team_id,
    coalesce(bp.telegram_user_id, b.telegram_user_id) as telegram_user_id
  from public.bill_payments bp
  left join public.bills b on b.id = bp.bill_id
  union all
  select
    lp.payment_date as transaction_date,
    'expense'::text as type,
    lp.amount,
    coalesce(lp.notes, l.description, 'Pembayaran pinjaman'::text) as description,
    'loan_payments'::text as source_table,
    coalesce(lp.team_id, l.team_id) as team_id,
    coalesce(lp.telegram_user_id, l.telegram_user_id) as telegram_user_id
  from public.loan_payments lp
  left join public.loans l on l.id = lp.loan_id
  union all
  select
    coalesce(pi.transaction_date, pi.income_date) as transaction_date,
    'income'::text as type,
    pi.amount,
    coalesce(pi.description, 'Pemasukan proyek'::text) as description,
    'project_incomes'::text as source_table,
    pi.team_id,
    pi.telegram_user_id
  from public.project_incomes pi
  union all
  select
    coalesce(l.transaction_date, l.disbursed_date) as transaction_date,
    'income'::text as type,
    coalesce(l.principal_amount, l.amount, 0::numeric) as amount,
    coalesce(l.description, 'Pencairan pinjaman'::text) as description,
    'loans'::text as source_table,
    l.team_id,
    l.telegram_user_id
  from public.loans l;

drop view if exists public.vw_transaction_summary;

create view public.vw_transaction_summary
with (security_invoker = true)
as
  with all_cash_flows as (
    select t.team_id, t.type, t.amount
    from public.transactions t
    union all
    select vcm.team_id, vcm.type, vcm.amount
    from public.vw_cash_mutation vcm
  )
  select
    team_id,
    coalesce(sum(case when type = 'income' then amount else 0::numeric end), 0::numeric) as total_income,
    coalesce(sum(case when type = 'expense' then amount else 0::numeric end), 0::numeric) as total_expense,
    coalesce(sum(case when type = 'income' then amount else -amount end), 0::numeric) as ending_balance
  from all_cash_flows
  where team_id is not null
  group by team_id;

create or replace view public.vw_project_financial_summary
with (security_invoker = true)
as
  with income_totals as (
    select
      pi.project_id,
      pi.team_id,
      coalesce(sum(coalesce(pi.amount, 0::numeric)), 0::numeric) as total_income
    from public.project_incomes pi
    where pi.project_id is not null
    group by pi.project_id, pi.team_id
  ),
  material_expense_totals as (
    select
      e.project_id,
      e.team_id,
      coalesce(sum(coalesce(e.total_amount, e.amount, 0::numeric)), 0::numeric) as material_expense
    from public.expenses e
    where e.project_id is not null
      and lower(coalesce(e.expense_type, '')) = any (array['material', 'material_invoice'])
    group by e.project_id, e.team_id
  ),
  operating_expense_totals as (
    select
      e.project_id,
      e.team_id,
      coalesce(sum(coalesce(e.total_amount, e.amount, 0::numeric)), 0::numeric) as operating_expense
    from public.expenses e
    where e.project_id is not null
      and lower(coalesce(e.expense_type, '')) = any (array['operasional', 'lainnya'])
    group by e.project_id, e.team_id
  ),
  salary_expense_totals as (
    select
      ar.project_id,
      coalesce(ar.team_id, b.team_id) as team_id,
      coalesce(sum(coalesce(ar.total_pay, 0::numeric)), 0::numeric) as salary_expense
    from public.attendance_records ar
    join public.bills b
      on b.id = ar.salary_bill_id
     and b.bill_type = 'gaji'
    where ar.project_id is not null
      and ar.billing_status = 'billed'
    group by ar.project_id, coalesce(ar.team_id, b.team_id)
  ),
  summary_keys as (
    select project_id, team_id from income_totals
    union
    select project_id, team_id from material_expense_totals
    union
    select project_id, team_id from operating_expense_totals
    union
    select project_id, team_id from salary_expense_totals
  )
  select
    k.project_id,
    k.team_id,
    p.name as project_name,
    case
      when p.is_active then 'active'::text
      else 'inactive'::text
    end as project_status,
    coalesce(i.total_income, 0::numeric) as total_income,
    coalesce(m.material_expense, 0::numeric) as material_expense,
    coalesce(o.operating_expense, 0::numeric) as operating_expense,
    coalesce(s.salary_expense, 0::numeric) as salary_expense,
    (coalesce(i.total_income, 0::numeric) - coalesce(m.material_expense, 0::numeric) - coalesce(s.salary_expense, 0::numeric)) as gross_profit,
    (coalesce(i.total_income, 0::numeric) - coalesce(m.material_expense, 0::numeric) - coalesce(s.salary_expense, 0::numeric) - coalesce(o.operating_expense, 0::numeric)) as net_profit
  from summary_keys k
  left join public.projects p
    on p.id = k.project_id
  left join income_totals i
    on i.project_id = k.project_id
   and not (i.team_id is distinct from k.team_id)
  left join material_expense_totals m
    on m.project_id = k.project_id
   and not (m.team_id is distinct from k.team_id)
  left join operating_expense_totals o
    on o.project_id = k.project_id
   and not (o.team_id is distinct from k.team_id)
  left join salary_expense_totals s
    on s.project_id = k.project_id
   and not (s.team_id is distinct from k.team_id);
