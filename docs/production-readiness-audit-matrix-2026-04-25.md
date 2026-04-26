# Production Readiness Audit Matrix - 2026-04-25

Audit baseline date: `2026-04-25`  
Stream: `Production Readiness Hardening`  
Purpose: mengunci peta `route -> store -> API/server -> schema/view` untuk domain inti supaya task hardening berikutnya punya sumber audit tunggal yang konsisten.

## Baseline Sources

Audit matrix ini disusun dari:

- `docs/freeze/00-index.md`
- `docs/freeze/03-source-of-truth-contract-map.md`
- `docs/freeze/04-lifecycle-matrix.md`
- `docs/architecture-source-of-truth-audit-2026-04-24.md`
- `docs/production-readiness-hardening-plan-2026-04-25.md`
- `docs/production-readiness-hardening-backlog-2026-04-25.md`

## Legend

- `aligned`: route, store, API/server, dan schema/view sudah satu contract utama.
- `mixed`: masih ada lebih dari satu boundary runtime atau read/write owner yang aktif.
- `transitional`: direct-client runtime masih dipakai, tetapi sudah terdokumentasi sebagai exception.
- `side-effect only`: tidak punya source-of-truth bisnis sendiri.
- `legacy/superseded`: bukan target task baru.

## Core Truth Matrix

| Domain | User-facing route / surface | Store / local state | API / server boundary | Final schema / view / RPC | Current boundary | Audit note |
| --- | --- | --- | --- | --- | --- | --- |
| `auth/workspace` | Bootstrap auth, `ProtectedRoute`, akses tim | `useAuthStore`, `useTeamStore` | `/api/auth` | `profiles`, `teams`, `team_members`, `invite_tokens`, `fn_redeem_invite_token` | `mixed` | Browser session tetap perlu, tetapi bootstrap dan membership tidak boleh dibypass. |
| `dashboard summary` | `/` | `useDashboardStore` | `/api/transactions?view=summary`, `/api/transactions?view=workspace` | `vw_transaction_summary` compatibility, `vw_workspace_transactions`, raw mutation tables | `mixed` | Hindari kalkulasi ringkasan client-side yang berbeda dari reporting. |
| `jurnal / ledger` | `/transactions`, `/transactions/:transactionId` | Page local state + warm seed dashboard | `/api/transactions?view=workspace`, `/api/transactions?view=history`, `/api/transactions?view=recycle-bin` | `vw_workspace_transactions`, `vw_history_transactions`, `vw_recycle_bin_records` | `aligned` for read | Ledger adalah read model, bukan target write baru. |
| `project income / pemasukan proyek` | Generic edit/create income surface via `EditRecordPage` / `IncomeForm` | `useIncomeStore` | `/api/transactions` | `project_incomes`, `bills.project_income_id`, `bill_payments`, `fn_sync_fee_bills_from_project_income` | `mixed` | Write sudah API-backed, tetapi read path masih campuran. |
| `expense / pengeluaran` | `/edit/:type/:id` and create expense form surfaces | `useTransactionStore` | `/api/records?resource=expenses` | `expenses`, `bills`, `bill_payments`, `expense_attachments`, `fn_auto_create_bill_from_expense` | `aligned` | API tetap owner mutasi dan side effect bill. |
| `dokumen barang / faktur barang` | `MaterialInvoiceForm`, `MaterialInvoicePage`, generic edit route | `useTransactionStore` | `/api/records?resource=material-invoices` | `expenses` with `expense_type='material'`, `expense_line_items`, `bills`, `stock_transactions`, `fn_reverse_material_invoice_stock_movement` | `aligned` | Stock reversal dan settlement harus tetap server-owned. |
| `dokumen barang / surat jalan barang` | `MaterialInvoiceForm` with `document_type='surat_jalan'` | `useTransactionStore` | `/api/records?resource=material-invoices` | `expenses`, `expense_line_items`, `stock_transactions` | `aligned` | Conversion ke faktur tidak boleh double count stok masuk. |
| `loan / dana masuk / pinjaman` | `LoanForm`, `/loan-payment/:id`, payment surfaces | `useIncomeStore`, `usePaymentStore` | `/api/transactions` | `loans`, `loan_payments`, `loan_terms_snapshot`, `fn_sync_loan_terms_snapshot` | `mixed` | Read path direct-client masih ada; settlement owner harus tetap jelas. |
| `bill / tagihan` | `BillsPage`, `PaymentPage`, `PaymentsPage` | `useBillStore`, `usePaymentStore` | `/api/records?resource=bills` | `bills`, `bill_payments`, `fn_update_bill_status_on_payment` | `mixed` | Status owner server masih bercampur dengan trigger/domain sync. |
| `payment / pembayaran` | `/payment/:id`, `/loan-payment/:id`, `PaymentsPage` | `usePaymentStore` | `/api/records`, `/api/transactions` | `bill_payments`, `loan_payments`, `fn_update_bill_status_on_payment`, `fn_update_loan_status_on_payment` | `mixed` | Jalur bill dan loan payment masih split by domain. |
| `recycle bin / restore` | `/transactions/recycle-bin`, deleted detail surfaces | Page state + recycle bin persistence | `/api/transactions?view=recycle-bin`, restore endpoints on `/api/records` and `/api/transactions` | `vw_recycle_bin_records`, source tables per record type | `mixed` | Restore harus dibaca per record type, bukan asumsi satu contract. |
| `permanent delete` | `/transactions/recycle-bin`, deleted detail surfaces | Page state | `/api/transactions`, `/api/records` delete branches | Source tables and child tables | `mixed` | High-risk destructive path; audit tree child-first sebelum patch runtime. |
| `attendance input / halaman absensi` | `/attendance/new` | `useAttendanceStore` | `/api/records?resource=attendance` | `attendance_records` | `aligned` | Surface input harian tetap API-owned. |
| `attendance history / catatan absensi` | `/payroll`, payroll attendance history | `useAttendanceStore`, `useBillStore` | `/api/records?resource=attendance-recap` | `attendance_records`, `bills`, `fn_generate_salary_bill` | `mostly aligned` | Histori dan rekap adalah derived surface, bukan row finance utama. |
| `payroll / tagihan upah` | `PayrollPage`, payment surfaces | `useAttendanceStore`, `useBillStore` | `fn_generate_salary_bill`, `/api/records` | `attendance_records`, `bills`, `bill_payments` | `mostly aligned` | `PayrollManager` legacy path tetap exception yang terdokumentasi. |
| `reports` | `/projects`, `/projects/pdf-settings` | `useReportStore` | `/api/records?resource=reports`, `/api/records?resource=pdf-settings`, `/api/report-pdf-delivery` | `vw_project_financial_summary`, `vw_cash_mutation`, `vw_billing_stats`, `pdf_settings` | `aligned` | Reporting adalah canonical read model untuk proyek dan PDF settings. |
| `stock` | `/stock` | Page local state + records API helpers | `/api/records?resource=stock`, manual stock-out RPC path | `materials`, `stock_transactions`, `fn_create_atomic_manual_stock_out`, `fn_auto_update_stock_from_line_item` | `aligned` | Negative stock harus diblok; stock overview tetap read-heavy. |
| `attachment` | Expense attachment surfaces, PDF settings surfaces | `useFileStore`, `useReportStore`, `useTransactionStore` | Direct storage upload + `/api/records` relation writes | `file_assets`, `expense_attachments`, `pdf_settings` | `mixed` | Upload direct-client masih ada; relation write tetap lewat API. |
| `telegram assistant` | Webhook / assistant server surfaces | No frontend business store | `api/telegram-assistant.js`, `api/telegram-assistant-handoff.js` | `telegram_assistant_sessions`, `telegram_assistant_handoffs` | `side-effect only` | Session memory ringkas dan one-time handoff token saja; bukan source of truth bisnis. |
| `notifications` | `api/notify.js` only | None | Telegram notification endpoint | None | `side-effect only` | Hanya side effect; jangan dijadikan basis state bisnis. |

