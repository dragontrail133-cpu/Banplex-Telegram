# Production Readiness Settlement Integrity Audit - 2026-04-26

Audit baseline date: `2026-04-26`  
Stream: `Production Readiness Hardening`  
Task: `PRH-L2-02`

## Scope

Audit ini memeriksa settlement state pada jalur paling sensitif:

- bill/payment reconciliation,
- loan/payment reconciliation,
- attendance/payroll settlement,
- dan read model billing summary yang dipakai app.

Tidak ada runtime patch, migration, DDL/DML, atau deploy yang dijalankan.

## Evidence Basis

Sumber audit:

- `src/lib/transactions-api.js`
- `src/lib/records-api.js`
- `src/store/useIncomeStore.js`
- `src/store/usePaymentStore.js`
- `src/store/useAttendanceStore.js`
- `src/pages/PayrollWorkerDetailPage.jsx`
- `src/components/PayrollAttendanceHistory.jsx`
- `src/components/PayrollManager.jsx`
- `api/transactions.js`
- `api/records.js`
- `supabase/migrations/20260410144525_add_bill_payments_and_cash_mutation.sql`
- `supabase/migrations/20260411120000_add_expense_status_and_paid_bill_automation.sql`
- `supabase/migrations/20260411143000_create_funding_creditors_and_income_loans_flow.sql`
- `supabase/migrations/20260411160000_create_attendance_and_salary_billing.sql`
- `supabase/migrations/20260411170000_create_project_financial_summary_view.sql`
- `supabase/migrations/20260412103000_update_project_financial_summary_for_internal_overhead.sql`
- `supabase/migrations/20260417193000_add_project_income_fee_bills_and_loan_payment_status.sql`
- `supabase/migrations/20260418154500_add_loan_business_rules_snapshot_columns.sql`
- `supabase/migrations/20260419103000_fix_salary_bill_function_runtime_and_scope.sql`
- `supabase/migrations/20260422143000_backfill_payroll_snapshot_consistency.sql`
- `mcp__supabase__.execute_sql` untuk reconciliation snapshot live
- `pg_get_viewdef('public.vw_billing_stats'::regclass, true)` untuk membaca formula read model

## Contract Map

### Bill / Payment Settlement

Server-side settlement contract memakai payment rows sebagai sumber hitung final, lalu menulis kembali cache di `bills`:

- `api/transactions.js` dan `api/records.js` menghitung ulang `paid_amount` dan `status` setelah mutation payment.
- UI/store membaca `bills.paid_amount`, `bills.status`, dan `bills.paid_at` sebagai read model.
- `vw_billing_stats` menghitung summary dari cache `bills`, bukan langsung dari payment rows.

Catatan penting:

- `paid_at` tidak dipakai sebagai sinyal health utama karena kontraknya tidak benar-benar canonical di seluruh flow.
- Sinyal yang paling penting adalah `paid_amount` dan `status` dibandingkan total payment aktif.

Live snapshot bill settlement:

| Bill type | Active bills | `paid_amount` mismatch | `status` mismatch | Overpaid active bills | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| `fee` | 36 | 16 | 16 | 16 | Semua mismatch yang terlihat berasal dari bill amount `0` dengan payment aktif tetapi cache tetap `unpaid`. |
| `gaji` | 133 | 2 | 22 | 2 | Mayoritas drift ada di `status`; cache masih `unpaid` padahal payment aktif sudah masuk ke level `partial`. |
| `material` | 19 | 0 | 3 | 0 | Drift ringan, terbatas pada status cache. |
| `operasional` | 87 | 0 | 0 | 0 | Stabil pada snapshot live yang diperiksa. |
| `lainnya` | 10 | 0 | 0 | 0 | Stabil pada snapshot live yang diperiksa. |

Ringkasan live bill settlement:

- `active_bill_count = 285`
- `paid_amount_mismatch_count = 18`
- `status_mismatch_count = 41`
- `mismatch_count = 41` jika hanya menghitung `paid_amount` dan `status` sebagai contract health utama

Contoh mismatch yang diperiksa:

- `fee` bill `1a25d99d-15d6-5e05-81b5-0a29c1c44cb0` dengan `amount = 0`, `status = unpaid`, `paid_amount = 0`, `active_payment_sum = 180000`, `expected_status = paid`
- `gaji` bill `18317419-152d-567e-9ca1-52257752053b` dengan `amount = 800000`, `status = unpaid`, `paid_amount = 250000`, `active_payment_sum = 650000`, `expected_status = partial`

### Loan / Payment Settlement

Loan settlement lebih sehat daripada bill settlement:

