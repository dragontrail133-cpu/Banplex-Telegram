begin;

alter table public.loans
  add column if not exists late_interest_rate numeric(8,4) not null default 0,
  add column if not exists late_interest_basis text not null default 'remaining',
  add column if not exists late_penalty_type text not null default 'none',
  add column if not exists late_penalty_amount numeric(16,2) not null default 0,
  add column if not exists loan_terms_snapshot jsonb not null default '{}'::jsonb;

alter table public.loans
  drop constraint if exists loans_late_interest_basis_check;

alter table public.loans
  add constraint loans_late_interest_basis_check
  check (late_interest_basis in ('principal', 'remaining'));

alter table public.loans
  drop constraint if exists loans_late_penalty_type_check;

alter table public.loans
  add constraint loans_late_penalty_type_check
  check (late_penalty_type in ('none', 'flat'));

create or replace function public.fn_build_loan_terms_snapshot(
  p_principal_amount numeric,
  p_repayment_amount numeric,
  p_interest_type text,
  p_interest_rate numeric,
  p_tenor_months integer,
  p_late_interest_rate numeric,
  p_late_interest_basis text,
  p_late_penalty_type text,
  p_late_penalty_amount numeric,
  p_transaction_date date,
  p_disbursed_date date,
  p_creditor_name_snapshot text
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'principal_amount', coalesce(p_principal_amount, 0),
    'repayment_amount', coalesce(p_repayment_amount, 0),
    'interest_type', case
      when lower(coalesce(p_interest_type, 'none')) = 'interest' then 'interest'
      else 'none'
    end,
    'interest_rate', case
      when lower(coalesce(p_interest_type, 'none')) = 'interest' then coalesce(p_interest_rate, 0)
      else null
    end,
    'tenor_months', case
      when coalesce(p_tenor_months, 0) > 0 then p_tenor_months
      else null
    end,
    'transaction_date', coalesce(p_transaction_date, p_disbursed_date, current_date),
    'disbursed_date', coalesce(p_disbursed_date, p_transaction_date, current_date),
    'due_date', case
      when coalesce(p_tenor_months, 0) > 0 then (coalesce(p_transaction_date, p_disbursed_date, current_date) + make_interval(months => coalesce(p_tenor_months, 0)))::date
      else coalesce(p_transaction_date, p_disbursed_date, current_date)
    end,
    'base_repayment_amount', case
      when lower(coalesce(p_interest_type, 'none')) = 'interest'
        and coalesce(p_interest_rate, 0) > 0
        and coalesce(p_tenor_months, 0) > 0
        then round(
          (
            coalesce(p_principal_amount, 0)
            + (coalesce(p_principal_amount, 0) * coalesce(p_interest_rate, 0) / 100.0 * coalesce(p_tenor_months, 0))
          )::numeric,
          2
        )
      else round(coalesce(p_principal_amount, 0)::numeric, 2)
    end,
    'late_interest_rate', greatest(coalesce(p_late_interest_rate, 0), 0),
    'late_interest_basis', case
      when lower(coalesce(p_late_interest_basis, 'remaining')) in ('principal', 'remaining')
        then lower(coalesce(p_late_interest_basis, 'remaining'))
      else 'remaining'
    end,
    'late_penalty_type', case
      when lower(coalesce(p_late_penalty_type, 'none')) in ('none', 'flat')
        then lower(coalesce(p_late_penalty_type, 'none'))
      else 'none'
    end,
    'late_penalty_amount', case
      when lower(coalesce(p_late_penalty_type, 'none')) = 'flat'
        then greatest(coalesce(p_late_penalty_amount, 0), 0)
      else 0
    end,
    'creditor_name_snapshot', coalesce(nullif(btrim(p_creditor_name_snapshot), ''), '-')
  );
$$;

create or replace function public.fn_sync_loan_terms_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.interest_type := case
    when lower(coalesce(new.interest_type, 'none')) = 'interest' then 'interest'
    else 'none'
  end;
  new.interest_rate := case
    when new.interest_type = 'interest' then coalesce(new.interest_rate, 0)
    else null
  end;
  new.tenor_months := case
    when coalesce(new.tenor_months, 0) > 0 then new.tenor_months
    else null
  end;
  new.late_interest_rate := greatest(coalesce(new.late_interest_rate, 0), 0);
  new.late_interest_basis := case
    when lower(coalesce(new.late_interest_basis, 'remaining')) in ('principal', 'remaining')
      then lower(coalesce(new.late_interest_basis, 'remaining'))
    else 'remaining'
  end;
  new.late_penalty_type := case
    when lower(coalesce(new.late_penalty_type, 'none')) in ('none', 'flat')
      then lower(coalesce(new.late_penalty_type, 'none'))
    else 'none'
  end;
  new.late_penalty_amount := case
    when new.late_penalty_type = 'flat' then greatest(coalesce(new.late_penalty_amount, 0), 0)
    else 0
  end;
  new.amount := coalesce(new.amount, new.principal_amount, 0);
  new.repayment_amount := case
    when new.interest_type = 'interest'
      and coalesce(new.interest_rate, 0) > 0
      and coalesce(new.tenor_months, 0) > 0
      then round(
        (
          coalesce(new.principal_amount, new.amount, 0)
          + (coalesce(new.principal_amount, new.amount, 0) * coalesce(new.interest_rate, 0) / 100.0 * coalesce(new.tenor_months, 0))
        )::numeric,
        2
      )
    else round(coalesce(new.principal_amount, new.amount, 0)::numeric, 2)
  end;
  new.loan_terms_snapshot := public.fn_build_loan_terms_snapshot(
    new.principal_amount,
    new.repayment_amount,
    new.interest_type,
    new.interest_rate,
    new.tenor_months,
    new.late_interest_rate,
    new.late_interest_basis,
    new.late_penalty_type,
    new.late_penalty_amount,
    new.transaction_date,
    new.disbursed_date,
    new.creditor_name_snapshot
  );

  return new;
end;
$$;

drop trigger if exists trg_sync_loan_terms_snapshot on public.loans;
create trigger trg_sync_loan_terms_snapshot
before insert or update of principal_amount, repayment_amount, interest_type, interest_rate, tenor_months, late_interest_rate, late_interest_basis, late_penalty_type, late_penalty_amount, transaction_date, disbursed_date, creditor_name_snapshot
on public.loans
for each row
execute function public.fn_sync_loan_terms_snapshot();

update public.loans
set loan_terms_snapshot = public.fn_build_loan_terms_snapshot(
  principal_amount,
  repayment_amount,
  interest_type,
  interest_rate,
  tenor_months,
  late_interest_rate,
  late_interest_basis,
  late_penalty_type,
  late_penalty_amount,
  transaction_date,
  disbursed_date,
  creditor_name_snapshot
);

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
    coalesce(
      nullif((l.loan_terms_snapshot ->> 'base_repayment_amount'), '')::numeric,
      nullif((l.loan_terms_snapshot ->> 'repayment_amount'), '')::numeric,
      l.repayment_amount,
      l.amount,
      0
    )
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

commit;
