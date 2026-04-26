# Production Readiness Auth and Guard Audit - 2026-04-25

Audit baseline date: `2026-04-25`  
Stream: `Production Readiness Hardening`  
Task: `PRH-L1-01`

## Scope

Audit ini fokus ke boundary auth dan guard end-to-end:

- route/UI guard,
- capability contract,
- auth bootstrap,
- server-side team access,
- cron auth,
- view/RLS boundary,
- dan advisor Supabase yang langsung memengaruhi security posture.

Tidak ada runtime patch, migration, DDL/DML, atau deploy yang dijalankan.

## Sources Reviewed

- `src/components/ProtectedRoute.jsx`
- `src/lib/capabilities.js`
- `src/lib/rbac.js`
- `src/lib/dev-auth-bypass.js`
- `src/store/useAuthStore.js`
- `api/auth.js`
- `api/records.js`
- `api/transactions.js`
- `api/recycle-bin-retention.js`
- `supabase/migrations/20260410144525_add_bill_payments_and_cash_mutation.sql`
- `supabase/migrations/20260411143000_create_funding_creditors_and_income_loans_flow.sql`
- `supabase/migrations/20260411170000_create_project_financial_summary_view.sql`
- `supabase/migrations/20260411190000_setup_telegram_auth_rbac_rls.sql`
- `supabase/migrations/20260411235900_final_schema_alignment_hrd_pdf_soft_delete.sql`
- `supabase/migrations/20260420090000_create_vw_workspace_transactions.sql`
- `supabase/migrations/20260420113000_create_vw_history_transactions.sql`
- `supabase/migrations/20260420150000_create_vw_recycle_bin_records.sql`
- Supabase advisors: security + performance
- Supabase schema + migration snapshot: `list_tables`, `list_migrations`

## Guard Matrix

| Layer | Current owner | Status | Evidence | Audit note |
| --- | --- | --- | --- | --- |
| Route/UI guard | `ProtectedRoute`, `capabilityContracts`, `hasRequiredRole` | `mostly aligned` | `src/components/ProtectedRoute.jsx`, `src/lib/capabilities.js`, `src/lib/rbac.js` | Capability-based screens are centralized; some admin surfaces masih memakai raw `allowedRoles` di route-level. |
| Auth bootstrap | `useAuthStore.initializeTelegramAuth()` + `/api/auth` | `aligned` | `src/store/useAuthStore.js`, `api/auth.js` | Telegram initData diverifikasi server-side, session Supabase dibentuk dari server, dan owner bypass hanya dari env yang dikontrol. |
| Dev bypass | `src/lib/dev-auth-bypass.js` + server localhost check | `aligned` | `src/lib/dev-auth-bypass.js`, `api/auth.js` | Bypass hanya aktif di `import.meta.env.DEV`; server menolak di luar localhost. |
| Server team access | `assertTeamAccess()` / `getAuthorizedContext()` | `aligned` | `api/transactions.js`, `api/records.js` | Jalur mutasi sensitif memaksa session valid lalu cek membership team sebelum write. |
| Capability gate server | `assertCapabilityAccess()` | `aligned` | `api/records.js`, `src/lib/capabilities.js` | Manual stock-out punya server-side capability check, bukan hanya UI gate. |
| Cron auth | `api/recycle-bin-retention.js` | `aligned` | `api/recycle-bin-retention.js` | Endpoint retention menuntut `CRON_SECRET` dan service-role key hanya dipakai server-side. |
| Public views | `security_invoker = true` | `aligned` | `supabase/migrations/20260420090000_create_vw_workspace_transactions.sql`, `supabase/migrations/20260420113000_create_vw_history_transactions.sql`, `supabase/migrations/20260420150000_create_vw_recycle_bin_records.sql`, `supabase/migrations/20260411170000_create_project_financial_summary_view.sql`, `supabase/migrations/20260411235900_final_schema_alignment_hrd_pdf_soft_delete.sql` | Canonical read views tidak terlihat sebagai bypass-RLS view; current ledger/report views sudah invoker-aware. |
| Transitional direct client | `useMasterStore`, `useHrStore`, `useTeamStore`, `useFileStore` | `transitional` | `src/store/useMasterStore.js`, `src/store/useHrStore.js`, `src/store/useTeamStore.js`, `src/store/useFileStore.js` | Masih ada boundary direct-client untuk domain fondasional / admin / file; ini exception terdokumentasi, bukan pola inti baru. |

## App-Level Findings

- `ProtectedRoute` mengunci akses berdasarkan role/capability dan `isRegistered`, sehingga gate UI tidak bergantung pada state yang kosong.
- `src/lib/capabilities.js` sudah memusatkan contract untuk `manual_stock_out`, `master_data_admin`, `team_invite`, dan `payroll_access`.
- `api/auth.js` tidak memakai `user_metadata` sebagai auth decision; metadata dipakai untuk profil/penamaan, sedangkan akses workspace diturunkan dari membership yang diverifikasi server.
- `api/transactions.js` dan `api/records.js` tidak mengandalkan UI guard untuk mutation sensitif; keduanya cek auth context dan membership di server.
- Canonical view read model yang dipakai app saat ini sudah dibuat dengan `security_invoker = true`, jadi risk default view bypass RLS tidak terlihat pada read model inti yang dipakai repo.

## Supabase Security Findings

| Finding | Severity | What it means | Follow-up bucket |
| --- | --- | --- | --- |
| `telegram_assistant_sessions` tanpa policy | `INFO` | RLS aktif tetapi belum ada policy pada tabel assistant session. Jika tabel tetap diekspos, boundary akses perlu dipertegas. | `PRH-L1-02` |
| `hrd_documents` public bucket listing | `WARN` | Bucket publik punya policy SELECT yang terlalu lebar dan memungkinkan listing file object. | `PRH-L1-02` |
| leaked-password protection disabled | `WARN` | Proteksi password bocor belum aktif di Auth. | `PRH-L1-03` |
| multiple permissive policies on `team_members` | `WARN` | Beberapa policy permissive SELECT berjalan bersamaan; ini lebih ke noise/perf, tapi tetap perlu dievaluasi. | `PRH-L1-02` / `PRH-L2-05` |
| `auth_rls_initplan` pada `profiles` dan `invite_tokens` | `WARN` | Policy auth masih re-evaluasi fungsi per row; aman secara contract, tetapi tidak efisien. | `PRH-L2-05` |

## Boundary Assessment

- Tidak ada indikasi bahwa service role diekspos ke browser.
- Tidak ada indikasi bahwa auth bootstrap mengandalkan `user_metadata` untuk authorization.
- Tidak ada indikasi view publik canonical membaca data dengan bypass RLS.
- Guard yang masih paling lemah adalah boundary direct-client transisional dan policy/security exposure yang dilaporkan advisor.

## Conclusion

`PRH-L1-01` memenuhi target audit: boundary auth dan guard utama sudah jelas, server-side access check sudah ada, dan helper capability terpusat dipakai di surface sensitif.

Yang masih harus dibawa ke task berikutnya:

- policy gap assistant session,
- exposure listing bucket `hrd_documents`,
- leaked-password protection,
- dan tuning policy/performance untuk `team_members`, `profiles`, dan `invite_tokens`.

## Next Task

Rekomendasi lanjutannya adalah `PRH-L1-02` untuk RLS, view, dan storage audit.
