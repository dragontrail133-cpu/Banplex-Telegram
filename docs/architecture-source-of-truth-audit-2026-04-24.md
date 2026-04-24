# Architecture Source-of-Truth Audit - 2026-04-24

## Status

Phase 0 read-only source-code audit completed on 2026-04-24.

Scope executed:

- Read-only audit of `src/`, `api/`, `supabase/migrations/`, and `docs/`.
- Supabase MCP read-only checks for public tables, views, functions, and migration history.
- Documentation update only in this file.

Explicit non-actions:

- No code patch.
- No migration.
- No refactor.
- No dependency install.
- No UI change.

## Executive Summary

The app is mostly integrated around relational Supabase tables and Vercel Serverless wrappers, but the source of truth is not uniform across all domains. Workspace, history, recycle bin, reporting, stock-out, attendance recap, and PDF settings mostly route through API wrappers. Master data, file storage, HRD, team invite, some income/loan reads, and one legacy payroll component still use the browser Supabase client directly.

The highest source-of-truth risks found in source code are:

- Dashboard/transaction summary is mixed: `api/transactions.js` recomputes cash summary from raw tables, while reporting uses canonical views such as `vw_cash_mutation`, `vw_project_financial_summary`, and `vw_billing_stats`.
- Payment status is mixed: database triggers exist, but server code also recalculates/syncs bill and loan status during payment mutations.
- Payroll recap has two paths in code: active `PayrollPage` uses `/api/records?resource=attendance-recap`, while unused `PayrollManager` still calls `supabase.rpc('fn_generate_salary_bill')` directly.
- Local migration files do not match Supabase remote migration history. Local has 43 files, remote history has 34 entries, with 13 local-only files and 4 remote-only timestamp variants.
- Long-list behavior is split between server cursor pagination for transaction/history/recycle-bin pages and client-side slicing via `SmartList` for smaller in-memory lists.

## Repository Structure

| Area | Actual Path | Evidence | Notes |
|---|---|---|---|
| React app root | `src/App.jsx`, `src/main.jsx` | `src/main.jsx:5`, `src/App.jsx:202` | `BrowserRouter` wraps `App`; routes declared with `Routes` and lazy pages. |
| Pages | `src/pages/` | `src/App.jsx:218`, `src/App.jsx:304` | Main app pages include dashboard, transactions, payment, payroll, stock, projects, master, and recycle bin. |
| Components | `src/components/`, `src/components/ui/`, `src/components/layouts/` | `src/components/ui/SmartList.jsx:16`, `src/components/layouts/MainLayout.jsx` | Shared UI primitives, layouts, forms, report, payroll, attachment, and list components. |
| Hooks | `src/hooks/` | `src/App.jsx:13`, `src/App.jsx:14` | Telegram SDK and Telegram theme sync hooks. |
| Stores | `src/store/` | `src/store/useDashboardStore.js:73`, `src/store/useReportStore.js:50` | Zustand stores hold auth, dashboard, transactions, master, payment, attendance, report, file, HR, team, toast, and app state. |
| Client data layer | `src/lib/` | `src/lib/transactions-api.js:13`, `src/lib/records-api.js:3`, `src/lib/reports-api.js:3` | API wrappers plus presentation, PDF, business report, auth session, and utility modules. |
| Supabase client | `src/lib/supabase.js` | `src/lib/supabase.js:10` | Browser client uses `VITE_SUPABASE_URL` and publishable or anon key. |
| Serverless functions | `api/` | `api/auth.js:631`, `api/records.js:5602`, `api/transactions.js:3619` | Vercel functions for auth, records, transactions, notify, assistant, handoff, and report PDF delivery. |
| Local migrations | `supabase/migrations/` | `supabase/migrations/20260410144525_add_bill_payments_and_cash_mutation.sql`, `supabase/migrations/20260423120000_create_telegram_assistant_handoffs.sql` | 43 local migration files. |
| Architecture docs | `docs/` | `docs/ai-workflow/`, `docs/freeze/`, `docs/progress/`, `docs/prd/` | Planning, workflow, freeze, handoff, progress, PRD, and audit docs. |

No nested `AGENTS.md` was found under `src/`, `api/`, or `docs/`; root instructions apply.

## Package Scripts

| Script | Command | Audit Note |
|---|---|---|
| `dev` | `vite` | Frontend local dev server. |
| `dev:api` | `vercel dev --listen 127.0.0.1:3000 --yes` | Local Vercel API runtime. |
| `build` | `vite build` | Production frontend bundle validation. |
| `lint` | `eslint .` | Repo lint validation. |
| `preview` | `vite preview` | Built app preview. |
| `test:e2e` | `playwright test` | Playwright e2e suite. |
| `test:e2e:live` | `playwright test --config=playwright.live.config.js` | Live e2e config. |
| `test:e2e:headed` | `playwright test --headed` | Headed Playwright. |
| `test:e2e:ui` | `playwright test --ui` | Playwright UI mode. |
| `aq:verify:live` | `node scripts/aq/verify-live-smoke.mjs` | Live AQ smoke verification. |

Evidence: `package.json`.

## Route and Page Map

