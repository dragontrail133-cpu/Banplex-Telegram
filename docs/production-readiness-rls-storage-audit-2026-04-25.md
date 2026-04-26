# Production Readiness RLS, View, and Storage Audit - 2026-04-25

Audit baseline date: `2026-04-25`  
Stream: `Production Readiness Hardening`  
Task: `PRH-L1-02`

## Scope

Audit ini memeriksa tiga lapis yang paling sensitif terhadap exposure data:

- RLS policy pada tabel publik yang dipakai app,
- security posture view publik yang menjadi read model,
- dan storage bucket policy yang memengaruhi listing/upload object.

Tidak ada runtime patch, migration, DDL/DML, atau deploy yang dijalankan.

## Evidence Basis

Sumber audit:

- `mcp__supabase__.get_advisors` security + performance
- `mcp__supabase__.execute_sql` untuk `pg_policies`, `pg_class.reloptions`, dan `storage.buckets`
- `supabase/migrations/20260411173000_create_hrd_pipeline_and_beneficiaries.sql`
- `supabase/migrations/20260411190000_setup_telegram_auth_rbac_rls.sql`
- `supabase/migrations/20260411233000_add_magic_invites_and_owner_bypass.sql`
- `supabase/migrations/20260411235900_final_schema_alignment_hrd_pdf_soft_delete.sql`
- `supabase/migrations/20260420090000_create_vw_workspace_transactions.sql`
- `supabase/migrations/20260420113000_create_vw_history_transactions.sql`
- `supabase/migrations/20260420150000_create_vw_recycle_bin_records.sql`

## Live Snapshot

| Area | Live state | Audit meaning |
| --- | --- | --- |
| `public.telegram_assistant_sessions` | `RLS enabled`, `policy_count = 0` | Policy gap masih terbuka; aman dari akses anon/authenticated by default, tetapi belum punya access contract eksplisit. |
| `public.team_members` | 3 permissive policies | Ada overlap SELECT policy; aman secara fungsi, tetapi policy shape tidak minimal. |
| `public.profiles` | 2 permissive policies | Policy memakai `auth.uid()` langsung dan memicu `auth_rls_initplan` warning. |
| `public.invite_tokens` | 3 permissive policies | Security contract ada, tetapi helper chain masih memicu `auth_rls_initplan` warning. |
| `storage.buckets.hrd_documents` | `public = true` | Bucket memang publik. Karena itu policy listing harus sangat dibatasi, tetapi saat ini SELECT policy masih broad. |
| `storage.objects` for `hrd_documents` | `policy_count = 4` | Policy insert/update/delete ada, namun SELECT policy memperbolehkan `anon` dan `authenticated` listing semua object di bucket. |
| Public views | 7 views, `non-invoker count = 0` | Semua view publik yang diperiksa sudah invoker-aware; tidak ada view bypass-RLS yang terlihat di set view inti. |

## Policy Inventory

### `public.profiles`

- `profiles_select_own`: `SELECT`, role `authenticated`, qual `id = auth.uid()`
- `profiles_update_own`: `UPDATE`, role `authenticated`, qual/check `id = auth.uid()`

Audit:

- Contract akses jelas dan sempit.
- Warning performance `auth_rls_initplan` tetap valid karena `auth.uid()` dipakai langsung per policy row.

### `public.team_members`

- `team_members_select_own`: `SELECT`, role `authenticated`, qual `telegram_user_id = app_private.current_telegram_user_id()`
- `team_members_select_owner_team`: `SELECT`, role `authenticated`, qual `app_private.has_team_role(team_id, ARRAY['Owner'])`
- `team_members_update_owner_team`: `UPDATE`, role `authenticated`, qual/check `app_private.has_team_role(team_id, ARRAY['Owner'])`

Audit:

- Access model masuk akal: self-view + owner-view + owner update.
- Ada dua permissive SELECT policies; ini bukan breach, tetapi menambah policy surface dan noise evaluator.

