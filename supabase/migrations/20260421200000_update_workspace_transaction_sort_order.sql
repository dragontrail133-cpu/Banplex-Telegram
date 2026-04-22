create or replace view public.vw_workspace_transactions
with (security_invoker = true)
as
  select
    pi.team_id,
    'project-income'::text as source_type,
    'income'::text as type,
    pi.id,
    greatest(
      coalesce(pi.created_at, '-infinity'::timestamptz),
      coalesce(pi.updated_at, '-infinity'::timestamptz),
      coalesce(pi.transaction_date::timestamptz, '-infinity'::timestamptz),
      coalesce(pi.income_date::timestamptz, '-infinity'::timestamptz),
      coalesce(b.paid_at, '-infinity'::timestamptz)
    ) as sort_at,
    pi.transaction_date,
    pi.income_date,
    null::date as expense_date,
    null::date as due_date,
    pi.created_at,
    pi.updated_at,
    pi.amount,
    pi.description,
    pi.project_name_snapshot,
    null::text as supplier_name_snapshot,
    null::text as creditor_name_snapshot,
    null::text as worker_name_snapshot,
    null::text as expense_type,
    null::text as document_type,
    b.id as bill_id,
    b.bill_type,
    b.status as bill_status,
    b.amount as bill_amount,
    b.paid_amount as bill_paid_amount,
    greatest(coalesce(b.amount, 0::numeric) - coalesce(b.paid_amount, 0::numeric), 0::numeric) as bill_remaining_amount,
    b.due_date as bill_due_date,
    b.paid_at as bill_paid_at,
    b.description as bill_description,
    b.project_name_snapshot as bill_project_name_snapshot,
    b.supplier_name_snapshot as bill_supplier_name_snapshot,
    b.worker_name_snapshot as bill_worker_name_snapshot,
    lower(
      concat_ws(
        ' ',
        coalesce(pi.description, ''),
        coalesce(pi.project_name_snapshot, ''),
        coalesce(b.description, ''),
        coalesce(b.project_name_snapshot, ''),
        coalesce(b.supplier_name_snapshot, ''),
        coalesce(b.worker_name_snapshot, ''),
        coalesce(b.bill_type, ''),
        coalesce(b.status, '')
      )
    ) as search_text
  from public.project_incomes pi
  left join public.bills b
    on b.project_income_id = pi.id
   and b.deleted_at is null
   and b.bill_type <> 'gaji'
  where pi.deleted_at is null

  union all

  select
    e.team_id,
    'expense'::text as source_type,
    'expense'::text as type,
    e.id,
    greatest(
      coalesce(e.created_at, '-infinity'::timestamptz),
      coalesce(e.updated_at, '-infinity'::timestamptz),
      coalesce(e.expense_date::timestamptz, '-infinity'::timestamptz),
      coalesce(b.paid_at, '-infinity'::timestamptz)
    ) as sort_at,
    null::date as transaction_date,
    null::date as income_date,
    e.expense_date,
    null::date as due_date,
    e.created_at,
    e.updated_at,
    e.amount,
    e.description,
    e.project_name_snapshot,
    e.supplier_name_snapshot,
    null::text as creditor_name_snapshot,
    null::text as worker_name_snapshot,
    e.expense_type,
    e.document_type,
    b.id as bill_id,
    b.bill_type,
    b.status as bill_status,
    b.amount as bill_amount,
    b.paid_amount as bill_paid_amount,
    greatest(coalesce(b.amount, 0::numeric) - coalesce(b.paid_amount, 0::numeric), 0::numeric) as bill_remaining_amount,
    b.due_date as bill_due_date,
    b.paid_at as bill_paid_at,
    b.description as bill_description,
    b.project_name_snapshot as bill_project_name_snapshot,
    b.supplier_name_snapshot as bill_supplier_name_snapshot,
    b.worker_name_snapshot as bill_worker_name_snapshot,
    lower(
      concat_ws(
        ' ',
        coalesce(e.description, ''),
        coalesce(e.project_name_snapshot, ''),
        coalesce(e.supplier_name_snapshot, ''),
        coalesce(e.expense_type, ''),
        coalesce(e.document_type, ''),
        coalesce(b.description, ''),
        coalesce(b.project_name_snapshot, ''),
        coalesce(b.supplier_name_snapshot, ''),
        coalesce(b.worker_name_snapshot, ''),
        coalesce(b.bill_type, ''),
        coalesce(b.status, '')
      )
    ) as search_text
  from public.expenses e
  left join public.bills b
    on b.expense_id = e.id
   and b.deleted_at is null
   and b.bill_type <> 'gaji'
  where e.deleted_at is null

  union all

  select
    l.team_id,
    'loan-disbursement'::text as source_type,
    'income'::text as type,
    l.id,
    greatest(
      coalesce(l.created_at, '-infinity'::timestamptz),
      coalesce(l.updated_at, '-infinity'::timestamptz),
      coalesce(l.transaction_date::timestamptz, '-infinity'::timestamptz),
      coalesce(l.disbursed_date::timestamptz, '-infinity'::timestamptz)
    ) as sort_at,
    l.transaction_date,
    null::date as income_date,
    null::date as expense_date,
    null::date as due_date,
    l.created_at,
    l.updated_at,
    coalesce(l.principal_amount, l.amount, 0::numeric) as amount,
    l.description,
    null::text as project_name_snapshot,
    null::text as supplier_name_snapshot,
    l.creditor_name_snapshot,
    null::text as worker_name_snapshot,
    null::text as expense_type,
    null::text as document_type,
    null::uuid as bill_id,
    null::text as bill_type,
    l.status as bill_status,
    l.repayment_amount as bill_amount,
    l.paid_amount as bill_paid_amount,
    greatest(coalesce(l.repayment_amount, 0::numeric) - coalesce(l.paid_amount, 0::numeric), 0::numeric) as bill_remaining_amount,
    null::date as bill_due_date,
    null::timestamptz as bill_paid_at,
    null::text as bill_description,
    null::text as bill_project_name_snapshot,
    null::text as bill_supplier_name_snapshot,
    null::text as bill_worker_name_snapshot,
    lower(
      concat_ws(
        ' ',
        coalesce(l.description, ''),
        coalesce(l.creditor_name_snapshot, ''),
        coalesce(l.status, '')
      )
    ) as search_text
  from public.loans l
  where l.deleted_at is null

  union all

  select
    b.team_id,
    'bill'::text as source_type,
    'expense'::text as type,
    b.id,
    greatest(
      coalesce(b.created_at, '-infinity'::timestamptz),
      coalesce(b.updated_at, '-infinity'::timestamptz),
      coalesce(b.due_date::timestamptz, '-infinity'::timestamptz),
      coalesce(b.paid_at, '-infinity'::timestamptz)
    ) as sort_at,
    null::date as transaction_date,
    null::date as income_date,
    null::date as expense_date,
    b.due_date,
    b.created_at,
    b.updated_at,
    b.amount,
    case
      when b.bill_type = 'gaji' then 'Tagihan Upah'
      else b.description
    end as description,
    b.project_name_snapshot,
    b.supplier_name_snapshot,
    b.worker_name_snapshot,
    null::text as creditor_name_snapshot,
    null::text as expense_type,
    null::text as document_type,
    b.id as bill_id,
    b.bill_type,
    b.status as bill_status,
    b.amount as bill_amount,
    b.paid_amount as bill_paid_amount,
    greatest(coalesce(b.amount, 0::numeric) - coalesce(b.paid_amount, 0::numeric), 0::numeric) as bill_remaining_amount,
    b.due_date as bill_due_date,
    b.paid_at as bill_paid_at,
    b.description as bill_description,
    b.project_name_snapshot as bill_project_name_snapshot,
    b.supplier_name_snapshot as bill_supplier_name_snapshot,
    b.worker_name_snapshot as bill_worker_name_snapshot,
    lower(
      concat_ws(
        ' ',
        coalesce(b.description, ''),
        coalesce(b.project_name_snapshot, ''),
        coalesce(b.supplier_name_snapshot, ''),
        coalesce(b.worker_name_snapshot, ''),
        coalesce(b.bill_type, ''),
        coalesce(b.status, '')
      )
    ) as search_text
  from public.bills b
  where b.deleted_at is null
    and b.bill_type = 'gaji';

grant select on table public.vw_workspace_transactions to anon, authenticated;
