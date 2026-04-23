# Firestore Backfill Handoff

Tanggal: 2026-04-23

## Tujuan

Melanjutkan pipeline backfill dari legacy Firestore ke schema Supabase repo greenfield dengan alur:

1. extract Firestore legacy menjadi artifact
2. validate artifact
3. load canonical artifact ke Supabase

## Status Implementasi

Sudah selesai:

- fix extractor untuk `workers`
- fix validator agar load sequence mencakup semua tabel canonical
- tambah loader baru `scripts/firestore-backfill/load.mjs`
- tambah npm scripts backfill
- tambah template env backfill
- update README backfill

Belum selesai diverifikasi end-to-end:

- belum test `validate` dan `load:dry` terhadap artifact real di repo target
- belum test live load ke Supabase target
- belum jalankan bridge identity ke `profiles` dan `team_members`

## File Yang Harus Dipindah Ke Repo Target

Overwrite file yang sudah ada:

- `scripts/firestore-backfill/extract.mjs`
- `scripts/firestore-backfill/validate.mjs`
- `scripts/firestore-backfill/README.md`

Tambahkan file baru:

- `scripts/firestore-backfill/load.mjs`
- `.env.backfill.example`
- `docs/firestore-backfill-handoff-2026-04-23.md`

Merge manual di `package.json`:

- `backfill:extract`
- `backfill:validate`
- `backfill:load`
- `backfill:load:dry`

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

Validasi:

```bash
npm run backfill:validate -- --input ./firestore-legacy-export --strict
```

Dry run loader:

```bash
npm run backfill:load:dry -- --input ./firestore-legacy-export
```

Live load:

```bash
npm run backfill:load -- --input ./firestore-legacy-export --env-file ./.env.backfill.local
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