### `public.invite_tokens`

- `invite_tokens_select_owner_team`: `SELECT`, role `authenticated`, qual `app_private.has_team_role(team_id, ARRAY['Owner'])`
- `invite_tokens_insert_owner_team`: `INSERT`, role `authenticated`, with check `app_private.has_team_role(team_id, ARRAY['Owner']) AND created_by = auth.uid()`
- `invite_tokens_update_owner_team`: `UPDATE`, role `authenticated`, qual/check owner team + `created_by = auth.uid()`

Audit:

- Boundary akses owner-only sudah benar.
- Warning `auth_rls_initplan` konsisten dengan helper chain `app_private.has_team_role()` → `app_private.current_telegram_user_id()` → `auth.uid()`. Ini lebih ke tuning/perf dan bukan indikasi exposure langsung.

### `public.telegram_assistant_sessions`

- `pg_policies` live return count `0`

Audit:

- Ini policy gap yang nyata.
- Karena tabel ini dipakai sebagai session memory assistant, isi gap ini sebaiknya ditutup dengan policy eksplisit sebelum surface baru dibuka ke read/write selain server internal.

### `storage.objects` untuk bucket `hrd_documents`

Live policy names:

- `hrd_documents_select` — `SELECT`, roles `{anon, authenticated}`, qual `bucket_id = 'hrd_documents'`
- `hrd_documents_insert` — `INSERT`, role `{authenticated}`, with check `bucket_id = 'hrd_documents'`
- `hrd_documents_update` — `UPDATE`, role `{authenticated}`, qual/check `bucket_id = 'hrd_documents'`
- `hrd_documents_delete` — `DELETE`, role `{authenticated}`, qual `bucket_id = 'hrd_documents'`

Audit:

- Ini policy set yang paling riskan di audit ini.
- Karena bucket public dan SELECT policy menerima `anon`, object listing menjadi terlalu luas untuk bucket yang berisi dokumen HRD.
- Bentuk ini menjelaskan advisor warning `public_bucket_allows_listing`.

## View Inventory

Public views live yang diperiksa:

- `vw_cash_mutation`
- `vw_transaction_summary`
- `vw_project_financial_summary`
- `vw_workspace_transactions`
- `vw_history_transactions`
- `vw_recycle_bin_records`
- `vw_billing_stats`

Live reloptions:

- Semua view di atas punya `security_invoker=true` atau `security_invoker=on`.
- Query live untuk public view lain tidak menemukan view `public` tanpa `security_invoker`.

Audit:

- Tidak ada view bypass-RLS yang terlihat di set public view inti.
- Ini berarti layer reporting/ledger yang dipakai app saat ini sudah berada di posture yang benar dari sisi view security.

## Findings

- `telegram_assistant_sessions` masih policy-less; ini harus tetap diperlakukan sebagai gap yang perlu contract eksplisit.
- `hrd_documents` adalah exposure paling jelas karena bucket public + SELECT policy broad listing.
- `profiles` dan `invite_tokens` aman secara fungsional, tetapi advisor performance warning masih valid.
- `team_members` punya multiple permissive SELECT policies; ini bukan kebocoran data, tetapi perlu dievaluasi jika target hardening berikutnya ingin merapikan policy surface.
- Public views canonical yang dipakai app aman dari bypass-RLS pada snapshot live yang diperiksa.

## Conclusion

`PRH-L1-02` menemukan dua hal yang paling penting untuk produksi:

1. **Gap policy** pada `telegram_assistant_sessions` yang belum punya policy eksplisit.
2. **Exposure storage** pada `hrd_documents` karena public bucket + SELECT policy yang memperbolehkan listing.

Selain itu, posture view publik sudah baik karena seluruh view inti yang diperiksa memakai `security_invoker`.

## Next Task

Rekomendasi lanjutannya adalah `PRH-L1-03` untuk env, secret, dan logging audit.
