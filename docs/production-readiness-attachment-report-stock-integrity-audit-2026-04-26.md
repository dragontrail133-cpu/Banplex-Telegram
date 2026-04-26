# Production Readiness Attachment, Report, and Stock Integrity Audit - 2026-04-26

Audit baseline date: `2026-04-26`  
Stream: `Production Readiness Hardening`  
Task: `PRH-L2-03`

## Scope

Audit ini memeriksa tiga area yang paling rawan drift jangka panjang:

- attachment lifecycle dan file asset linkage,
- report views dan PDF settings,
- dan stock movement / current stock cache.

Tidak ada runtime patch, migration, DDL/DML, atau deploy yang dijalankan.

## Evidence Basis

Sumber audit:

- `src/components/ExpenseAttachmentSection.jsx`
- `src/store/useFileStore.js`
- `src/store/useHrStore.js`
- `src/store/useReportStore.js`
- `src/components/ProjectReport.jsx`
- `src/lib/reports-api.js`
- `src/lib/business-report.js`
- `src/pages/StockPage.jsx`
- `src/lib/records-api.js`
- `api/records.js`
- `supabase/migrations/20260411173000_create_hrd_pipeline_and_beneficiaries.sql`
- `supabase/migrations/20260411200000_strict_alignment_master_expenses_loans.sql`
- `supabase/migrations/20260411235900_final_schema_alignment_hrd_pdf_soft_delete.sql`
- `supabase/migrations/20260419090000_create_atomic_manual_stock_out_function.sql`
- `supabase/migrations/20260421101000_reverse_material_invoice_stock_on_delete.sql`
- `pg_get_viewdef('public.vw_project_financial_summary'::regclass, true)`
- `pg_get_viewdef('public.vw_transaction_summary'::regclass, true)`
- `pg_get_viewdef('public.vw_cash_mutation'::regclass, true)`
- `mcp__supabase__.execute_sql` untuk attachment, report, PDF, dan stock reconciliation snapshot live

## Contract Map

### Attachment Lifecycle

Attachment dan file asset dipakai lintas domain:

- `expense_attachments` untuk lampiran expense,
- `hrd_applicant_documents` untuk dokumen HRD,
- dan `pdf_settings` untuk header/footer logo laporan.

Server/UI contract yang dicek:

- `ExpenseAttachmentSection` melakukan `purgeFileAsset()` jika upload gagal sebelum attachment tersimpan.
- `useHrStore` memanggil `deleteFileAsset()` saat dokumen HRD dihapus supaya storage metadata ikut bersih.
- `savePdfSettings()` menyimpan logo file asset melalui `header_logo_file_id` / `footer_logo_file_id` tanpa merusak relasi team.

### Report Layer

Report read model yang dicek:

- `vw_project_financial_summary`
- `vw_transaction_summary`
- `vw_cash_mutation`

Contract-nya:

- `vw_project_financial_summary` dipakai untuk summary proyek dan executive finance.
- `vw_transaction_summary` membaca cash summary dari `transactions` + `vw_cash_mutation`.
- `vw_cash_mutation` adalah feed transaksi kas lintas sumber untuk cash flow report.

### Stock Layer

Stock contract yang dicek:

- `stock_transactions` adalah ledger movement.
- `materials.current_stock` adalah cache inventory yang dipakai stock overview.
- `fn_create_atomic_manual_stock_out()` menulis transaksi `out` historis / manual stock-out.
- `fn_auto_update_stock_from_line_item()` menulis transaksi `invoice` untuk material invoice in-flow.
- `fn_reverse_material_invoice_stock_movement()` menjaga reversal saat delete material invoice.

## Live Snapshot

### Attachment

Hasil audit attachment live:

| Check | Result | Meaning |
| --- | ---: | --- |
| broken expense parent | `0` | Semua active `expense_attachments` masih punya parent expense. |
| broken expense file | `0` | Semua active lampiran punya file asset yang ada dan belum deleted. |
| expense file team mismatch | `0` | Team attachment dan file asset konsisten. |
| broken HRD parent | `0` | Semua active `hrd_applicant_documents` masih punya applicant. |
| broken HRD file | `0` | Semua active dokumen HRD punya file asset yang valid. |
| broken PDF header/footer | `0` | Logo PDF settings tidak menunjuk file asset yang hilang / deleted. |
| PDF logo team mismatch | `0` | Logo PDF settings masih satu team dengan settings row. |
| active file asset storage missing | `0` | Metadata file asset dan object storage masih selaras. |
| active unreferenced file asset | `1` | Ada satu active file asset yang tidak direferensikan oleh attachment, HRD document, atau PDF settings. |

