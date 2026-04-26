# Production Readiness Migration Drift Triage - 2026-04-26

Audit baseline date: `2026-04-26`  
Stream: `Production Readiness Hardening`  
Task: `PRH-L2-04`

## Scope

Audit ini membandingkan:

- file migration lokal di `supabase/migrations/`,
- history migration remote dari Supabase,
- dan object live yang relevan untuk menentukan apakah drift itu:
  - `timestamp-equivalent`,
  - `already-applied-out-of-band`,
  - `truly-pending`,
  - atau `obsolete`.

Tidak ada runtime patch, migration, DDL/DML, atau deploy yang dijalankan.

## Evidence Basis

Sumber audit:

- `supabase/migrations/`
- `mcp__supabase__.list_migrations`
- `mcp__supabase__.execute_sql`
- `api/records.js`
- `src/store/useMasterStore.js`
- `src/store/useAttendanceStore.js`
- `api/telegram-assistant-handoff.js`
- `supabase/migrations/20260421093000_add_is_active_to_expense_categories.sql`
- `supabase/migrations/20260421101000_reverse_material_invoice_stock_on_delete.sql`
- `supabase/migrations/20260421120000_allow_absent_attendance_status.sql`
- `supabase/migrations/20260421190000_fix_project_income_fee_bill_unique_index.sql`
- `supabase/migrations/20260421193000_add_overtime_fee_to_attendance_records.sql`
- `supabase/migrations/20260421194500_refresh_attendance_records_overtime_fee_schema_cache.sql`
- `supabase/migrations/20260421210000_add_unique_attendance_worker_date_project.sql`
- `supabase/migrations/20260422143000_backfill_payroll_snapshot_consistency.sql`
- `supabase/migrations/20260423120000_create_telegram_assistant_handoffs.sql`

## Snapshot Counts

- Local migration files: `43`
- Remote migration history entries: `34`
- Remote-only migration names: `0`

Artinya:

- drift yang tersisa berada di sisi lokal,
- dan tidak ada migration yang hanya ada di remote tetapi hilang di lokal.

## Timestamp-Equivalent Rebasings

Empat migration ini adalah migration yang sama secara logis, tetapi timestamp lokal dan remote berbeda:

| Migration | Local file | Remote history | Catatan |
| --- | --- | --- | --- |
| `create_vw_recycle_bin_records` | `20260420150000` | `20260420110253` | Hanya timestamp yang berbeda; object/view yang dimaksud sama. |
| `update_workspace_transaction_sort_order` | `20260421200000` | `20260421064229` | Rebase timestamp, bukan perubahan object baru. |
| `realign_workspace_transaction_sort_order_to_surface_time` | `20260421200500` | `20260421064409` | Rebase timestamp, bukan perubahan object baru. |
| `create_telegram_assistant_sessions` | `20260423101000` | `20260422211746` | Rebase timestamp, object remote sudah ada. |

## Local-Only Inventory

### `add_is_active_to_expense_categories`

- Live state: `expense_categories.is_active` tidak ada di schema live.
- Code impact: `src/store/useMasterStore.js` dan `src/components/master/masterTabs.js` membaca field `is_active`.
- Classification: `truly-pending`

Audit meaning:

- Ini bukan kosmetik.
- Code sudah mengandalkan kolom ini, jadi tanpa migration ini master category tetap berada pada contract yang rapuh.

### `reverse_material_invoice_stock_on_delete`

- Live state: `fn_reverse_material_invoice_stock_movement` tidak ada di schema live.
- Code impact: `api/records.js` memanggil RPC itu saat rollback stock material invoice.
- Classification: `truly-pending`

Audit meaning:

- Jalur rollback stock material invoice belum punya function live yang dipanggil server.
- Ini adalah gap operasional yang bisa membuat delete/reversal stock tidak fully symmetric.

### `allow_absent_attendance_status`

- Live state: constraint `attendance_records_attendance_status_check` sudah mengizinkan `absent`.
- Live data: ada `2` attendance row aktif dengan status `absent`.
- Classification: `already-applied-out-of-band`