| Route | Page/Component | Evidence | Source-of-Truth Relevance |
|---|---|---|---|
| `/` | `src/pages/Dashboard.jsx` | `src/App.jsx:218` | Dashboard reads transaction summary/workspace and project reporting stores. |
| `/transactions` | `src/pages/TransactionsPage.jsx` | `src/App.jsx:228`, `src/pages/TransactionsPage.jsx:356` | Workspace ledger list uses `/api/transactions?view=workspace`. |
| `/transactions/history`, `/history`, `/riwayat` | Redirect to `/transactions?tab=history` | `src/App.jsx:229`, `src/App.jsx:258`, `src/App.jsx:259` | History tab source is `vw_history_transactions` through API. |
| `/transactions/recycle-bin` | `src/pages/TransactionsRecycleBinPage.jsx` | `src/App.jsx:230`, `src/pages/TransactionsRecycleBinPage.jsx:186` | Recycle-bin list uses `/api/transactions?view=recycle-bin`. |
| `/transactions/:transactionId` | `src/pages/TransactionDetailPage.jsx` | `src/App.jsx:235`, `src/pages/TransactionDetailPage.jsx:333` | Detail fetches workspace or history record by ID. |
| `/edit/:type/:id` | `src/pages/EditRecordPage.jsx` | `src/App.jsx:271` | Edit routes dispatch to domain stores/API based on record type. |
| `/payment/:id`, `/loan-payment/:id` | `src/pages/PaymentPage.jsx` | `src/App.jsx:280`, `src/App.jsx:291` | Bill and loan payments use payment store plus records/transactions API wrappers. |
| `/pembayaran` | `src/pages/PaymentsPage.jsx` | `src/App.jsx:237`, `src/pages/PaymentsPage.jsx:394` | Payment hub reads unpaid bills, loans, workspace transactions, and deleted payments. |
| `/payroll` | `src/pages/PayrollPage.jsx` | `src/App.jsx:219`, `src/pages/PayrollPage.jsx:138` | Active payroll recap uses `/api/records?resource=attendance-recap`. |
| `/payroll/worker/:workerId` | `src/pages/PayrollWorkerDetailPage.jsx` | `src/App.jsx:220`, `src/pages/PayrollWorkerDetailPage.jsx:215` | Worker attendance history reads records API. |
| `/attendance/new` | `src/pages/AttendancePage.jsx` | `src/App.jsx:265` | Attendance form reads/writes through `useAttendanceStore` and records API. |
| `/stock` | `src/pages/StockPage.jsx` | `src/App.jsx:253`, `src/pages/StockPage.jsx:398` | Stock overview and manual stock-out use records API. |
| `/projects` | `src/pages/ProjectsPage.jsx` + `src/components/ProjectReport.jsx` | `src/App.jsx:244`, `src/pages/ProjectsPage.jsx:42` | Reporting source is `/api/records?resource=reports`. |
| `/projects/pdf-settings` | `src/pages/ProjectPdfSettingsPage.jsx` | `src/App.jsx:245`, `src/pages/ProjectPdfSettingsPage.jsx:282` | PDF settings source is `/api/records?resource=pdf-settings`. |
| `/master`, `/master/:tab/add`, `/master/:tab/edit/:id` | `src/pages/MasterPage.jsx`, `src/pages/MasterFormPage.jsx` | `src/App.jsx:254`, `src/App.jsx:302`, `src/App.jsx:303` | Master data mostly uses browser Supabase client in `useMasterStore`. |
| `/material-invoice/new`, `/material-invoice/:id` | `src/pages/MaterialInvoicePage.jsx`, redirect detail page | `src/App.jsx:257`, `src/App.jsx:270` | Material invoice create/edit uses records API; detail redirects to transaction detail. |
| `/more/hrd`, `/more/beneficiaries`, `/more/team-invite` | HRD, beneficiaries, team invite pages | `src/App.jsx:267`, `src/App.jsx:268`, `src/App.jsx:269` | HRD and team invite use direct Supabase client stores. |

## Zustand Store Audit

| Store | Server-Derived State | Mutation Path | Evidence | Source-of-Truth Classification |
|---|---|---|---|---|
| `useAuthStore` | User, memberships, selected team, role | `/api/auth`, Supabase auth session, invite RPC | `src/store/useAuthStore.js:153`, `src/store/useAuthStore.js:188`, `src/store/useAuthStore.js:214` | Mixed API + browser Supabase auth. |
| `useDashboardStore` | Summary, cash mutations, workspace transactions | `/api/transactions` | `src/store/useDashboardStore.js:86`, `src/store/useDashboardStore.js:104`, `src/store/useDashboardStore.js:115` | API-backed, but summary calculation is not the same path as reporting views. |
| `useReportStore` | Project summaries, report data, PDF settings | `/api/records` reports/pdf-settings, client PDF generation | `src/store/useReportStore.js:118`, `src/store/useReportStore.js:178`, `src/store/useReportStore.js:281`, `src/store/useReportStore.js:361` | API-backed for data, client-side for PDF export. |
| `useTransactionStore` | Expense/material invoice submit state and fetched detail | `/api/records` resources | `src/store/useTransactionStore.js:331`, `src/store/useTransactionStore.js:465`, `src/store/useTransactionStore.js:622` | API-backed for expenses/material invoices. |
| `useIncomeStore` | Loans plus project income mutations | Direct Supabase reads + `/api/transactions` writes | `src/store/useIncomeStore.js:196`, `src/store/useIncomeStore.js:241`, `src/store/useIncomeStore.js:480`, `src/store/useIncomeStore.js:907` | Mixed direct client reads and API writes. |
| `usePaymentStore` | Payment submit state only | `/api/records` for bill payments, `/api/transactions` for loan payments | `src/store/usePaymentStore.js:377`, `src/store/usePaymentStore.js:500`, `src/store/usePaymentStore.js:574` | Split API ownership by payment type. |
| `useBillStore` | Unpaid bills and bill detail | `/api/records` | `src/store/useBillStore.js:30`, `src/store/useBillStore.js:57` | API-backed. |
| `useAttendanceStore` | Attendance sheet, unbilled attendances | `/api/records` | `src/store/useAttendanceStore.js:52`, `src/store/useAttendanceStore.js:128`, `src/store/useAttendanceStore.js:163`, `src/store/useAttendanceStore.js:207` | API-backed. |
| `useMasterStore` | Projects, categories, suppliers, workers, materials, staff, creditors | Direct Supabase client and worker RPC | `src/store/useMasterStore.js:264`, `src/store/useMasterStore.js:588`, `src/store/useMasterStore.js:615` | Direct client source. |
| `useFileStore` | Uploaded file assets and upload queue | Supabase Storage + `file_assets` table | `src/store/useFileStore.js:167`, `src/store/useFileStore.js:216`, `src/store/useFileStore.js:270`, `src/store/useFileStore.js:498` | Direct client storage/table source. |
| `useHrStore` | HR applicants, documents, beneficiaries | Direct Supabase client | `src/store/useHrStore.js:170`, `src/store/useHrStore.js:210`, `src/store/useHrStore.js:450`, `src/store/useHrStore.js:981` | Direct client source. |
| `useTeamStore` | Team members and invite token | Direct Supabase client | `src/store/useTeamStore.js:114`, `src/store/useTeamStore.js:143`, `src/store/useTeamStore.js:220`, `src/store/useTeamStore.js:273` | Direct client source. |
| `useAppStore` | Telegram user only | Local state | `src/store/useAppStore.js:3` | UI/session state only. |
| `useToastStore` | Toast only | Local state | `src/store/useToastStore.js:67` | UI state only. |

