# Production Readiness Hardening Progress Log

Dokumen ini adalah log progres untuk stream `Production Readiness Hardening`.

## Aturan Pakai

1. Update log ini setiap selesai mengerjakan satu task di stream ini.
2. Jangan pindah ke task berikutnya sebelum hasil audit task aktif jelas.
3. Jika task gagal validasi, tulis status `audit_required` atau `blocked` beserta blocker-nya.
4. Jika brief baru mengubah backlog, revisi backlog dulu sebelum implementasi lanjut.

## Status Legend

- `planned`
- `in_progress`
- `audit_required`
- `validated`
- `blocked`
- `deferred`

## Current Active Task

- Active stream: `Production Readiness Hardening`
- Referensi plan: `docs/production-readiness-hardening-plan-2026-04-25.md`
- Referensi backlog: `docs/production-readiness-hardening-backlog-2026-04-25.md`
- Current task: `PRH-L3-02`
- Current status: `planned`
- Catatan fokus: `PRH-L3-01` mutation error hardening sudah tervalidasi; fokus berikutnya adalah hardening state store agar loading/error/refresh tetap sinkron dengan response server. Tidak ada schema atau migration yang diubah.

## [2026-04-25] `PRH-00` - Publish production readiness planning artifacts

- Status: `validated`
- Ringkasan:
  - Plan readiness production dibuat sebagai stream terpisah agar hardening, polish, dan cleanup punya backlog auditable sendiri.
  - Backlog memakai prefix `PRH-*` supaya tidak bentrok dengan task `UCW` yang sudah dipakai backlog lain.
  - Progress log baru disiapkan sebagai tempat pencatatan task audit/hardening berikutnya.
- File berubah:
  - `docs/production-readiness-hardening-plan-2026-04-25.md`
  - `docs/production-readiness-hardening-backlog-2026-04-25.md`
  - `docs/progress/production-readiness-hardening-progress-log.md`
- Audit hasil:
  - Baseline audit read-only tetap mengarah ke `docs/architecture-source-of-truth-audit-2026-04-24.md` dan freeze contract map.
  - Supabase advisor findings yang relevan sudah dijadikan input plan: policy gap, storage exposure, auth password protection, unindexed FK, dan RLS initplan warnings.
- Validasi:
  - `rg -n "PRH-|Production Readiness Hardening" docs/production-readiness-hardening-plan-2026-04-25.md docs/production-readiness-hardening-backlog-2026-04-25.md docs/progress/production-readiness-hardening-progress-log.md`
- Risiko/regresi:
  - Tidak ada runtime risk dari task ini karena hanya dokumen planning.
  - Risiko berikutnya ada di eksekusi task runtime jika backlog dijalankan tanpa approval live-write yang cukup.

## [2026-04-25] `PRH-L0-01` - Baseline audit matrix

- Status: `validated`
- Ringkasan:
  - Dokumen matriks audit baseline diterbitkan untuk mengikat `route -> store -> API/server -> schema/view` pada domain inti dan boundary transitional.
  - Matrix ini dipakai sebagai source audit pertama untuk task hardening berikutnya supaya tidak ada ambiguity antara route, store, dan final data source.
  - Baseline gap yang paling penting sudah dirangkum: dashboard summary, payment status ownership, direct-client exception, dan destructive delete/restore tree.
- File berubah:
  - `docs/production-readiness-audit-matrix-2026-04-25.md`
  - `docs/progress/production-readiness-hardening-progress-log.md`
- Audit hasil:
  - Core domains sudah dipetakan ke source-of-truth final atau boundary mixed/transitional yang terdokumentasi.
  - Transitional boundaries untuk `Master`, `HRD`, `team invite`, file upload, dan legacy payroll manager dipisahkan dari finance core agar task hardening berikutnya tidak salah target.
- Validasi:
  - `rg -n "PRH-L0-01|route -> store -> API/server -> schema/view|reference/master|telegram assistant|Baseline Gaps" docs/production-readiness-audit-matrix-2026-04-25.md docs/progress/production-readiness-hardening-progress-log.md`
- Risiko/regresi:
  - Tidak ada runtime risk karena task ini docs-only.
  - Risiko berikutnya ada jika task runtime membaca matrix ini tanpa tetap mengecek implementasi aktual.

