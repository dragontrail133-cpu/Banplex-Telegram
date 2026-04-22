create or replace function public.fn_reverse_material_invoice_stock_movement(
  p_expense_id uuid,
  p_team_id uuid,
  p_document_type text default 'faktur'
)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_item record;
  v_current_stock numeric;
  v_delta numeric;
  v_source_type text;
begin
  if p_expense_id is null then
    raise exception 'Expense ID wajib diisi.';
  end if;

  if p_team_id is null then
    raise exception 'Team ID wajib diisi.';
  end if;

  v_source_type := case
    when coalesce(nullif(trim(p_document_type), ''), 'faktur') = 'surat_jalan' then 'delivery_order'
    else 'invoice'
  end;

  for v_item in
    select eli.id, eli.material_id, eli.qty
    from public.expense_line_items eli
    where eli.expense_id = p_expense_id
      and eli.deleted_at is null
    order by eli.sort_order, eli.created_at
  loop
    v_delta := case
      when v_source_type = 'delivery_order' then coalesce(v_item.qty, 0)
      else -coalesce(v_item.qty, 0)
    end;

    select coalesce(m.current_stock, 0)
      into v_current_stock
    from public.materials m
    where m.id = v_item.material_id
      and m.team_id = p_team_id
    for update;

    if not found then
      raise exception 'Material tidak ditemukan.';
    end if;

    if v_current_stock + v_delta < 0 then
      raise exception 'Stok material % tidak mencukupi untuk rollback dokumen barang ini.', v_item.material_id::text;
    end if;

    update public.materials
    set current_stock = v_current_stock + v_delta,
        updated_at = now()
    where id = v_item.material_id;

    delete from public.stock_transactions
    where expense_line_item_id = v_item.id;
  end loop;
end;
$$;

revoke all on function public.fn_reverse_material_invoice_stock_movement(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fn_reverse_material_invoice_stock_movement(uuid, uuid, text) to authenticated, service_role;
