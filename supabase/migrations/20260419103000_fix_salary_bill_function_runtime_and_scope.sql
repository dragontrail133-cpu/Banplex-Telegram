create or replace function public.fn_generate_salary_bill(
  p_worker_id uuid,
  p_record_ids uuid[],
  p_total_amount numeric,
  p_due_date date,
  p_description text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  new_bill_id uuid;
  v_telegram_user_id text;
  v_team_id uuid;
  v_updated_count integer;
begin
  if p_worker_id is null then
    raise exception 'Worker ID wajib diisi.';
  end if;

  if coalesce(array_length(p_record_ids, 1), 0) = 0 then
    raise exception 'Minimal satu absensi harus dipilih.';
  end if;

  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'Total amount harus lebih dari 0.';
  end if;

  select
    ar.telegram_user_id,
    ar.team_id
  into
    v_telegram_user_id,
    v_team_id
  from public.attendance_records ar
  where ar.id = any(p_record_ids)
    and ar.worker_id = p_worker_id
    and ar.deleted_at is null
    and ar.billing_status = 'unbilled'
  order by ar.attendance_date desc, ar.created_at desc
  limit 1;

  if v_telegram_user_id is null then
    raise exception 'Data absensi tidak ditemukan untuk pekerja ini.';
  end if;

  if v_team_id is null then
    raise exception 'Team absensi tidak ditemukan.';
  end if;

  insert into public.bills (
    worker_id,
    bill_type,
    status,
    amount,
    paid_amount,
    due_date,
    description,
    telegram_user_id,
    team_id
  )
  values (
    p_worker_id,
    'gaji',
    'unpaid',
    p_total_amount,
    0,
    p_due_date,
    coalesce(nullif(btrim(p_description), ''), 'Tagihan gaji'),
    v_telegram_user_id,
    v_team_id
  )
  returning id into new_bill_id;

  update public.attendance_records
  set
    salary_bill_id = new_bill_id,
    billing_status = 'billed'
  where id = any(p_record_ids)
    and worker_id = p_worker_id
    and deleted_at is null
    and billing_status = 'unbilled'
    and salary_bill_id is null;

  get diagnostics v_updated_count = row_count;

  if v_updated_count = 0 then
    raise exception 'Tidak ada absensi yang berhasil dibundel.';
  end if;

  return new_bill_id;
end;
$$;