## Transitional / Direct-Client Boundaries

Boundary berikut masih aktif di runtime dan harus diperlakukan sebagai exception terdokumentasi, bukan pola baru:

| Domain | Route / surface | Store | Current direct boundary | Final data object | Boundary status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `reference/master` | `/master`, `/master/:tab/add`, `/master/:tab/edit/:id`, master recycle bin | `useMasterStore` | Direct Supabase client + worker RPC | `projects`, `expense_categories`, `suppliers`, `funding_creditors`, `professions`, `staff`, `workers`, `worker_wage_rates`, `materials` | `transitional` | Domain fondasional, tetapi runtime write masih direct-client. |
| `HRD` / `beneficiaries` | `/more/hrd`, `/more/beneficiaries` | `useHrStore` | Direct Supabase client | `hrd_applicants`, `hrd_applicant_documents`, `beneficiaries`, `file_assets` | `transitional` | Storage dan RLS impact tetap harus dibaca sebelum hardening berikutnya. |
| `team invite / admin` | `/more/team-invite` | `useTeamStore` | Direct Supabase client | `team_members`, `invite_tokens` | `transitional` | Auth-critical; jangan diperluas ke domain finance core. |
| `file assets upload` | Upload flow in file/attachment surfaces | `useFileStore` | Direct Supabase Storage + `file_assets` table | `file_assets`, Supabase Storage objects | `transitional` | Upload client langsung masih ada; relation write untuk attachment tetap API-owned. |
| `legacy payroll manager` | `src/components/PayrollManager.jsx` | None | Direct RPC `fn_generate_salary_bill` | `bills` generated from attendance history | `legacy` | Jalur ini dokumentasi only; jangan dijadikan jalur baru. |

## Baseline Gaps That Remain Open

- Ringkasan dashboard masih berisiko divergen dari reporting view jika client-side aggregate dipakai lagi.
- Payment status ownership masih bercampur antara server code dan trigger/domain sync.
- `Master`, `HRD`, `team invite`, dan file upload masih direct-client pada boundary tertentu.
- Delete/restore/permanent delete harus tetap child-first dan per record type.
- Migration drift dan security advisor findings tetap menjadi input audit L1/L2 berikutnya, bukan diselesaikan di baseline matrix ini.

## Usage Rule

- Pakai dokumen ini sebagai source audit pertama untuk `PRH-L1+`.
- Jika task baru menyentuh domain di atas, bandingkan dulu route, store, API/server, dan schema/view dengan matrix ini.
- Jika state masih `mixed` atau `transitional`, jangan ubah contract runtime tanpa proposal kecil dan approval eksplisit.
