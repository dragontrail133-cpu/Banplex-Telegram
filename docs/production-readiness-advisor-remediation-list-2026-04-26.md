# Production Readiness Advisor Remediation List - 2026-04-26

Audit baseline date: `2026-04-26`  
Stream: `Production Readiness Hardening`  
Task: `PRH-L2-05`

## Scope

Dokumen ini menerjemahkan advisor Supabase terbaru menjadi backlog yang bisa dieksekusi:

- action item yang perlu ditutup,
- dan exception yang sengaja didefer karena belum ada alasan yang cukup untuk mengubahnya.

Tidak ada runtime patch, migration, DDL/DML, atau deploy yang dijalankan.

## Evidence Basis

Sumber audit:

- `mcp__supabase__.get_advisors` security
- `mcp__supabase__.get_advisors` performance
- `docs/production-readiness-rls-storage-audit-2026-04-25.md`
- `docs/production-readiness-env-secret-logging-audit-2026-04-25.md`
- `docs/production-readiness-migration-drift-triage-2026-04-26.md`
- `docs/production-readiness-settlement-integrity-audit-2026-04-26.md`
- `docs/production-readiness-attachment-report-stock-integrity-audit-2026-04-26.md`

## Advisor Snapshot

| Area | Count | Catatan |
| --- | ---: | --- |
| Security `INFO` | 1 | `rls_enabled_no_policy` pada `public.telegram_assistant_sessions` |
| Security `WARN` | 2 | `public_bucket_allows_listing`, `auth_leaked_password_protection` |
| Performance `WARN` | 5 | `auth_rls_initplan` pada `profiles` dan `invite_tokens`, plus `multiple_permissive_policies` pada `team_members` |
| Performance `INFO` | 36 | `unindexed_foreign_keys` dan `unused_index` |
| Total advisor entries | 44 | Semua entry di atas dipetakan ke action item atau exception eksplisit |

## Remediation Map

### P0 - Security

| Finding | Level | Decision | Recommended action | Supabase remediation |
| --- | --- | --- | --- | --- |
| `public.telegram_assistant_sessions` has RLS enabled but no policies | `INFO` | Action item | Putuskan boundary final: kalau tabel ini server-only, pindahkan ke private schema atau dokumentasikan service-role-only access; kalau ada rencana client access, tambahkan policy eksplisit lebih dulu. | https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy |
| Public bucket `hrd_documents` allows broad listing | `WARN` | Action item | Hapus SELECT policy yang broad untuk `anon`/`authenticated`; object URL access tidak memerlukan listing, jadi gunakan policy yang lebih sempit atau signed URL. | https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing |
| Leaked password protection disabled | `WARN` | Action item | Aktifkan leaked password protection di Supabase Auth sebelum production hardening dianggap selesai. | https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection |

### P1 - Policy / RLS Performance

| Finding | Level | Decision | Recommended action | Supabase remediation |
| --- | --- | --- | --- | --- |
| `public.team_members` has multiple permissive `SELECT` policies | `WARN` | Action item | Review apakah `team_members_select_own` dan `team_members_select_owner_team` bisa digabung tanpa mengubah behavior; jika tidak, dokumentasikan sebagai policy shape yang diterima. | https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies |
| `public.profiles` policies trigger `auth_rls_initplan` | `WARN` | Action item | Ubah helper call `auth.<function>()` menjadi `(select auth.<function>())` pada policy yang aman untuk dioptimalkan, lalu benchmark ulang. | https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan |
| `public.invite_tokens` policies trigger `auth_rls_initplan` | `WARN` | Action item | Terapkan pola `select auth.<function>()` yang sama pada policy owner-team yang valid, dengan verifikasi behavior sebelum merge. | https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan |

### P2 - Foreign Key Coverage

