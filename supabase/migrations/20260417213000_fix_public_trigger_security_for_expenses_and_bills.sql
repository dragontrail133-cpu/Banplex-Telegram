create or replace function public.fn_auto_create_bill_from_expense()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_bill_id uuid;
  v_expense_status text := coalesce(new.status, 'unpaid');
  v_bill_amount numeric := coalesce(new.amount, new.total_amount, 0);
  v_payment_notes text := coalesce(
    new.description,
    'Pembayaran cash otomatis dari faktur material'
  );
begin
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
    paid_at
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
    v_expense_status,
    case when v_expense_status = 'paid' then v_bill_amount else 0 end,
    case when v_expense_status = 'paid' then now() else null end
  )
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
    values (
      v_bill_id,
      new.telegram_user_id,
      new.team_id,
      v_bill_amount,
      coalesce(new.expense_date, current_date),
      v_payment_notes
    );
  end if;

  return new;
end;
$$;

create or replace function public.fn_update_bill_status_on_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_bill_amount numeric := 0;
  v_current_paid numeric := 0;
  v_next_paid numeric := 0;
begin
  select
    coalesce(b.amount, 0),
    coalesce(b.paid_amount, 0)
  into v_bill_amount, v_current_paid
  from public.bills b
  where b.id = new.bill_id
  for update;

  if not found then
    return new;
  end if;

  v_next_paid := least(v_current_paid + coalesce(new.amount, 0), v_bill_amount);

  update public.bills
  set
    paid_amount = v_next_paid,
    status = case
      when v_bill_amount > 0 and v_next_paid >= v_bill_amount then 'paid'
      when v_next_paid > 0 then 'partial'
      else 'unpaid'
    end,
    paid_at = case
      when v_bill_amount > 0 and v_next_paid >= v_bill_amount then coalesce(public.bills.paid_at, now())
      else null
    end
  where public.bills.id = new.bill_id;

  return new;
end;
$$;