## [2026-04-25] `PRH-L1-01` - Auth and guard audit

- Status: `validated`
- Ringkasan:
  - Boundary auth bootstrap, route/UI guard, server-side team access, capability gate server, dan cron auth sudah dipetakan end-to-end.
  - `ProtectedRoute` dan capability contract dipakai untuk screen sensitif, sementara server tetap memegang `getAuthorizedContext()` dan `assertTeamAccess()` untuk write path.
  - Public views canonical yang dipakai app sudah terbaca `security_invoker = true`, jadi tidak ada bypass-RLS view yang terlihat pada read model inti.
- File berubah:
  - `docs/production-readiness-auth-guard-audit-2026-04-25.md`
  - `docs/progress/production-readiness-hardening-progress-log.md`
- Audit hasil:
  - `api/auth.js` memverifikasi Telegram initData dan membatasi dev bypass ke localhost development; service-role hanya dipakai di server.
  - `api/transactions.js`, `api/records.js`, dan `api/recycle-bin-retention.js` memaksa auth context/team membership atau `CRON_SECRET` sebelum operasi sensitif.
  - Advisor menemukan gap yang memang belum ditutup: `telegram_assistant_sessions` tanpa policy, bucket `hrd_documents` terlalu longgar, leaked-password protection off, dan policy/perf noise pada `team_members`, `profiles`, dan `invite_tokens`.
- Validasi:
  - `rg -n "ProtectedRoute|assertTeamAccess|assertCapabilityAccess|devAuthBypass|CRON_SECRET|security_invoker|team_members|telegram_assistant_sessions|hrd_documents" src api supabase docs`
  - `git diff --check -- docs/production-readiness-auth-guard-audit-2026-04-25.md docs/progress/production-readiness-hardening-progress-log.md`
- Risiko/regresi:
  - Tidak ada runtime risk karena task ini docs-only.
  - Risiko berikutnya ada jika gap advisor dibaca sebagai aman; gap ini tetap harus ditangani di task L1-02/L1-03.

## [2026-04-25] `PRH-L1-02` - RLS, view, and storage audit

- Status: `validated`
- Ringkasan:
  - Audit live `pg_policies`, `storage.buckets`, dan `pg_class.reloptions` menunjukkan posture view publik sudah aman, tetapi ada gap policy pada `telegram_assistant_sessions` dan exposure listing pada bucket `hrd_documents`.
  - Policy `profiles`, `team_members`, dan `invite_tokens` sudah ada dan berfungsi, namun `profiles`/`invite_tokens` tetap memunculkan warning performa `auth_rls_initplan`.
  - Seluruh view publik inti yang diperiksa live memakai `security_invoker`, jadi tidak ada view bypass-RLS yang terlihat pada set yang dipakai app.
- File berubah:
  - `docs/production-readiness-rls-storage-audit-2026-04-25.md`
  - `docs/progress/production-readiness-hardening-progress-log.md`
- Audit hasil:
  - `public.telegram_assistant_sessions` punya `policy_count = 0`.
  - `storage.objects` untuk bucket `hrd_documents` punya 4 policy; SELECT policy menerima `anon` dan `authenticated`, sehingga bucket listing terlalu longgar untuk dokumen HRD.
  - Live public view count `7`, dan query audit tidak menemukan public view tanpa `security_invoker`.
- Validasi:
  - `rg -n "telegram_assistant_sessions|hrd_documents|multiple permissive|security_invoker|create policy|alter table .* enable row level security|storage.objects|public bucket" supabase/migrations docs`
  - `git diff --check -- docs/production-readiness-rls-storage-audit-2026-04-25.md docs/progress/production-readiness-hardening-progress-log.md`
- Risiko/regresi:
  - Tidak ada runtime risk karena task ini docs-only.
  - Risiko berikutnya ada jika bucket public dianggap aman hanya karena object URL bisa diakses; listing exposure tetap harus dibedakan dari access-by-URL.

## [2026-04-25] `PRH-L1-03` - Env, secret, and logging audit

- Status: `validated`
- Ringkasan:
  - Boundary env server/client sudah dipetakan; client hanya memakai publishable/anon key dan username bot, sedangkan secret sensitif tetap berada di server-side functions.
  - Tidak ditemukan secret literal atau raw request body yang bocor di log pada jalur yang diaudit, tetapi contract env produksi masih tersebar di fallback chain `VITE_*`.
  - Repo belum punya `.env.example`, jadi contract env tetap harus dibaca dari kode dan file env lokal yang ada.