| Table | Missing covering indexes | Decision | Recommended action | Supabase remediation |
| --- | --- | --- | --- | --- |
| `public.attendance_records` | `attendance_records_salary_bill_id_fkey` | Action item | Tambahkan covering index pada FK `salary_bill_id`. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |
| `public.bills` | `bills_staff_id_fkey`, `bills_supplier_id_fkey`, `bills_worker_id_fkey` | Action item | Tambahkan covering indexes pada ketiga FK ini; ini menyentuh jalur settlement yang aktif. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |
| `public.expenses` | `expenses_created_by_user_id_fkey` | Action item | Tambahkan covering index pada FK pembuat expense. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |
| `public.file_assets` | `file_assets_uploaded_by_user_id_fkey` | Action item | Tambahkan covering index pada FK uploader file asset. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |
| `public.hrd_applicants` | `hrd_applicants_source_beneficiary_id_fkey` | Action item | Tambahkan covering index pada FK source beneficiary. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |
| `public.invite_tokens` | `invite_tokens_created_by_fkey`, `invite_tokens_team_id_fkey` | Action item | Tambahkan covering indexes untuk create/update path invite token. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |
| `public.loans` | `loans_created_by_user_id_fkey` | Action item | Tambahkan covering index pada FK pembuat loan. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |
| `public.materials` | `materials_category_id_fkey` | Action item | Tambahkan covering index pada FK kategori material. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |
| `public.pdf_settings` | `pdf_settings_footer_logo_file_id_fkey`, `pdf_settings_header_logo_file_id_fkey`, `pdf_settings_updated_by_user_id_fkey` | Action item | Tambahkan covering indexes untuk logo file dan updated-by path. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |
| `public.project_incomes` | `project_incomes_created_by_user_id_fkey` | Action item | Tambahkan covering index pada FK pembuat project income. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |
| `public.stock_transactions` | `stock_transactions_created_by_user_id_fkey`, `stock_transactions_expense_id_fkey`, `stock_transactions_team_id_fkey` | Action item | Tambahkan covering indexes untuk mutation dan reporting path stock. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |
| `public.transactions` | `transactions_team_id_fkey` | Action item | Tambahkan covering index pada FK team transaksi. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |
| `public.worker_wage_rates` | `worker_wage_rates_project_id_fkey` | Action item | Tambahkan covering index pada FK project wage rate. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |
| `public.workers` | `workers_default_project_id_fkey`, `workers_profession_id_fkey` | Action item | Tambahkan covering indexes pada project/profession FK worker. | https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys |

### P3 - Explicit Exceptions for Unused Indexes

| Indexes | Decision | Reason for deferment |
| --- | --- | --- |
| `idx_telegram_assistant_sessions_telegram_user_id`, `idx_telegram_assistant_sessions_team_id`, `idx_telegram_assistant_sessions_expires_at` | Explicit exception | Table ini masih bisa tetap server-side; tidak ada bukti workload yang cukup untuk drop indexes hanya karena advisor belum melihat usage. |
| `idx_project_incomes_project_id` | Explicit exception | Index bisa saja dipakai pada beban produksi yang belum ter-capture; drop tanpa evidence lebih riskan daripada space overhead-nya. |
| `idx_expenses_telegram_user_id`, `idx_expenses_project_id` | Explicit exception | Keduanya lebih aman dipertahankan sampai ada query-plan dan workload evidence yang jelas. |
| `idx_bills_telegram_user_id` | Explicit exception | Jalur billing sensitif; pertahankan sampai ada bukti kuat bahwa index ini memang tidak diperlukan. |
| `idx_attendance_records_telegram_user_id` | Explicit exception | Attendance tetap area high-traffic dan index belum boleh di-drop hanya karena belum terpakai di snapshot advisor. |
| `idx_file_assets_bucket_name` | Explicit exception | Storage/file asset path sering variatif; pertahankan sampai ada bukti beban yang stabil. |
| `idx_hrd_applicants_status` | Explicit exception | Status filter bisa berubah pola pakainya; jangan drop tanpa telemetry. |
| `idx_hrd_applicant_documents_applicant_id`, `idx_hrd_applicant_documents_team_id` | Explicit exception | Document lookup masih berpotensi dipakai oleh flow HRD dan attachment audit. |
| `idx_beneficiaries_team_id` | Explicit exception | Team filter masih valid sebagai safety net sampai evidence menunjukkan index benar-benar redundant. |
| `idx_expense_line_items_team_id_expense_sort` | Explicit exception | Sorting/lookup expense line item cenderung workload-dependent; pertahankan. |

## Findings

- Ada 3 security finding yang harus ditutup atau diputuskan eksplisit sebelum production readiness dianggap aman.
- Ada 5 performance-warning yang layak dioptimalkan, tetapi dua di antaranya tetap murni policy-shape/perf, bukan kebocoran data.
- Ada 22 warning foreign-key coverage yang aman dijadikan backlog indeks bertahap.
- Ada 14 unused-index finding yang sengaja diperlakukan sebagai explicit exception karena belum ada workload evidence yang cukup untuk drop.

## Conclusion

`PRH-L2-05` selesai sebagai remediation map:

1. Security posture yang paling penting sekarang jelas: policy gap `telegram_assistant_sessions`, listing exposure `hrd_documents`, dan leaked-password protection.
2. Performance warning yang paling layak disentuh dulu adalah RLS initplan dan unindexed FK di jalur settlement, attendance, billing, dan stock.
3. Unused index warning tidak diubah menjadi aksi destruktif; statusnya explicit exception sampai ada bukti workload yang lebih kuat.

## Next Task

Rekomendasi lanjutannya adalah `PRH-L3-01` untuk mutation error hardening.
