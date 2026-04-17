alter table public.bills
  add column if not exists project_income_id uuid references public.project_incomes(id) on delete cascade;

create unique index if not exists bills_project_income_staff_key
  on public.bills(project_income_id, staff_id)
  where project_income_id is not null and staff_id is not null;

create or replace function public.fn_sync_fee_bills_from_project_income()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_project_name text;
  v_due_date date := coalesce(new.transaction_date, new.income_date, current_date);
  v_fee_amount numeric(16,2);
  v_staff record;
begin
  if new.deleted_at is not null then
    update public.bills
    set
      deleted_at = coalesce(deleted_at, now()),
      updated_at = now(),
      status = case when status = 'paid' then status else 'cancelled' end
    where project_income_id = new.id
      and deleted_at is null;

    return new;
  end if;

  select coalesce(p.project_name, p.name, new.project_name_snapshot, 'Proyek')
  into v_project_name
  from public.projects p
  where p.id = new.project_id;

  v_project_name := coalesce(v_project_name, new.project_name_snapshot, 'Proyek');

  for v_staff in
    select
      s.id,
      s.staff_name,
      s.payment_type,
      coalesce(s.fee_percentage, 0) as fee_percentage,
      coalesce(s.fee_amount, 0) as fee_amount
    from public.staff s
    where s.team_id = new.team_id
      and s.deleted_at is null
      and s.payment_type in ('per_termin', 'fixed_per_termin')
  loop
    v_fee_amount := case
      when v_staff.payment_type = 'per_termin' then
        case
          when v_staff.fee_percentage > 0
            then round((coalesce(new.amount, 0) * v_staff.fee_percentage / 100.0)::numeric, 2)
          else v_staff.fee_amount
        end
      when v_staff.payment_type = 'fixed_per_termin' then
        v_staff.fee_amount
      else 0
    end;

    if coalesce(v_fee_amount, 0) <= 0 then
      continue;
    end if;

    insert into public.bills (
      project_income_id,
      telegram_user_id,
      team_id,
      project_id,
      staff_id,
      bill_type,
      description,
      amount,
      due_date,
      status,
      paid_amount,
      paid_at,
      worker_name_snapshot,
      project_name_snapshot,
      deleted_at
    )
    values (
      new.id,
      new.telegram_user_id,
      new.team_id,
      new.project_id,
      v_staff.id,
      'fee',
      format('Fee termin %s - %s', v_project_name, coalesce(v_staff.staff_name, 'Staf')),
      v_fee_amount,
      v_due_date,
      'unpaid',
      0,
      null,
      v_staff.staff_name,
      v_project_name,
      null
    )
    on conflict (project_income_id, staff_id) do update
      set
        team_id = excluded.team_id,
        project_id = excluded.project_id,
        bill_type = excluded.bill_type,
        description = excluded.description,
        amount = excluded.amount,
        due_date = excluded.due_date,
        worker_name_snapshot = excluded.worker_name_snapshot,
        project_name_snapshot = excluded.project_name_snapshot,
        deleted_at = null,
        updated_at = now();
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_sync_fee_bills_from_project_income on public.project_incomes;
create trigger trg_sync_fee_bills_from_project_income
after insert or update on public.project_incomes
for each row
execute function public.fn_sync_fee_bills_from_project_income();

create or replace function public.fn_update_loan_status_on_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_next_paid numeric(16,2);
  v_target_amount numeric(16,2);
begin
  select
    coalesce(l.paid_amount, 0) + coalesce(new.amount, 0),
    coalesce(l.repayment_amount, l.amount, 0)
  into v_next_paid, v_target_amount
  from public.loans l
  where l.id = new.loan_id;

  update public.loans
  set
    paid_amount = v_next_paid,
    status = case
      when v_target_amount > 0 and v_next_paid >= v_target_amount then 'paid'
      when v_next_paid > 0 then 'partial'
      else 'unpaid'
    end,
    updated_at = now()
  where id = new.loan_id;

  return new;
end;
$$;

drop trigger if exists trg_after_loan_payment_insert on public.loan_payments;
create trigger trg_after_loan_payment_insert
after insert on public.loan_payments
for each row
execute function public.fn_update_loan_status_on_payment();
