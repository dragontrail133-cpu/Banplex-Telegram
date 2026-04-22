with payroll_bill_labels as (
  select
    b.id,
    coalesce(
      nullif(btrim(w.name), ''),
      case
        when b.description ~ '^Tagihan gaji untuk .+ \([0-9]+ absensi\)$' then
          nullif(regexp_replace(b.description, '^Tagihan gaji untuk (.+) \([0-9]+ absensi\)$', '\1'), '')
        else null
      end,
      nullif(btrim(b.description), '')
    ) as resolved_worker_name
  from public.bills b
  left join public.workers w on w.id = b.worker_id
  where b.bill_type = 'gaji'
)
update public.bills b
set
  worker_name_snapshot = coalesce(
    nullif(nullif(btrim(b.worker_name_snapshot), ''), 'Supplier belum terhubung'),
    payroll_bill_labels.resolved_worker_name
  ),
  supplier_name_snapshot = coalesce(
    nullif(nullif(btrim(b.supplier_name_snapshot), ''), 'Supplier belum terhubung'),
    payroll_bill_labels.resolved_worker_name
  )
from payroll_bill_labels
where b.id = payroll_bill_labels.id
  and (
    b.worker_name_snapshot is null
    or btrim(b.worker_name_snapshot) = ''
    or b.worker_name_snapshot = 'Supplier belum terhubung'
    or b.supplier_name_snapshot is null
    or btrim(b.supplier_name_snapshot) = ''
    or b.supplier_name_snapshot = 'Supplier belum terhubung'
  );

with payroll_payment_labels as (
  select
    bp.id,
    coalesce(
      nullif(btrim(w.name), ''),
      case
        when b.description ~ '^Tagihan gaji untuk .+ \([0-9]+ absensi\)$' then
          nullif(regexp_replace(b.description, '^Tagihan gaji untuk (.+) \([0-9]+ absensi\)$', '\1'), '')
        else null
      end,
      nullif(nullif(btrim(b.worker_name_snapshot), ''), 'Supplier belum terhubung'),
      nullif(btrim(b.description), '')
    ) as resolved_worker_name
  from public.bill_payments bp
  join public.bills b on b.id = bp.bill_id
  left join public.workers w on w.id = b.worker_id
  where b.bill_type = 'gaji'
)
update public.bill_payments bp
set
  worker_name_snapshot = coalesce(
    nullif(nullif(btrim(bp.worker_name_snapshot), ''), 'Supplier belum terhubung'),
    payroll_payment_labels.resolved_worker_name
  ),
  supplier_name_snapshot = coalesce(
    nullif(nullif(btrim(bp.supplier_name_snapshot), ''), 'Supplier belum terhubung'),
    payroll_payment_labels.resolved_worker_name
  )
from payroll_payment_labels
where bp.id = payroll_payment_labels.id
  and (
    bp.worker_name_snapshot is null
    or btrim(bp.worker_name_snapshot) = ''
    or bp.worker_name_snapshot = 'Supplier belum terhubung'
    or bp.supplier_name_snapshot is null
    or btrim(bp.supplier_name_snapshot) = ''
    or bp.supplier_name_snapshot = 'Supplier belum terhubung'
  );