- File berubah:
  - `docs/production-readiness-env-secret-logging-audit-2026-04-25.md`
  - `docs/progress/production-readiness-hardening-progress-log.md`
- Audit hasil:
  - `src/lib/supabase.js` dan `src/store/useTeamStore.js` tetap client-safe.
  - `api/auth.js`, `api/recycle-bin-retention.js`, `api/transactions.js`, `api/records.js`, `api/telegram-assistant.js`, `api/report-pdf-delivery.js`, dan `api/notify.js` memakai secret server-side tanpa indikasi ekspos ke browser.
  - Logging server yang ditemukan masih unstructured, tetapi tidak memperlihatkan `service_role`, `CRON_SECRET`, atau `TELEGRAM_BOT_TOKEN`.
- Validasi:
  - `rg -n "SUPABASE_|CRON_SECRET|VITE_|APP_AUTH_SECRET|TELEGRAM_BOT_TOKEN|console\\.(log|warn|error)|logger\\.|pino|winston|PRH-L1-03" docs/production-readiness-env-secret-logging-audit-2026-04-25.md docs/progress/production-readiness-hardening-progress-log.md src api`
  - `git diff --check -- docs/production-readiness-env-secret-logging-audit-2026-04-25.md docs/progress/production-readiness-hardening-progress-log.md`
- Risiko/regresi:
  - Fallback env server yang memakai `VITE_*` bisa membuat contract produksi terlalu implisit jika tidak didokumentasikan lebih lanjut.
  - Logging unstructured masih bisa tumbuh jadi noise atau bocor metadata jika ada perubahan server berikutnya.

## [2026-04-25] `PRH-L2-01` - Delete and restore integrity audit

- Status: `validated`
- Ringkasan:
  - Jalur recycle bin, restore, permanent delete, dan bulk permanent delete sudah dipetakan end-to-end dari UI ke server dan database.
  - Audit read-only live tidak menemukan orphan atau active child row yang tertinggal di bawah parent deleted untuk tree yang diperiksa.
  - Contract delete/restore utama sudah child-first atau guarded, sehingga state invalid tidak diam-diam lolos ke produksi.
- File berubah:
  - `docs/production-readiness-delete-restore-integrity-audit-2026-04-25.md`
  - `docs/progress/production-readiness-hardening-progress-log.md`
- Audit hasil:
  - `TransactionsRecycleBinPage` hanya menampilkan `Hapus Semua` untuk record eligible dan selalu refresh recycle bin + dashboard setelah mutation.
  - API wrapper mengirim action eksplisit, sedangkan server memvalidasi team/auth context dan memakai service client untuk hard delete.
  - SQL audit read-only menemukan `0` untuk semua kategori orphan/active-child yang dicek pada bill, loan, expense, attachment, dan stock-related tree.
- Validasi:
  - `rg -n "permanent-delete|permanent-delete-all-eligible|restore|Hapus Semua|refreshDashboard|recycle bin|permanentDelete" src/pages/TransactionsRecycleBinPage.jsx src/lib/transactions-api.js src/lib/records-api.js`
  - `rg -n "hardDeleteProjectIncome|hardDeleteLoan|hardDeleteBill|hardDeleteAttendance|hardDeleteLoanPayment|hardDeleteBillPaymentRecord|hardDeleteExpenseAttachmentRecord|restoreBill|softDeleteBill|softDeleteLoan|softDeleteProjectIncome|softDeleteExpense|restoreExpense|hardDeleteBillPayment|hardDeleteExpenseAttachment|softDeleteAttendance|restoreAttendance" api/transactions.js api/records.js`
  - `rg -n "fn_soft_delete_bill_with_history|fn_sync_fee_bills_from_project_income|on delete cascade|cascade" supabase/migrations/20260410224500_create_material_invoice_tables.sql supabase/migrations/20260410233000_add_bills_stock_automation.sql supabase/migrations/20260411120000_add_expense_status_and_paid_bill_automation.sql supabase/migrations/20260411143000_create_funding_creditors_and_income_loans_flow.sql supabase/migrations/20260418094000_soft_delete_bill_with_payment_history.sql supabase/migrations/20260418134500_add_team_scope_to_expense_child_collections.sql supabase/migrations/20260418094500_add_attachment_lifecycle_columns.sql supabase/migrations/20260420150000_create_vw_recycle_bin_records.sql supabase/migrations/20260411235900_final_schema_alignment_hrd_pdf_soft_delete.sql`
  - `mcp__supabase__.get_advisors` security + performance
  - `mcp__supabase__.execute_sql` audit orphan/active-child counts
  - `npx playwright test tests/e2e/restore.spec.js --reporter=line --workers=1` menghasilkan `15` lulus dan `3` gagal; kegagalan yang terlihat berupa timeout awal `page.goto` dan ekspektasi mock `teamId` yang tidak match dengan state auth aktif.
