# Firestore Backfill Handoff

Tanggal: 2026-04-23

## Tujuan

Melanjutkan pipeline backfill dari legacy Firestore ke schema Supabase repo greenfield dengan alur:

1. extract Firestore legacy menjadi artifact
2. validate artifact
3. load canonical artifact ke Supabase
4. sync binary asset ke Supabase Storage

## Status Implementasi

Sudah selesai:

- fix extractor untuk `workers`
- tambah snapshot input mode di `scripts/firestore-backfill/extract.mjs`
- fix validator agar load sequence mencakup semua tabel canonical
- tambah loader baru `scripts/firestore-backfill/load.mjs`
- tambah helper remap team existing di loader
- tambah sync binary asset `scripts/firestore-backfill/sync-assets.mjs`
- tambah staging runner `scripts/firestore-backfill/stage.mjs`
- tambah npm scripts backfill
- tambah template env backfill
- update README backfill

Sudah diverifikasi end-to-end:

- snapshot export `firestore-legacy-export/full-export-2026-04-23-retry` bisa dinormalisasi lewat `extract.mjs --snapshot-input`
- `backfill:stage` bisa auto-extract snapshot mentah, lalu menjalankan `validate -> load:dry -> sync-assets:dry`
- kalau input adalah container snapshot dengan beberapa export bertimestamp, runner memilih snapshot terbaru berdasarkan `exportedAt`
- `backfill:stage:live` tersedia untuk staging write, dengan gate `--confirm-live` dan kewajiban `--target-team-id`
- live asset sync di stage runner berjalan dengan `--strict`
- live staging ke target existing workspace berhasil; `overtime_fee` di-drop saat live schema cache belum memuat kolom itu, attendance legacy tanpa `projectId` sekarang dilewati dari backfill, dan loader tidak lagi memetakan `absent` ke `half_day`
- normalisasi loan sekarang mengikuti arti field legacy: `totalAmount` = dana masuk/pokok, `totalRepaymentAmount` = total kewajiban pengembalian
- helper snapshot loan dan target payment UI kini mempertahankan `totalRepaymentAmount` legacy yang eksplisit, dan source transaksi workspace/history menggabungkan row `project-income` multi fee bill ke satu parent canonical agar hasil backfill tidak terlihat dobel di UI
- live backfill final ke project UI aktif dari `.env` berhasil setelah schema remote `attendance_records` diselaraskan agar menerima `attendance_status = 'absent'` dan kolom `overtime_fee`; `meta/load-report.json` mencatat `total_loaded = 4893`, `blocking_issues = 0`, dan `meta/asset-sync-report.json` mencatat `uploaded = 30`, `failed = 0`
- surface audit attendance hasil backfill ada di `Absensi` (sheet berbasis tanggal + proyek) dan `Payroll` (summary/rekap attendance); `Jurnal` memang tidak menampilkan row raw `attendance-record` karena source of truth ledger `vw_workspace_transactions` hanya memuat `project-income`, `expense`, `loan-disbursement`, dan `bill`
- `.env.backfill.local` belum menjadi target UI frontend dan project yang sempat diaudit di env itu belum memuat schema repo aktif, jadi verifikasi UI saat ini tetap harus diarahkan ke project `.env`

Masih tersisa:

- bridge identity ke `profiles` dan `team_members`

Checklist eksekusi live staging ada di `docs/firestore-backfill-live-staging-checklist.md`.

## File Yang Harus Dipindah Ke Repo Target

Overwrite file yang sudah ada:

- `scripts/firestore-backfill/extract.mjs`
- `scripts/firestore-backfill/validate.mjs`
- `scripts/firestore-backfill/README.md`

Tambahkan file baru:

- `scripts/firestore-backfill/load.mjs`
- `scripts/firestore-backfill/helpers.mjs`
- `scripts/firestore-backfill/sync-assets.mjs`
- `scripts/firestore-backfill/stage.mjs`
- `.env.backfill.example`
- `docs/firestore-backfill-handoff-2026-04-23.md`

Merge manual di `package.json`:

- `backfill:extract`
- `backfill:validate`
- `backfill:load`
- `backfill:load:dry`
- `backfill:stage`
- `backfill:sync-assets`
- `backfill:sync-assets:dry`

Catatan:

- jangan copy seluruh folder repo
- jangan copy `node_modules`
- jangan overwrite `package-lock.json` secara buta; jalankan `npm install` di repo target

## Dependency

Repo target harus punya dependency:

- `@supabase/supabase-js`

Setelah file dipindah, jalankan:

```bash
npm install
```

## File Env Yang Dibutuhkan

Buat `.env.backfill.local` di repo target berdasarkan `.env.backfill.example`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Jangan commit file env lokal ini.

## Input Yang Dibutuhkan Untuk Menjalankan Backfill

Minimal:

- artifact hasil extract di `./firestore-legacy-export`
- atau service account Firebase kalau extract mau dijalankan ulang
- env lokal `.env.backfill.local`