## Service and Data-Access Layer

| Module | Responsibility | Evidence | Notes |
|---|---|---|---|
| `src/lib/transactions-api.js` | Client wrapper for `/api/transactions` | `src/lib/transactions-api.js:13` | Handles workspace/history/recycle list, transaction save/restore/delete, and loan payment actions. |
| `src/lib/records-api.js` | Client wrapper for `/api/records` | `src/lib/records-api.js:3` | Handles attachments, stock, bills, bill payments, expenses, material invoices, attendance, and attendance recap. |
| `src/lib/reports-api.js` | Client wrapper for reports and PDF settings under `/api/records` | `src/lib/reports-api.js:42`, `src/lib/reports-api.js:90` | Reporting data source for `useReportStore`. |
| `src/lib/report-delivery-api.js` | Client wrapper for `/api/report-pdf-delivery` | `src/lib/report-delivery-api.js:25` | Sends generated business report PDF to Telegram DM. |
| `src/lib/auth-session.js` | Reads Supabase browser auth token/session | `src/lib/auth-session.js:20`, `src/lib/auth-session.js:102` | Used by API client wrappers. |
| `src/lib/supabase.js` | Browser Supabase client factory | `src/lib/supabase.js:10` | Direct client remains in several stores and one unused component. |
| `src/lib/report-pdf.js` | Payment receipt and business report PDF templates | `src/lib/report-pdf.js:410`, `src/lib/report-pdf.js:1309`, `src/lib/report-pdf.js:1724` | Client/server importable PDF generation using `jsPDF` and `jspdf-autotable`. |
| `src/lib/transaction-presentation.js` | Ledger labels, badges, routes, grouping helpers | `src/lib/transaction-presentation.js:938`, `src/lib/transaction-presentation.js:993`, `src/lib/transaction-presentation.js:1065` | Presentation layer derives UI labels/routes from normalized transaction rows. |
| `src/lib/recycle-bin-state.js` | Local state persistence for recycle-bin list | `src/lib/recycle-bin-state.js:7`, `src/lib/recycle-bin-state.js:32` | Session/local storage state, not DB source. |

## Supabase Client Usage

Browser Supabase client is configured in `src/lib/supabase.js:10`.

Direct browser Supabase usage found:

- Auth and session: `src/store/useAuthStore.js:214`, `src/lib/auth-session.js:20`.
- Master data: `src/store/useMasterStore.js:264`, `src/store/useMasterStore.js:588`, `src/store/useMasterStore.js:615`.
- Income/loan reads and supporting checks: `src/store/useIncomeStore.js:196`, `src/store/useIncomeStore.js:241`, `src/store/useIncomeStore.js:432`, `src/store/useIncomeStore.js:664`.
- HRD/beneficiaries: `src/store/useHrStore.js:170`, `src/store/useHrStore.js:210`, `src/store/useHrStore.js:981`.
- File storage/assets: `src/store/useFileStore.js:167`, `src/store/useFileStore.js:270`, `src/store/useFileStore.js:498`.
- Team invite/member management: `src/store/useTeamStore.js:114`, `src/store/useTeamStore.js:143`, `src/store/useTeamStore.js:322`.
- Legacy/unused payroll manager: `src/components/PayrollManager.jsx:254`.

API/server Supabase usage found:

- `api/auth.js` creates service-role and public clients, then reads/writes `profiles`, `teams`, and `team_members`: `api/auth.js:230`, `api/auth.js:239`, `api/auth.js:303`, `api/auth.js:485`, `api/auth.js:594`.
- `api/transactions.js` reads canonical workspace/history/recycle views and mutates project income, loans, bills, attendance, and loan payments: `api/transactions.js:455`, `api/transactions.js:1728`, `api/transactions.js:1871`, `api/transactions.js:1907`.
- `api/records.js` handles records, reports, stock, payments, attendance, and PDF settings with service-role/public clients: `api/records.js:678`, `api/records.js:1891`, `api/records.js:2094`, `api/records.js:3815`, `api/records.js:4285`, `api/records.js:5522`.
- `api/telegram-assistant.js` reads assistant sessions, workspace transactions, cash mutation view, attendance, workers, suppliers, creditors: `api/telegram-assistant.js:1054`, `api/telegram-assistant.js:2875`, `api/telegram-assistant.js:3315`, `api/telegram-assistant.js:3360`.
- `api/telegram-assistant-handoff.js` writes/reads `telegram_assistant_handoffs`: `api/telegram-assistant-handoff.js:107`, `api/telegram-assistant-handoff.js:149`.

## Vercel Serverless Functions

| Function | Method/Entry Evidence | Primary Responsibility | Supabase/Data Evidence |
|---|---|---|---|
| `api/auth.js` | `api/auth.js:631` | Verify Telegram Mini App auth, bootstrap Supabase auth session, profile, team membership. | `api/auth.js:303`, `api/auth.js:485`, `api/auth.js:594` |
| `api/transactions.js` | `api/transactions.js:3619` | Workspace/history/recycle list, cash summary, transaction create/edit/delete/restore, loan payments. | `api/transactions.js:1871`, `api/transactions.js:1907`, `api/transactions.js:3883`, `api/transactions.js:4038` |
| `api/records.js` | `api/records.js:5602` | Bills, bill payments, expenses, material invoices, attachments, stock, attendance, reporting, PDF settings. | `api/records.js:5726`, `api/records.js:6034`, `api/records.js:6221`, `api/records.js:6466`, `api/records.js:6624`, `api/records.js:6738` |
| `api/notify.js` | `api/notify.js:1335` | Telegram notification and several PDF payload builders for transaction/payment notifications. | `api/notify.js:333`, `api/notify.js:462`, `api/notify.js:1345` |
| `api/report-pdf-delivery.js` | `api/report-pdf-delivery.js:266` | Generate business report PDF server-side fallback and send Telegram DM. | `api/report-pdf-delivery.js:76`, `api/report-pdf-delivery.js:119`, `api/report-pdf-delivery.js:202` |
| `api/telegram-assistant.js` | `api/telegram-assistant.js:5762` | Telegram assistant webhook/intents/analytics/session context. | `api/telegram-assistant.js:1054`, `api/telegram-assistant.js:2875`, `api/telegram-assistant.js:3315` |
| `api/telegram-assistant-handoff.js` | `api/telegram-assistant-handoff.js:107`, `api/telegram-assistant-handoff.js:149` | Create and consume assistant handoff tokens. | `api/telegram-assistant-handoff.js:107`, `api/telegram-assistant-handoff.js:149` |

## PDF Utilities and Templates

| PDF Flow | UI/API Entrypoint | Template Utility | Settings/Data Source | Evidence |
|---|---|---|---|---|
| Bill/loan payment receipt | `src/pages/TransactionDetailPage.jsx`, `src/pages/PaymentsPage.jsx` | `createPaymentReceiptPdf`, `savePaymentReceiptPdf` | Current bill/loan/payment payload from page/store | `src/pages/TransactionDetailPage.jsx:752`, `src/pages/PaymentsPage.jsx:710`, `src/lib/report-pdf.js:410`, `src/lib/report-pdf.js:573` |
| Business report browser download | `src/components/ProjectReport.jsx` -> `useReportStore` | `saveBusinessReportPdf` | `/api/records?resource=reports` and `/api/records?resource=pdf-settings` | `src/components/ProjectReport.jsx:333`, `src/store/useReportStore.js:361`, `src/lib/report-pdf.js:1309`, `src/lib/report-pdf.js:1724` |
| Business report Telegram DM | `src/components/ProjectReport.jsx` -> `useReportStore` -> `/api/report-pdf-delivery` | `createBusinessReportPdf` imported server-side | Client sends `reportData` + `pdfSettings` | `src/components/ProjectReport.jsx:339`, `src/store/useReportStore.js:402`, `api/report-pdf-delivery.js:2`, `api/report-pdf-delivery.js:301` |
| Notification PDFs | `/api/notify` | Local functions in `api/notify.js` plus shared report-pdf helpers | Payload submitted to notify endpoint | `api/notify.js:333`, `api/notify.js:462`, `api/notify.js:1158`, `api/notify.js:1181` |
| PDF settings and logos | `src/pages/ProjectPdfSettingsPage.jsx` | Business report PDF setting normalizer | `pdf_settings` joined to `file_assets` | `src/pages/ProjectPdfSettingsPage.jsx:282`, `src/store/useReportStore.js:281`, `api/records.js:5522`, `api/records.js:5588` |

## Long-List Components and Pagination