- `api/transactions.js` menyinkronkan `loan.status` dan `loan.paid_amount` dari active `loan_payments`.
- Target status memakai `repayment_amount` atau snapshot repayment target yang tersedia.
- Live mismatch yang ditemukan hanya satu row status drift; `paid_amount` tetap konsisten.

Live snapshot loan settlement:

- `active_loan_count = 47`
- `paid_amount_mismatch_count = 0`
- `status_mismatch_count = 1`
- `overpaid_active_loan_count = 0`

Contoh mismatch:

- loan `7b2d2ca1-7cc7-52a4-8bdc-b3b4ff2bd56b`
- `amount = 7000000`
- `paid_amount = 2000000`
- `active_payment_sum = 2000000`
- `expected_status = partial`
- `status = unpaid`

### Attendance / Payroll Settlement

Payroll settlement contract memakai pasangan `attendance_records.billing_status` dan `attendance_records.salary_bill_id`:

- `fn_generate_salary_bill()` menandai attendance terpilih sebagai `billed` dan membuat bill gaji baru.
- UI payroll hanya mengenal state `unbilled` dan `billed` untuk flow recap.
- Schema live sudah mengizinkan `paid`, tetapi frontend yang diperiksa belum memakai state itu sebagai contract aktif.

Live snapshot attendance/payroll:

- `active_attendance_count = 1201`
- `unbilled_with_bill_id_count = 2`
- `billed_without_bill_id_count = 0`
- `paid_without_bill_id_count = 0`
- `broken_salary_bill_link_count = 0`
- `paid_with_nonpaid_bill_count = 0`
- `invalid_billing_status_count = 0`

Contoh mismatch:

- attendance `6f235560-75c1-5ce9-b9fe-5827558ad438` dengan `billing_status = unbilled` dan `salary_bill_id = ca2fc1ab-a1ce-5d42-919d-f2983301da35`
- attendance `6b4b2681-d5ea-5a01-b85f-12e3f242e263` dengan `billing_status = unbilled` dan `salary_bill_id = 2d6f0ba4-5629-5748-b431-7f7040fe8a40`

Audit meaning:

- Ada 2 row yang masih menampilkan state `unbilled`, tetapi sudah punya salary bill link.
- Ini mismatch contract kecil tetapi nyata, karena payroll UI memakai status ini untuk menentukan eligibility dan read-only boundary.

### Billing Summary View

`vw_billing_stats` adalah read model turunan dari cache `bills`, bukan dari payment rows langsung:

- view ini menghitung `total_outstanding`, `total_paid`, dan `total_outstanding_salary` dari `bills.status` dan `bills.paid_amount`
- karena itu, jika cache `bills` drift dari payment rows, summary view ikut drift

Live comparison view vs recomputed payment truth:

| Team | View outstanding | Recomputed outstanding | View paid | Recomputed paid | View salary outstanding | Recomputed salary outstanding |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `2213b84a-a513-47fa-afbb-8b99ae3b64be` | 211753500.00 | 210653500.00 | 257147000.00 | 314370000.00 | 92355000.00 | 91255000.00 |

Audit meaning:

- Ada satu team dengan summary drift yang jelas.
- Selisih terbesar muncul pada `total_paid`, yang mengindikasikan cache bill belum konsisten dengan payment rows aktif.

## Findings

- Bill settlement adalah area paling bermasalah pada snapshot live; fee bills dan sebagian gaji bills masih membawa cache `status` yang tidak sejalan dengan payment rows.
- Loan settlement relatif sehat; hanya ada satu mismatch status.
- Attendance/payroll punya 2 row dengan `billing_status = unbilled` tetapi sudah memiliki `salary_bill_id`.
- `vw_billing_stats` masih bisa drift karena dibangun dari cache bill, bukan payment rows.
- Ini berarti settlement layer belum bisa dianggap final-consistent di seluruh domain; audit ini menemukan real drift, bukan sekadar noise test.

## Conclusion

`PRH-L2-02` selesai sebagai audit, tetapi hasilnya bukan green penuh.

Kesimpulan praktis:

1. bill/payment settlement masih perlu remediation, terutama `fee` dan `gaji`,
2. loan/payment settlement perlu satu follow-up untuk status drift tunggal,
3. attendance/payroll contract perlu dibersihkan pada 2 row yang masih membawa `salary_bill_id` sambil tetap `unbilled`,
4. billing summary view harus dianggap read model turunan yang bergantung pada kesehatan cache bill.

## Next Task

Rekomendasi lanjutannya adalah `PRH-L2-03` untuk attachment/report/stock integrity.