- Risiko/regresi:
  - Audit ini masih snapshot live; jika ada skema child baru di masa depan, tree integrity harus diaudit ulang sebelum permanent delete diperluas.
  - Bulk delete tetap destruktif, jadi mutation runtime berikutnya harus menjaga guard dan feedback error tetap eksplisit.
  - Smoke Playwright menampilkan mismatch test contract yang perlu difollow-up terpisah, tetapi tidak mengubah hasil audit data integrity ini.

## [2026-04-26] `PRH-L2-02` - Settlement integrity audit

- Status: `validated`
- Ringkasan:
  - Bill/payment settlement masih menunjukkan drift nyata pada snapshot live, terutama pada `fee` bills yang amount-nya `0` tetapi sudah memiliki payment aktif, serta beberapa `gaji` bills yang cache status-nya masih `unpaid` padahal payment total sudah masuk ke level `partial`.
  - Loan/payment settlement relatif sehat; hanya ada satu mismatch status pada snapshot yang diperiksa.
  - Attendance/payroll memiliki 2 row yang masih `unbilled` tetapi sudah punya `salary_bill_id`, sehingga boundary status dan link payroll belum sepenuhnya konsisten.
  - `vw_billing_stats` masih bisa drift karena dibangun dari cache `bills`, bukan dari payment rows langsung.
- File berubah:
  - `docs/production-readiness-settlement-integrity-audit-2026-04-26.md`
  - `docs/progress/production-readiness-hardening-progress-log.md`
- Audit hasil:
  - Bill live snapshot: `active_bill_count = 285`, `paid_amount_mismatch_count = 18`, `status_mismatch_count = 41`, `mismatch_count = 41` untuk contract health utama.
  - Bill type paling rawan: `fee` (`36` aktif, `16` mismatch status/amount) dan `gaji` (`133` aktif, `22` mismatch status).
  - Loan live snapshot: `active_loan_count = 47`, `paid_amount_mismatch_count = 0`, `status_mismatch_count = 1`.
  - Attendance live snapshot: `active_attendance_count = 1201`, `unbilled_with_bill_id_count = 2`.
  - Summary view drift ditemukan pada team `2213b84a-a513-47fa-afbb-8b99ae3b64be`.
- Validasi:
  - `mcp__supabase__.execute_sql` untuk bill, loan, attendance, dan `vw_billing_stats` reconciliation snapshot live
  - `git diff --check -- docs/production-readiness-settlement-integrity-audit-2026-04-26.md docs/progress/production-readiness-hardening-progress-log.md`
- Risiko/regresi:
  - Settlement drift ini berarti remediation task berikutnya harus berhati-hati agar tidak memperburuk cache bill atau payroll link.
  - `paid_at` tidak dipakai sebagai health signal utama karena contract timestamp-nya tidak cukup canonical di seluruh flow.

## [2026-04-26] `PRH-L2-03` - Attachment, report, and stock integrity audit

- Status: `validated`
- Ringkasan:
  - Attachment lifecycle untuk expense dan HRD secara umum bersih: tidak ada broken parent/file link, tidak ada team mismatch, dan PDF settings tidak menunjuk logo yang hilang.
  - Ada 1 active file asset yang tidak direferensikan oleh attachment, HRD document, atau PDF settings; ini menandakan cleanup permanen file asset belum tertutup di semua jalur.
  - Report views inti `vw_project_financial_summary` dan `vw_transaction_summary` match dengan recompute live snapshot, dan tidak ada deleted source row yang ikut mengganggu feed report.
  - Stock ledger structurally valid, tetapi `materials.current_stock` mismatch dengan net movement ledger pada 37 material di team yang sama; semua material mismatch dibuat pada `2026-04-23`.