| List Surface | Data Loading Model | Evidence | Audit Note |
|---|---|---|---|
| Workspace transactions | Server cursor pagination via `/api/transactions?view=workspace` | `src/pages/TransactionsPage.jsx:356`, `src/pages/TransactionsPage.jsx:696`, `api/transactions.js:1871` | Uses `pageInfo.nextCursor`, search, and filter. |
| History transactions | Server cursor pagination via `/api/transactions?view=history` | `src/pages/HistoryPage.jsx:218`, `src/pages/HistoryPage.jsx:375`, `api/transactions.js:1907` | Maintains local list state with filter/search/page info. |
| Recycle bin | Server cursor pagination via `/api/transactions?view=recycle-bin` | `src/pages/TransactionsRecycleBinPage.jsx:186`, `src/pages/TransactionsRecycleBinPage.jsx:360`, `api/transactions.js:455` | Uses separate `recycle-bin-state` persistence. |
| Dashboard recent items | Client slicing via `SmartList` over already loaded recent items | `src/pages/Dashboard.jsx:612`, `src/components/ui/SmartList.jsx:16` | Small list; source data comes from dashboard/report stores. |
| Attendance sheet | Client filtering/slicing via `SmartList` | `src/components/AttendanceForm.jsx:1339`, `src/components/ui/SmartList.jsx:24` | In-memory sheet rows; no virtualization. |
| Stock page | In-memory filtering/sorting | `src/pages/StockPage.jsx:398`, `src/pages/StockPage.jsx:516` | Stock overview API limits recent stock transactions to 8 by default. |

## Reporting Views and RPC Usage

Confirmed remote public views from Supabase MCP:

- `vw_billing_stats`
- `vw_cash_mutation`
- `vw_history_transactions`
- `vw_project_financial_summary`
- `vw_recycle_bin_records`
- `vw_transaction_summary`
- `vw_workspace_transactions`

Confirmed remote public functions from Supabase MCP include:

- `fn_auto_create_bill_from_expense`
- `fn_auto_update_stock_from_line_item`
- `fn_build_loan_terms_snapshot`
- `fn_create_atomic_manual_stock_out`
- `fn_generate_salary_bill`
- `fn_redeem_invite_token`
- `fn_reverse_material_invoice_stock_movement`
- `fn_soft_delete_bill_with_history`
- `fn_soft_delete_worker`
- `fn_sync_fee_bills_from_project_income`
- `fn_sync_file_assets_columns`
- `fn_sync_loan_terms_snapshot`
- `fn_update_bill_status_on_payment`
- `fn_update_loan_status_on_payment`
- `fn_upsert_worker_with_wages`
- `propagate_expense_team_id_to_children`
- `sync_expense_child_team_id`

Source-code view/RPC usage:

| Usage | Source Evidence | Data Source |
|---|---|---|
| Workspace ledger | `api/transactions.js:1871` | `vw_workspace_transactions` |
| History ledger | `api/transactions.js:1907` | `vw_history_transactions` |
| Recycle bin | `api/transactions.js:455` | `vw_recycle_bin_records` |
| Project summaries | `api/records.js:4285` | `vw_project_financial_summary` |
| Project detail summary | `api/records.js:4324` | `vw_project_financial_summary` plus raw detail tables |
| Cash-flow report | `api/records.js:4476` | `vw_cash_mutation` |
| Billing stats report | `api/records.js:4503` | `vw_billing_stats` |
| Soft-delete bill with history | `api/records.js:1891` | `fn_soft_delete_bill_with_history` |
| Manual stock-out | `api/records.js:2094` | `fn_create_atomic_manual_stock_out` |
| Attendance recap salary bill | `api/records.js:3815` | `fn_generate_salary_bill` |
| Material invoice stock reversal | `api/records.js:473` | `fn_reverse_material_invoice_stock_movement` |
| Worker upsert/delete | `src/store/useMasterStore.js:588`, `src/store/useMasterStore.js:615` | `fn_upsert_worker_with_wages`, `fn_soft_delete_worker` |
| Invite redemption | `src/store/useAuthStore.js:125` | `fn_redeem_invite_token` |

## Source-of-Truth Matrix

