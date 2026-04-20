create or replace function public.fn_soft_delete_bill_with_history(
  p_bill_id uuid
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_timestamp timestamptz := now();
  v_bill_found boolean;
begin
  if p_bill_id is null then
    raise exception 'Bill ID wajib diisi.';
  end if;

  select exists(
    select 1
    from public.bills
    where id = p_bill_id
      and deleted_at is null
  )
  into v_bill_found;

  if not v_bill_found then
    raise exception 'Tagihan tidak ditemukan.';
  end if;

  update public.bill_payments
  set
    deleted_at = v_timestamp,
    updated_at = v_timestamp
  where bill_id = p_bill_id
    and deleted_at is null;

  update public.bills
  set
    deleted_at = v_timestamp,
    updated_at = v_timestamp,
    status = 'cancelled',
    paid_amount = 0,
    paid_at = null
  where id = p_bill_id
    and deleted_at is null;
end;
$$;

revoke execute on function public.fn_soft_delete_bill_with_history(uuid) from public, anon, authenticated;
grant execute on function public.fn_soft_delete_bill_with_history(uuid) to service_role;