- File berubah:
  - `docs/production-readiness-attachment-report-stock-integrity-audit-2026-04-26.md`
  - `docs/progress/production-readiness-hardening-progress-log.md`
- Audit hasil:
  - Attachment live snapshot: broken expense parent `0`, broken expense file `0`, broken HRD parent `0`, broken HRD file `0`, broken PDF header/footer `0`, active unreferenced file asset `1`.
  - Report live snapshot: `project_summary_mismatch_count = 0`, `transaction_summary_mismatch_count = 0`, deleted source counts semuanya `0`.
  - Stock live snapshot: `active_stock_transaction_count = 143`, `current_stock_mismatch_count = 37`, source types live `delivery_order`, `invoice`, dan legacy `out`.
  - All stock mismatches berada pada team `2213b84a-a513-47fa-afbb-8b99ae3b64be`.
- Validasi:
  - `mcp__supabase__.execute_sql` untuk attachment/file asset, report view, dan stock reconciliation snapshot live
  - `git diff --check -- docs/production-readiness-attachment-report-stock-integrity-audit-2026-04-26.md docs/progress/production-readiness-hardening-progress-log.md`
- Risiko/regresi:
  - Stock overview UI masih membaca `materials.current_stock`, jadi mismatch cache ini dapat memengaruhi keputusan inventory dan manual stock-out.
  - Active orphan-like file asset bisa menumpuk jika permanent delete attachment tidak ikut membersihkan file asset metadata / storage.

## [2026-04-26] `PRH-L2-04` - Migration drift triage

- Status: `validated`
- Ringkasan:
  - Local migration tree berisi `43` file, sedangkan remote migration history berisi `34` entry.
  - Tidak ada remote-only migration; drift yang tersisa berada di sisi lokal.
  - Empat migration adalah timestamp-equivalent rebase, sehingga bukan object drift melainkan histori yang bergeser timestamp.
  - Lima migration lokal benar-benar pending karena object live yang dirujuk belum ada, sedangkan tiga migration lokal sudah punya efek live dan hanya hilang dari history remote.
  - Satu migration hanya reload schema cache, jadi tidak perlu dianggap schema drift persisten.
- File berubah:
  - `docs/production-readiness-migration-drift-triage-2026-04-26.md`
  - `docs/progress/production-readiness-hardening-progress-log.md`
- Audit hasil:
  - Timestamp-equivalent: `create_vw_recycle_bin_records`, `update_workspace_transaction_sort_order`, `realign_workspace_transaction_sort_order_to_surface_time`, `create_telegram_assistant_sessions`.
  - Already-applied-out-of-band: `allow_absent_attendance_status`, `fix_project_income_fee_bill_unique_index`, `add_overtime_fee_to_attendance_records`.
  - Obsolete: `refresh_attendance_records_overtime_fee_schema_cache`.
  - Truly-pending: `add_is_active_to_expense_categories`, `reverse_material_invoice_stock_on_delete`, `add_unique_attendance_worker_date_project`, `backfill_payroll_snapshot_consistency`, `create_telegram_assistant_handoffs`.
- Validasi:
  - `Get-ChildItem supabase/migrations -File | Measure-Object`
  - `mcp__supabase__.list_migrations`
  - `mcp__supabase__.execute_sql` untuk object existence: column, constraint, index, function, table
  - `rg -n "expense_categories|reverse_material_invoice_stock_movement|allow_absent_attendance_status|overtime_fee|attendance_records_team_worker_date_project_key|bills_project_income_staff_key|telegram_assistant_handoffs" src api supabase/migrations`
  - `git diff --check -- docs/production-readiness-migration-drift-triage-2026-04-26.md docs/progress/production-readiness-hardening-progress-log.md`
- Risiko/regresi:
  - Migration yang benar-benar pending tetap harus diperlakukan sebagai backlog terpisah; jangan di-repair hanya karena file lokal sudah ada.
  - Object yang sudah applied out-of-band tetap perlu dicatat agar tidak ditumpuk ulang dalam history repair.

## [2026-04-26] `PRH-L2-05` - Advisor remediation list