| Flow | UI Route/Component | Zustand State | Client Data Layer | Server/API Evidence | Final DB Source | Status | Risk/Recommendation |
|---|---|---|---|---|---|---|---|
| Auth/session/team membership | `src/App.jsx:153`, `src/components/ProtectedRoute.jsx` | `src/store/useAuthStore.js:153` | `src/lib/auth-session.js:20`, `src/lib/supabase.js:10` | `api/auth.js:631`, `api/auth.js:303`, `api/auth.js:485`, `api/auth.js:594` | Supabase Auth, `profiles`, `teams`, `team_members`, `invite_tokens` | Mixed | Keep `/api/auth` as auth bootstrap source. Direct browser auth is expected for session token, but membership source should remain `team_members`. |
| Dashboard summary | `src/pages/Dashboard.jsx:203`, `src/pages/Dashboard.jsx:255` | `src/store/useDashboardStore.js:86` | `src/lib/transactions-api.js:143` | `api/transactions.js:639`, `api/transactions.js:1566`, `api/transactions.js:3822` | Raw `project_incomes`, `loans`, `bill_payments`, `loan_payments`; reporting also has `vw_cash_mutation` | Mixed | High duplicate-calculation risk. Consider aligning dashboard cash summary to the same canonical view/reporting contract after approval. |
| Dashboard recent workspace items | `src/pages/Dashboard.jsx:211`, `src/pages/Dashboard.jsx:612` | `src/store/useDashboardStore.js:115` | `src/lib/transactions-api.js:53` | `api/transactions.js:1871` | `vw_workspace_transactions` | Aligned | Read source is canonical view. |
| Workspace transaction list | `src/pages/TransactionsPage.jsx:48`, `src/pages/TransactionsPage.jsx:356` | Page local state + warm seed from `useDashboardStore` | `src/lib/transactions-api.js:64` | `api/transactions.js:1871`, `api/transactions.js:3765`, `api/transactions.js:3801` | `vw_workspace_transactions` | Aligned for read | Pagination/search/filter are server-side. Mutations still split by domain. |
| History transaction list | `src/pages/HistoryPage.jsx:35`, `src/pages/HistoryPage.jsx:218` | Page local state | `src/lib/transactions-api.js:105` | `api/transactions.js:1907`, `api/transactions.js:3707`, `api/transactions.js:3743` | `vw_history_transactions` | Aligned for read | Route alias redirects to transaction tab; dedicated `HistoryPage` still exists but route is redirected in `App`. |
| Transaction detail | `src/pages/TransactionDetailPage.jsx:333` | `useDashboardStore` refresh hooks | `src/lib/transactions-api.js:90`, `src/lib/transactions-api.js:131`, `src/lib/records-api.js:355` | `api/transactions.js:1882`, `api/transactions.js:1901` | Workspace/history views plus material invoice detail source tables | Mixed | Detail blends view rows and extra source-table detail for material invoice. Document field ownership before changing detail/edit. |
| Create expense | `src/components/ExpenseForm.jsx:110`, `src/store/useTransactionStore.js:322` | `useTransactionStore` submit state | `src/lib/records-api.js:268` | `api/records.js:6034`, `api/records.js:6084` | `expenses`, `bills`, `expense_attachments`, trigger-backed bill logic | API-backed | Keep API as write boundary. Verify server remains owner for bill/status side effects. |
| Edit expense | `src/pages/EditRecordPage.jsx:88`, `src/components/ExpenseForm.jsx:111` | `useTransactionStore` submit state | `src/lib/records-api.js:301` | `api/records.js:6034`, `api/records.js:6084`, `api/records.js:6191` | `expenses`, `bills`, `expense_attachments` | API-backed | Optimistic concurrency exists in API paths. Avoid direct client writes for this flow. |
| Create/edit material invoice | `src/components/MaterialInvoiceForm.jsx:201`, `src/components/MaterialInvoiceForm.jsx:205` | `useTransactionStore` submit state | `src/lib/records-api.js:340`, `src/lib/records-api.js:379` | `api/records.js:6221`, `api/records.js:6272`, `api/records.js:6387`, `api/records.js:473` | `expenses`, `expense_line_items`, `bills`, `stock_transactions`, `materials` | API-backed | Stock reversal/sync is server-owned. Keep material invoice writes in records API. |
| Project income create/edit | `src/components/IncomeForm.jsx:126`, `src/store/useIncomeStore.js:409`, `src/store/useIncomeStore.js:507` | `useIncomeStore` | `src/lib/transactions-api.js:225` | `api/transactions.js:2631`, `api/transactions.js:3359`, `api/transactions.js:3443` | `project_incomes`, fee `bills` via DB/API sync | Mixed | Writes use API, but store reads/checks direct Supabase. Align read path later to reduce stale-state risk. |
| Loan create/edit | `src/components/LoanForm.jsx:133`, `src/store/useIncomeStore.js:616`, `src/store/useIncomeStore.js:785` | `useIncomeStore` loans | `src/lib/transactions-api.js:225` | `api/transactions.js:3491`, `api/transactions.js:3557`, `api/transactions.js:3605` | `loans`, `loan_payments`, `fn_sync_loan_terms_snapshot` | Mixed | Writes use API, but loans are also read directly in store. Late charge snapshot logic must remain DB/API-owned. |
| Bill payment | `src/pages/PaymentPage.jsx:145`, `src/components/PaymentModal.jsx:40`, `src/pages/PaymentsPage.jsx:710` | `usePaymentStore`, `useBillStore` | `src/lib/records-api.js:183`, `src/lib/records-api.js:198`, `src/lib/records-api.js:210` | `api/records.js:5726`, `api/records.js:5776`, `api/records.js:5788`, `api/records.js:5812` | `bills`, `bill_payments`, `fn_update_bill_status_on_payment` | Mixed | Server code and DB trigger both know payment status. Verify one canonical status owner before patching payment behavior. |
| Loan payment | `src/pages/PaymentPage.jsx:145`, `src/pages/PaymentsPage.jsx:620` | `usePaymentStore`, `useIncomeStore` | `src/lib/transactions-api.js:265`, `src/lib/transactions-api.js:282`, `src/lib/transactions-api.js:296` | `api/transactions.js:2138`, `api/transactions.js:2234`, `api/transactions.js:2329`, `api/transactions.js:2434` | `loans`, `loan_payments`, `fn_update_loan_status_on_payment` | Mixed | Loan payment API manually syncs loan status while trigger also exists. Avoid UI-side amount/status calculation changes without deeper payment proposal. |
| Delete/soft delete transaction | `src/components/TransactionDeleteDialog.jsx`, `src/pages/EditRecordPage.jsx:993` | Domain stores + detail pages | `src/lib/transactions-api.js:207`, `src/lib/records-api.js:171`, `src/lib/records-api.js:314`, `src/lib/records-api.js:395` | `api/transactions.js:3883`, `api/records.js:5882`, `api/records.js:6165`, `api/records.js:6387` | `deleted_at` columns; `fn_soft_delete_bill_with_history` for bills | Mixed by record type | Use per-domain delete contracts. Bill delete must keep payment history behavior server-side. |
| Restore/recycle bin | `src/pages/TransactionsRecycleBinPage.jsx:395`, `src/pages/DeletedTransactionDetailPage.jsx:127` | Page state + dashboard refresh | `src/lib/transactions-api.js:233`, `src/lib/records-api.js:251`, `src/lib/records-api.js:326`, `src/lib/records-api.js:412` | `api/transactions.js:4071`, `api/records.js:6001`, `api/records.js:6086`, `api/records.js:6275` | `vw_recycle_bin_records` for read, source tables for restore | Mixed | Read is canonical view, but restore dispatches across several APIs by source type. Keep matrix by record type before implementation. |
| Permanent delete | `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/DeletedTransactionDetailPage.jsx` | Page state | `src/lib/transactions-api.js:252`, `src/lib/records-api.js:135`, `src/lib/records-api.js:224` | `api/transactions.js:3883`, `api/records.js:5814`, `api/records.js:6017` | Source tables and child tables | Mixed | High data risk. Needs explicit per-source permanent-delete rules before any patch. |
| Attendance sheet | `src/pages/AttendancePage.jsx:6`, `src/components/AttendanceForm.jsx:588` | `useAttendanceStore` | `src/lib/records-api.js:430`, `src/lib/records-api.js:533` | `api/records.js:6466`, `api/records.js:6512` | `attendance_records` | API-backed | API enforces day-weight/business rules. |
| Attendance recap/payroll | `src/pages/PayrollPage.jsx:138`, `src/components/PayrollAttendanceHistory.jsx:450` | `useAttendanceStore`, `useBillStore` | `src/lib/records-api.js:520`, `src/lib/records-api.js:464` | `api/records.js:3815`, `api/records.js:6612` | `attendance_records`, `bills`, `fn_generate_salary_bill` | Mostly API-backed | `src/components/PayrollManager.jsx:254` is an unused direct-RPC path; leave untouched until approved cleanup. |
| Stock overview and manual stock-out | `src/pages/StockPage.jsx:398`, `src/pages/StockPage.jsx:479` | Page local state | `src/lib/records-api.js:47`, `src/lib/records-api.js:73` | `api/records.js:1978`, `api/records.js:2094`, `api/records.js:5903` | `materials`, `stock_transactions`, `fn_create_atomic_manual_stock_out` | API-backed | Manual stock-out source is RPC. Stock overview is limited and in-memory filtered in page. |
| Master data | `src/pages/MasterPage.jsx`, `src/components/MasterDataManager.jsx:43`, `src/components/master/masterTabs.js:70` | `useMasterStore` | Direct `supabase` client | `src/store/useMasterStore.js:264`, `src/store/useMasterStore.js:479`, `src/store/useMasterStore.js:588`, `src/store/useMasterStore.js:615` | `projects`, `expense_categories`, `suppliers`, `funding_creditors`, `professions`, `staff`, `workers`, `worker_wage_rates`, `materials` | Direct client | Not API-centered. Any future source-of-truth standardization should be a separate approved task. |
| File assets and attachments | `src/components/ExpenseAttachmentSection.jsx:68`, `src/pages/ProjectPdfSettingsPage.jsx:155` | `useFileStore`, `useTransactionStore`, `useReportStore` | Direct storage + `/api/records` attachment/PDF settings | `src/store/useFileStore.js:270`, `api/records.js:1951`, `api/records.js:5522` | Supabase Storage, `file_assets`, `expense_attachments`, `pdf_settings` | Mixed | Upload/storage is direct client; attachment linking is API. Keep permissions/RLS in scope for any future change. |
| HRD and beneficiaries | `src/pages/HrdPage.jsx`, `src/pages/BeneficiariesPage.jsx`, `src/components/HrdPipeline.jsx:86`, `src/components/BeneficiaryList.jsx:75` | `useHrStore` | Direct Supabase client | `src/store/useHrStore.js:170`, `src/store/useHrStore.js:210`, `src/store/useHrStore.js:450`, `src/store/useHrStore.js:981` | `hrd_applicants`, `hrd_applicant_documents`, `beneficiaries`, `file_assets` | Direct client | Not part of current transaction source-of-truth core, but storage/RLS risk remains. |
| Team invite/admin | `src/pages/TeamInvitePage.jsx`, `src/components/TeamInviteManager.jsx` | `useTeamStore` | Direct Supabase client | `src/store/useTeamStore.js:114`, `src/store/useTeamStore.js:143`, `src/store/useTeamStore.js:220`, `src/store/useTeamStore.js:322` | `team_members`, `invite_tokens` | Direct client | Auth-critical. Keep RLS/policy verification in future hardening task. |
| Project/business reporting | `src/pages/ProjectsPage.jsx:42`, `src/components/ProjectReport.jsx:194`, `src/components/ProjectReport.jsx:229` | `useReportStore` | `src/lib/reports-api.js:42`, `src/lib/reports-api.js:71` | `api/records.js:4285`, `api/records.js:4476`, `api/records.js:4503`, `api/records.js:6624` | `vw_project_financial_summary`, `vw_cash_mutation`, `vw_billing_stats`, plus raw party-statement tables | API-backed | Reporting is the clearest canonical view consumer. Dashboard should not diverge from it. |
| PDF settings | `src/pages/ProjectPdfSettingsPage.jsx:282`, `src/components/ProjectReport.jsx:223` | `useReportStore` | `src/lib/reports-api.js:90`, `src/lib/reports-api.js:101` | `api/records.js:5514`, `api/records.js:5522`, `api/records.js:5588`, `api/records.js:6738` | `pdf_settings`, `file_assets` | API-backed | Good boundary for settings; actual file upload remains direct in `useFileStore`. |
| Telegram assistant | Telegram webhook function | No frontend store; transport/session libs in `src/lib/telegram-assistant-*` | `src/lib/telegram-assistant-transport.js:33` | `api/telegram-assistant.js:5762`, `api/telegram-assistant.js:1054`, `api/telegram-assistant.js:2875`, `api/telegram-assistant.js:3315` | `telegram_assistant_sessions`, `vw_workspace_transactions`, `vw_cash_mutation`, `attendance_records` | API/server-backed | Remote migration history has assistant sessions timestamp drift versus local. Handoffs local migration is not in remote history. |
| Telegram assistant handoff | `api/telegram-assistant-handoff.js` | N/A | Serverless only | `api/telegram-assistant-handoff.js:107`, `api/telegram-assistant-handoff.js:149` | `telegram_assistant_handoffs` | Local-only migration | Local migration exists but remote migration history does not include it. Verify deployment before relying on this table in production. |