Sampel orphan-like asset:

- `file_assets.id = 22cfaa0f-7740-4b7e-906a-b4ef5203f357`
- `team_id = 2213b84a-a513-47fa-afbb-8b99ae3b64be`
- `storage_bucket = hrd_documents`
- `storage_path = expense/2026-04-25/496a34bb-e6ab-4e2b-a570-69ebf189910b-IMG-20260422-WA0002.jpg`
- `deleted_at = null`

Audit meaning:

- Attachment dan HRD file-link contract sendiri masih bersih.
- Tetapi ada satu active file asset yang tersisa tanpa referensi, jadi cleanup permanen attachment/file asset belum benar-benar tertutup di semua jalur.

### Report

`vw_project_financial_summary` dan `vw_transaction_summary` dibandingkan dengan recompute dari source tables pada snapshot live:

- `project_summary_mismatch_count = 0`
- `transaction_summary_mismatch_count = 0`
- `deleted_bill_payment_count = 0`
- `deleted_loan_payment_count = 0`
- `deleted_project_income_count = 0`
- `deleted_loan_count = 0`

Audit meaning:

- Report views yang dipakai app konsisten dengan formula live yang diperiksa.
- Tidak ada deleted source row yang ikut mengganggu feed report pada snapshot ini.
- PDF settings juga bersih dari broken logo relation atau team mismatch, jadi config report tidak menambah drift.

### Stock

Snapshot stock live:

| Check | Result | Meaning |
| --- | ---: | --- |
| active stock transaction count | `143` | Ledger movement aktif ada dan terbaca. |
| orphan material | `0` | Tidak ada stock transaction yang kehilangan material. |
| invalid direction | `0` | Hanya direction `in` / `out` yang dipakai. |
| invoice/delivery broken link | `0` | Movement invoice / delivery order masih lengkap. |
| team mismatch | `0` | Material, project, expense, dan line item masih satu team. |
| current stock mismatch | `37` | Cache `materials.current_stock` tidak cocok dengan net movement ledger pada 37 material. |

Distinct source type live yang terbaca:

- `delivery_order`: `51`
- `invoice`: `89`
- `out`: `3` legacy manual stock-out rows

Sampel mismatch material:

- `c507c9bc-fd1c-508e-b37a-0ae589f801f3` — `Cnp C75` — `current_stock = 20`, `expected_current_stock = -349`
- `851184d0-486c-5afe-8fac-d4971c347aea` — `Besi 12mm` — `current_stock = 105`, `expected_current_stock = -77`
- `048f3911-31c4-5b9c-9faa-a0b1653480dc` — `Reng 0,35` — `current_stock = 170`, `expected_current_stock = 0`

Konteks mismatch:

- Semua 37 material yang mismatch dibuat pada `2026-04-23`.
- Semua mismatch berada pada team `2213b84a-a513-47fa-afbb-8b99ae3b64be`.
- Tidak ada deleted `stock_transactions`, jadi drift ini bukan akibat row movement yang sudah dihapus.

## Findings

- Attachment / HRD / PDF settings contract relatif bersih, tetapi ada satu active file asset yang tidak lagi direferensikan.
- Report views yang diperiksa tidak menunjukkan drift pada snapshot live; contract reporting inti tetap konsisten.
- Stock ledger structurally valid, tetapi cache `materials.current_stock` melenceng pada 37 material di satu team dan satu tanggal import/material creation batch.
- Karena stock overview UI membaca `current_stock`, mismatch ini berarti inventory cache belum sepenuhnya trustworthy untuk semua material.

## Conclusion

`PRH-L2-03` selesai sebagai audit, dengan hasil campuran:

1. attachment/report path sebagian besar sehat,
2. report views inti konsisten,
3. tetapi stock cache masih perlu remediation karena `current_stock` tidak match dengan ledger movement pada 37 material,
4. dan ada satu active orphan-like file asset yang seharusnya ditutup oleh cleanup permanen attachment/file asset.

## Next Task

Rekomendasi lanjutannya adalah `PRH-L2-04` untuk migration drift triage.