Audit meaning:

- Efek schema-nya sudah hadir di live DB, tetapi migration file tidak tercatat di history remote.
- Ini perlu tetap dicatat sebagai drift history, bukan sebagai bug contract sekarang.

### `fix_project_income_fee_bill_unique_index`

- Live state: index `bills_project_income_staff_key` sudah ada di `public.bills`.
- Classification: `already-applied-out-of-band`

Audit meaning:

- Index ini sudah live dan bisa dipakai codepath yang bergantung pada uniqueness fee-bill.
- Remote history tidak mencatat migration ini, jadi ini drift history, bukan missing behavior.

### `add_overtime_fee_to_attendance_records`

- Live state: column `attendance_records.overtime_fee` sudah ada dan nullable.
- Code impact: `api/records.js`, `src/store/useAttendanceStore.js`, dan `src/components/AttendanceForm.jsx` sudah membaca / menulis field ini.
- Classification: `already-applied-out-of-band`

Audit meaning:

- Efek schema-nya sudah hadir.
- Remote history tidak menyimpan file migration ini, jadi drift-nya berada di histori, bukan di contract aktif.

### `refresh_attendance_records_overtime_fee_schema_cache`

- Live state: column `overtime_fee` sudah ada.
- Migration effect: hanya `notify pgrst, 'reload schema';`
- Classification: `obsolete`

Audit meaning:

- Ini bukan migration dengan effect schema persisten.
- Kalau schema add-nya sudah ada, file ini tidak lagi memberi nilai residu yang perlu di-apply ulang.

### `add_unique_attendance_worker_date_project`

- Live state: tidak ditemukan unique index / constraint pada kombinasi `team_id`, `worker_id`, `attendance_date`, `project_id`.
- Classification: `truly-pending`

Audit meaning:

- Guard duplikasi attendance per worker-date-project belum ada di live schema.
- Ini cocok dengan risiko data entry ganda pada jalur attendance.

### `backfill_payroll_snapshot_consistency`

- Live state: masih ada 2 attendance row aktif yang `unbilled` tetapi sudah punya `salary_bill_id`.
- Classification: `truly-pending`

Audit meaning:

- Backfill payroll snapshot belum benar-benar menutup drift yang sekarang terlihat di data live.
- Karena datanya masih mismatch, file ini harus dianggap pending remediation, bukan sekadar histori.

### `create_telegram_assistant_handoffs`

- Live state: `telegram_assistant_handoffs` table tidak ada di schema live.
- Code impact: `api/telegram-assistant-handoff.js` mengakses tabel ini.
- Classification: `truly-pending`

Audit meaning:

- Ini gap fungsional yang nyata.
- Jalur handoff Telegram masih bergantung pada object yang belum ada di remote schema.

## Findings

- Tidak ada remote-only migration; gap utama ada di lokal.
- Empat migration hanya beda timestamp, jadi itu rebase history, bukan drift object.
- Lima migration lokal benar-benar pending karena object live yang dirujuk belum ada atau belum terbentuk.
- Tiga migration lokal sudah punya efek live, jadi statusnya `already-applied-out-of-band`.
- Satu migration (`refresh_attendance_records_overtime_fee_schema_cache`) sudah tidak material karena hanya reload schema cache.

## Conclusion

`PRH-L2-04` selesai sebagai triage:

1. history remote memang lebih pendek daripada local,
2. tetapi gap-nya terpecah jelas antara timestamp-equivalent, out-of-band, obsolete, dan truly-pending,
3. prioritas remediation berikutnya adalah object yang masih benar-benar missing di live DB:
   - `expense_categories.is_active`,
   - `fn_reverse_material_invoice_stock_movement`,
   - `attendance_records_team_worker_date_project_key`,
   - `telegram_assistant_handoffs`,
   - dan backfill payroll snapshot yang belum menutup drift data.

## Next Task

Rekomendasi lanjutannya adalah `PRH-L2-05` untuk advisor remediation list.