## Local vs Remote Migration History

Read-only comparison source:

- Local files: `supabase/migrations/`
- Remote history: Supabase MCP `list_migrations`

Counts:

- Local migration files: 43
- Remote migration entries: 34
- Matched by exact `version_name`: 30
- Local-only files: 13
- Remote-only entries: 4

Local-only files:

- `20260420150000_create_vw_recycle_bin_records.sql`
- `20260421093000_add_is_active_to_expense_categories.sql`
- `20260421101000_reverse_material_invoice_stock_on_delete.sql`
- `20260421120000_allow_absent_attendance_status.sql`
- `20260421190000_fix_project_income_fee_bill_unique_index.sql`
- `20260421193000_add_overtime_fee_to_attendance_records.sql`
- `20260421194500_refresh_attendance_records_overtime_fee_schema_cache.sql`
- `20260421200000_update_workspace_transaction_sort_order.sql`
- `20260421200500_realign_workspace_transaction_sort_order_to_surface_time.sql`
- `20260421210000_add_unique_attendance_worker_date_project.sql`
- `20260422143000_backfill_payroll_snapshot_consistency.sql`
- `20260423101000_create_telegram_assistant_sessions.sql`
- `20260423120000_create_telegram_assistant_handoffs.sql`

Remote-only entries:

- `20260420110253_create_vw_recycle_bin_records`
- `20260421064229_update_workspace_transaction_sort_order`
- `20260421064409_realign_workspace_transaction_sort_order_to_surface_time`
- `20260422211746_create_telegram_assistant_sessions`

Drift interpretation:

- `create_vw_recycle_bin_records`, `update_workspace_transaction_sort_order`, `realign_workspace_transaction_sort_order_to_surface_time`, and `create_telegram_assistant_sessions` exist in both local and remote by name, but with different timestamps.
- Later local migrations for expense category active flag, material invoice stock reversal, absent attendance status, project income fee index, overtime fee, attendance uniqueness, payroll snapshot backfill, and assistant handoffs are not recorded in remote migration history.
- Current remote tables/views/functions still show a mature schema, but migration history drift must be resolved before applying new migrations.

## Supabase Remote Schema Snapshot

Read-only MCP checks confirmed public tables with RLS enabled:

- `funding_creditors`, `expense_line_items`, `loans`, `stock_transactions`, `loan_payments`, `projects`, `professions`, `expense_attachments`, `profiles`, `team_members`, `expense_categories`, `invite_tokens`, `workers`, `beneficiaries`, `transactions`, `expenses`, `staff`, `suppliers`, `worker_wage_rates`, `project_incomes`, `bill_payments`, `attendance_records`, `file_assets`, `hrd_applicant_documents`, `telegram_assistant_sessions`, `bills`, `teams`, `hrd_applicants`, `pdf_settings`, `materials`.

Remote views:

- `vw_billing_stats`
- `vw_cash_mutation`
- `vw_history_transactions`
- `vw_project_financial_summary`
- `vw_recycle_bin_records`
- `vw_transaction_summary`
- `vw_workspace_transactions`

Notable remote/local mismatch:

- Remote table list from MCP did not include `telegram_assistant_handoffs`, while local migration `20260423120000_create_telegram_assistant_handoffs.sql` creates it.

## Phase 0 Findings by Requested Checklist

| Checklist Item | Status | Evidence |
|---|---|---|
| `src/`, `api/`, `supabase/migrations/`, `docs/` structure | Completed | `rg --files src api supabase/migrations docs`, `Get-ChildItem docs -Directory` |
| `package.json` scripts | Completed | `package.json` scripts audited above |
| Routes/pages utama | Completed | `src/App.jsx:202` through `src/App.jsx:304` |
| Zustand stores | Completed | Store matrix above |
| Service/data-access layer | Completed | `src/lib/transactions-api.js:13`, `src/lib/records-api.js:3`, `src/lib/reports-api.js:3` |
| Supabase client usage | Completed | Direct usage list above |
| Vercel Serverless Functions | Completed | `api/auth.js:631`, `api/records.js:5602`, `api/transactions.js:3619` |
| PDF utilities/templates | Completed | `src/lib/report-pdf.js:410`, `src/lib/report-pdf.js:1309`, `api/notify.js:333` |
| Long-list components | Completed | `src/components/ui/SmartList.jsx:16`, transaction/history/recycle page pagination evidence above |
| Reporting views/RPC usage | Completed | Reporting/RPC table above |
| Local migration files vs Supabase history | Completed | Migration comparison above |

## Proposal Gate

Do not implement patches from this document without explicit approval. Suggested proposal topics for the next brief:

1. Resolve migration history drift plan without applying migrations.
2. Align dashboard cash summary with reporting source-of-truth.
3. Audit payment status ownership between DB triggers and server sync code.
4. Decide whether direct-client master/HR/team/file stores remain accepted boundaries or need API wrappers later.
5. Remove or quarantine unused direct-RPC payroll path only after approval.