Artifact yang diharapkan:

- `firestore-legacy-export/raw/*`
- `firestore-legacy-export/canonical/*`
- `firestore-legacy-export/sidecar/*`
- `firestore-legacy-export/meta/manifest.json`
- `firestore-legacy-export/meta/backfill-plan.json`

## Command Urut Yang Harus Dijalankan Di Repo Target

Kalau artifact belum ada:

```bash
npm run backfill:extract -- --service-account ./serviceAccount.json --project-id legacy-project-id --output ./firestore-legacy-export
```

Staging dry-run:

```bash
npm run backfill:stage -- --input ./firestore-legacy-export --target-team-id <uuid-team-existing> --env-file ./.env.backfill.local
```

Validasi:

```bash
npm run backfill:validate -- --input ./firestore-legacy-export --strict
```

Dry run loader:

```bash
npm run backfill:load:dry -- --input ./firestore-legacy-export --target-team-id <uuid-team-existing>
```

Live load:

```bash
npm run backfill:load -- --input ./firestore-legacy-export --env-file ./.env.backfill.local --target-team-id <uuid-team-existing>
```

Sync asset binary:

```bash
npm run backfill:sync-assets -- --input ./firestore-legacy-export --env-file ./.env.backfill.local
```

## Perilaku Loader

Loader hanya memuat artifact `canonical/*`.

Loader tidak memuat:

- `sidecar/identity/users`
- `sidecar/identity/team_members`
- `sidecar/identity/profiles`

Identity bridge tetap dipisah karena schema target bergantung pada:

- `auth.users(id)`
- `telegram_user_id`

Kalau batch pertama harus masuk ke workspace existing, loader mendukung `--target-team-id <uuid>` untuk remap semua row bertanda `team_id` dan melewati seed `teams` legacy.

## Rekonsiliasi Trigger Yang Sudah Ditangani

Loader sudah dibuat untuk reconcile row yang auto-generated oleh trigger aktif:

- `expenses -> bills`
- `expenses(status=paid) -> bill_payments`
- `project_incomes -> fee bills`
- `expense_line_items -> stock_transactions`

Strategi yang dipakai:

- baca row hasil trigger yang sudah terbentuk
- remap canonical row ke row aktual di database
- upsert canonical payload ke row aktual itu

Tujuannya supaya histori tidak dobel.

## Sync Binary Asset

`scripts/firestore-backfill/sync-assets.mjs` menangani binary untuk `file_assets` setelah load selesai:

- baca artifact canonical `file_assets`
- cek row `file_assets` yang sudah ada di Supabase
- download binary dari `public_url` legacy yang masih `http(s)`
- upload ke `storage_bucket` / `storage_path` target
- update `public_url`, `mime_type`, dan ukuran file

## Risiko dan Hal yang Wajib Dicek

1. Trigger duplikasi histori

- pastikan tidak ada `bills` ganda dari `expenses`
- pastikan tidak ada `fee bills` ganda dari `project_incomes`
- pastikan tidak ada `stock_transactions` ganda dari `expense_line_items`

2. FK integrity

- `worker_wage_rates.worker_id`
- `expense_line_items.expense_id`
- `expense_attachments.file_asset_id`
- `bill_payments.bill_id`
- `loan_payments.loan_id`
- `attendance_records.salary_bill_id`

3. Field canonical vs schema final

Loader sudah whitelist kolom per tabel agar field liar tidak dikirim ke PostgREST. Tetap cek bila migration repo target berubah dari snapshot saat implementasi ini dibuat.

4. Identity belum dimuat

Domain data bisa masuk dulu, tapi `profiles` dan `team_members` masih butuh bridge manual.

## Snapshot Teknis Implementasi

Perubahan utama:

- `extract.mjs`
  - metadata canonical untuk `workers` ditambahkan
  - guard untuk memastikan semua tabel transform punya output metadata

- `validate.mjs`
  - `workers` masuk load sequence
  - guard untuk memastikan semua tabel canonical masuk urutan load

- `load.mjs`
  - parse CLI args
  - load env file
  - read manifest dan canonical artifacts
  - sanitize row per tabel
  - upsert per urutan FK-safe
  - reconcile trigger-generated rows
  - write `meta/load-report.json`

## Verifikasi Yang Sudah Dilakukan

Sukses:

- `node --check scripts/firestore-backfill/extract.mjs`
- `node --check scripts/firestore-backfill/validate.mjs`
- `node --check scripts/firestore-backfill/load.mjs`
- `node scripts/firestore-backfill/load.mjs --help`

Belum dilakukan:

- run terhadap artifact real di repo target
- run live ke Supabase target

## Ekspektasi Untuk Agent Berikutnya

Agent berikutnya tidak perlu audit ulang dari nol. Fokus langsung ke:

1. pindahkan file ke repo target
2. install dependency
3. jalankan `validate`
4. jalankan `load:dry`
5. review `meta/load-report.json`
6. jika aman, jalankan live load
7. lanjutkan identity bridge secara terpisah