- Status: `validated`
- Ringkasan:
  - Advisor Supabase terbaru diterjemahkan menjadi backlog yang eksplisit: security warning, policy/perf warning, FK coverage, dan unused index exception.
  - `telegram_assistant_sessions`, `hrd_documents`, dan leaked-password protection masuk daftar prioritas security.
  - `profiles`, `invite_tokens`, serta foreign key coverage di settlement/attendance/stock dipetakan sebagai action item bertahap.
  - Unused index warning sengaja tidak diperlakukan sebagai aksi destruktif tanpa workload evidence.
- File berubah:
  - `docs/production-readiness-advisor-remediation-list-2026-04-26.md`
  - `docs/progress/production-readiness-hardening-progress-log.md`
- Audit hasil:
  - Security findings terbaru: `rls_enabled_no_policy` pada `telegram_assistant_sessions`, `public_bucket_allows_listing` pada `hrd_documents`, dan `auth_leaked_password_protection`.
  - Performance findings terbaru: `auth_rls_initplan` pada `profiles` dan `invite_tokens`, `multiple_permissive_policies` pada `team_members`, `22` `unindexed_foreign_keys`, dan `14` `unused_index`.
  - Semua finding sudah dipetakan ke action item atau explicit exception sehingga backlog berikutnya bisa dieksekusi tanpa ambigu.
- Validasi:
  - `rg -n "PRH-L2-05|telegram_assistant_sessions|hrd_documents|auth_leaked_password_protection|unindexed_foreign_keys|unused_index|auth_rls_initplan|multiple_permissive_policies" docs/production-readiness-advisor-remediation-list-2026-04-26.md docs/progress/production-readiness-hardening-progress-log.md`
  - `git diff --check -- docs/production-readiness-advisor-remediation-list-2026-04-26.md docs/progress/production-readiness-hardening-progress-log.md`
- Risiko/regresi:
  - Ini masih dokumen triage; belum ada perubahan schema atau runtime.
  - Jika task runtime berikutnya mengubah policy atau index, advisor harus dijalankan ulang untuk memastikan warning-nya benar-benar turun.

## [2026-04-26] `PRH-L3-01` - Mutation error hardening

- Status: `validated`
- Ringkasan:
  - Jalur mutation server sekarang memverifikasi jumlah row yang benar-benar berubah, jadi silent no-op atau partial write tidak lagi dianggap sukses.
  - Mutation yang menyentuh derived state, delete tree, dan stock sync memakai assert row-count yang eksplisit pada update/delete/select path terkait.
  - Tidak ada perubahan schema, migration, atau kontrak data final; hardening dilakukan murni di level response dan guard server.
- File berubah:
  - `api/records.js`
  - `api/transactions.js`
  - `docs/progress/production-readiness-hardening-progress-log.md`
- Audit hasil:
  - `applyMaterialStockDelta`, `syncMaterialInvoiceStockMovement`, `syncMaterialInvoiceLineItems`, `rollbackExpense`, dan `persistAttendanceSheet` sekarang gagal eksplisit jika row yang diproses tidak sesuai ekspektasi.
  - `softDeleteProjectIncome`, `softDeleteLoan`, `restoreProjectIncome`, `restoreBill`, `hardDeleteProjectIncome`, `hardDeleteLoan`, `hardDeleteBill`, `hardDeleteAttendance`, `hardDeleteBillPaymentRecord`, dan `hardDeleteExpenseAttachmentRecord` sekarang memeriksa row-count agar child/parent write tidak diam-diam lolos.
  - Perubahan ini menutup gap antara error server dan status sukses yang sebelumnya masih bisa ambigu di jalur mutation tertentu.
- Validasi:
  - `node --check api/records.js`
  - `node --check api/transactions.js`
  - `npx eslint api/records.js api/transactions.js`
  - `npm run build`
  - `node --test tests/unit/transactions-project-income-aggregation.test.js tests/unit/transaction-delete.test.js`
- Risiko/regresi:
  - Row-count enforcement bisa menampakkan data drift lama sebagai error eksplisit, jadi beberapa flow lama mungkin perlu penyesuaian UI/error handling.
  - Jika client masih mengasumsikan mutation selalu sukses, user bisa melihat error yang sebelumnya tersembunyi; ini risiko yang diinginkan untuk hardening.
