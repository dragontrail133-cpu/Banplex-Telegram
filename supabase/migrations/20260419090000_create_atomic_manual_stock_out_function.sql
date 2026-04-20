alter table public.stock_transactions
  alter column expense_line_item_id drop not null;

create or replace function public.fn_create_atomic_manual_stock_out(
  p_telegram_user_id text,
  p_team_id uuid,
  p_project_id uuid,
  p_material_id uuid,
  p_quantity numeric,
  p_notes text,
  p_created_by_user_id uuid default null
)
returns table (
  material jsonb,
  stock_transaction jsonb
)
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_material public.materials%rowtype;
  v_project public.projects%rowtype;
  v_stock_transaction public.stock_transactions%rowtype;
  v_quantity numeric;
  v_next_stock numeric;
begin
  if coalesce(nullif(trim(p_telegram_user_id), ''), '') = '' then
    raise exception 'Telegram user ID wajib diisi.';
  end if;

  if p_team_id is null then
    raise exception 'Team ID wajib diisi.';
  end if;

  if p_project_id is null then
    raise exception 'Unit Kerja wajib dipilih.';
  end if;

  if p_material_id is null then
    raise exception 'Material ID wajib diisi.';
  end if;

  v_quantity := coalesce(p_quantity, 0);

  if v_quantity <= 0 then
    raise exception 'Qty stock-out harus lebih dari 0.';
  end if;

  if v_quantity <> trunc(v_quantity) then
    raise exception 'Qty stock-out harus bilangan bulat.';
  end if;

  if nullif(trim(coalesce(p_notes, '')), '') is null then
    raise exception 'Catatan stock-out wajib diisi.';
  end if;

  perform 1
  from public.team_members tm
  where tm.telegram_user_id = p_telegram_user_id
    and tm.team_id = p_team_id
    and tm.status = 'active';

  if not found then
    raise exception 'Akses workspace tidak ditemukan.';
  end if;

  select *
  into v_project
  from public.projects p
  where p.id = p_project_id
    and p.team_id = p_team_id
    and p.deleted_at is null
    and p.is_active = true
  for share;

  if not found then
    raise exception 'Unit Kerja tidak ditemukan atau tidak aktif.';
  end if;

  select *
  into v_material
  from public.materials m
  where m.id = p_material_id
    and m.team_id = p_team_id
    and m.deleted_at is null
    and m.is_active = true
  for update;

  if not found then
    raise exception 'Material tidak ditemukan.';
  end if;

  v_next_stock := coalesce(v_material.current_stock, 0) - v_quantity;

  if v_next_stock < 0 then
    raise exception 'Stok material % tidak mencukupi untuk stock-out manual ini.', coalesce(v_material.name, v_material.id::text);
  end if;

  update public.materials
  set current_stock = v_next_stock,
      updated_at = now()
  where id = v_material.id
  returning * into v_material;

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
    price_per_unit,
    notes,
    created_by_user_id
  )
  values (
    p_team_id,
    p_material_id,
    p_project_id,
    null,
    null,
    v_quantity,
    'out',
    'manual_out',
    current_date,
    null,
    p_notes,
    p_created_by_user_id
  )
  returning * into v_stock_transaction;

  return query
  select
    to_jsonb(v_material),
    to_jsonb(v_stock_transaction);
end;
$$;

revoke all on function public.fn_create_atomic_manual_stock_out(
  text,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  uuid
) from public, anon, authenticated;

grant execute on function public.fn_create_atomic_manual_stock_out(
  text,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  uuid
) to service_role;
