# Production Readiness Delete/Restore Integrity Audit - 2026-04-25

Audit baseline date: `2026-04-25`  
Stream: `Production Readiness Hardening`  
Task: `PRH-L2-01`

## Scope

Audit ini memeriksa jalur delete/restore yang paling berisiko terhadap orphan dan stale state:

- recycle bin page dan action handler di UI,
- wrapper API client untuk restore/permanent delete,
- server-side hard delete / restore / soft delete contract,
- dan integritas child tree di database live.

Tidak ada runtime patch, migration, DDL/DML, atau deploy yang dijalankan.

## Evidence Basis

Sumber audit:

- `src/pages/TransactionsRecycleBinPage.jsx`
- `src/lib/transactions-api.js`
- `src/lib/records-api.js`
- `api/transactions.js`
- `api/records.js`
- `supabase/migrations/20260410224500_create_material_invoice_tables.sql`
- `supabase/migrations/20260410233000_add_bills_stock_automation.sql`
- `supabase/migrations/20260411120000_add_expense_status_and_paid_bill_automation.sql`
- `supabase/migrations/20260411143000_create_funding_creditors_and_income_loans_flow.sql`
- `supabase/migrations/20260418094000_soft_delete_bill_with_payment_history.sql`
- `supabase/migrations/20260418134500_add_team_scope_to_expense_child_collections.sql`
- `supabase/migrations/20260418094500_add_attachment_lifecycle_columns.sql`
- `supabase/migrations/20260420150000_create_vw_recycle_bin_records.sql`
- `supabase/migrations/20260411235900_final_schema_alignment_hrd_pdf_soft_delete.sql`
- `mcp__supabase__.get_advisors` security + performance
- `mcp__supabase__.execute_sql` untuk cek orphan dan child-state integrity

## Contract Map

### UI Layer

`src/pages/TransactionsRecycleBinPage.jsx` sudah memisahkan aksi recycle bin dengan jelas:

- restore per record,
- permanent delete per record,
- bulk `Hapus Semua` untuk item eligible,
- dan refresh recycle bin + dashboard setelah mutation berhasil.

`Hapus Semua` hanya muncul saat ada record dengan `canPermanentDelete === true`, sehingga restore-only record tidak ikut tersapu.

### Client Wrapper Layer

`src/lib/transactions-api.js` dan `src/lib/records-api.js` mengirim action eksplisit ke server:

- `action: 'restore'`
- `action: 'permanent-delete'`
- `action: 'permanent-delete-all-eligible'`

Tidak ada delete langsung ke tabel dari UI; semua write lewat API server.

### Server Layer

`api/transactions.js` dan `api/records.js` memaksa team/auth context sebelum mutation sensitif dan memakai service client untuk hard delete.

Poin penting yang relevan:

- hard delete bill/payment/attachment/loan mengikuti urutan child-first,
- restore bill memeriksa parent expense atau project income yang masih deleted sebelum menghidupkan ulang data,
- soft delete bill memakai RPC history-aware,
- soft delete loan menolak delete kalau payment aktif masih ada,
- soft delete expense menolak delete jika child bill payments aktif masih menempel.

### Schema Layer

Migrations yang diperiksa menunjukkan contract tree sudah disusun untuk mencegah orphan:

- beberapa child table memakai `on delete cascade`,
- bill soft delete history dikelola lewat function khusus,
- attachment lifecycle mengikuti relasi parent expense/file asset,
- dan recycle bin view memetakan deleted tree sebagai read model yang konsisten.

## Live Integrity Snapshot

Hasil audit read-only pada database live untuk tree yang paling sensitif:

| Check | Result | Meaning |
| --- | --- | --- |
| orphan bill payments | `0` | Tidak ada payment yatim yang tersisa |
| orphan loan payments | `0` | Tidak ada payment pinjaman yatim |
| orphan expense line items parent | `0` | Tidak ada line item tanpa parent expense |
| orphan expense attachments parent | `0` | Tidak ada attachment tanpa parent expense |
| orphan expense line items material | `0` | Relasi material dan line item utuh |
| orphan stock transactions line item | `0` | Stock movement terkait line item tetap konsisten |
| orphan expense attachments file asset | `0` | Attachment dan file asset masih selaras |
| active bill payments under deleted bill | `0` | Tidak ada child aktif di bawah parent deleted |
| active loan payments under deleted loan | `0` | Tidak ada child aktif di bawah parent deleted |
| active expense line items under deleted expense | `0` | Child expense tree tidak bocor saat parent deleted |
| active expense attachments under deleted expense | `0` | Attachment tidak tertinggal aktif saat parent deleted |

## Findings

- Tree delete/restore saat ini konsisten di live data yang diaudit.
- Hard delete contract sudah child-first, jadi risiko orphan dari permanent delete rendah pada jalur yang diperiksa.
- Restore contract menolak state yang tidak valid, sehingga partial restore tidak diam-diam lolos.
- Bulk permanent delete hanya menyasar record eligible; restore-only item tetap aman.
- Tidak ada indikasi drift data integrity pada tree yang diperiksa melalui SQL read-only.

## Conclusion

`PRH-L2-01` tidak menemukan orphan atau mismatch pada delete/restore tree yang diaudit.

Artinya:

1. recycle bin contract UI ↔ API ↔ server sudah sinkron,
2. parent-child delete ordering sudah aman pada surface utama,
3. dan live data tidak menunjukkan residual orphan untuk entity yang dicek.

## Next Task

Rekomendasi lanjutannya adalah `PRH-L2-02` untuk settlement integrity pada bill/payment/loan/attendance.
