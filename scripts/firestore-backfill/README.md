# Firestore Legacy JSON Extractor

Script ini mengekspor data legacy Firestore ke tiga lapisan artifact:

- `raw/` untuk dump Firestore per collection path
- `canonical/` untuk JSON yang sudah disesuaikan ke schema repo aktual
- `sidecar/` untuk identity bridge yang masih butuh mapping Telegram
- `meta/` untuk `manifest`, `id-map`, dan `validation-report`

Backfill domain data dan binary asset sekarang berjalan sampai tahap load ke Supabase + sync asset:

1. `extract.mjs` mengambil raw Firestore dan membentuk canonical JSON
2. `validate.mjs` mengecek integrity artifact dan menyusun `backfill-plan.json`
3. `load.mjs` membaca canonical JSON lalu upsert ke database Supabase
4. `sync-assets.mjs` mengunduh binary legacy lalu upload ke Supabase Storage
5. `stage.mjs` menjalankan `validate -> load:dry -> sync-assets:dry` dalam satu perintah

## Jalankan

```bash
node scripts/firestore-backfill/extract.mjs \
  --service-account ./serviceAccount.json \
  --project-id legacy-project-id \
  --output ./firestore-legacy-export
```

Atau pakai env:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_CLOUD_PROJECT`
- `FIRESTORE_PROJECT_ID`

## Default root collection

- `teams`
- `penerimaManfaat`
- `users`

## Hasil canonical

Format setiap file canonical:

```json
{
  "domain": "finance",
  "target_table": "expenses",
  "generated_at": "2026-04-23T00:00:00.000Z",
  "row_count": 3,
  "rows": []
}
```

`rows` berisi data insertable ke schema current repo, plus `legacy_firebase_id` bila tabel target memang menyediakannya.

## Identity sidecar

Data `teams/*/members` dan `users/*` dipisahkan ke `sidecar/identity/*` karena source legacy Firebase tidak punya Telegram user id. File ini dipakai untuk mapping manual sebelum backfill ke `team_members` dan `profiles`.

## Validasi export

Setelah export selesai, jalankan validator untuk cek integrity artifact dan menghasilkan rencana backfill:

```bash
node scripts/firestore-backfill/validate.mjs \
  --input ./firestore-legacy-export \
  --plan-file ./firestore-legacy-export/meta/backfill-plan.json
```

Script ini:

- memverifikasi `manifest.json`, `id-map.json`, dan `validation-report.json`
- mengecek konsistensi jumlah row/document dengan isi file JSON
- menyusun urutan load canonical dan bridge identity
- tidak menulis ke Supabase atau mengubah data source

## Load ke Supabase

Buat env file lokal, misalnya `.env.backfill.local`, dari template `.env.backfill.example` di root repo:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Lalu jalankan:

```bash
node scripts/firestore-backfill/load.mjs \
  --input ./firestore-legacy-export \
  --env-file ./.env.backfill.local
```

Atau lewat npm script:

```bash
npm run backfill:load -- \
  --input ./firestore-legacy-export \
  --env-file ./.env.backfill.local
```

Kalau batch pertama harus masuk ke workspace existing, tambahkan:

```bash
--target-team-id <uuid-team-existing>
```

Dry run:

```bash
npm run backfill:load:dry -- \
  --input ./firestore-legacy-export
```

Loader ini:

- hanya memuat artifact `canonical/*`
- tidak memuat `sidecar/identity/*` ke `profiles` atau `team_members`
- menormalisasi nominal loan dari `totalAmount` legacy ke `principal_amount` / `amount`, dan memakai `repayment_amount` hanya sebagai fallback untuk loan non-interest yang masih belum punya pokok
- mempertahankan `repayment_amount` sebagai total kewajiban pengembalian; `base_repayment_amount` tetap dihitung terpisah di snapshot loan
- hanya memuat `attendance_records` yang memang punya `projectId` legacy; row legacy tanpa `projectId` (umumnya `absent`) dilewati dari backfill agar selaras dengan aturan repo
- jika masih ada row attendance hasil backfill yang memakai `attendance_status = absent`, apply migration `supabase/migrations/20260421120000_allow_absent_attendance_status.sql` sebelum live load
- reconcile row yang auto-generated oleh trigger aktif:
  - `expenses -> bills / bill_payments`
  - `project_incomes -> fee bills`
  - `expense_line_items -> stock_transactions`
- menulis hasil ke `meta/load-report.json`

## Sync binary asset ke Supabase Storage

Setelah `backfill:load` selesai, jalankan sync binary untuk `file_assets`:

```bash
npm run backfill:sync-assets -- \
  --input ./firestore-legacy-export \
  --env-file ./.env.backfill.local
```

Dry run:

```bash
npm run backfill:sync-assets:dry -- \
  --input ./firestore-legacy-export
```

Kalau ingin dry run yang sekaligus membandingkan dengan row yang sudah ada di database, tambahkan `--env-file ./.env.backfill.local`.

Script ini:

- membaca artifact `canonical/file_assets`
- mencocokkan row yang sudah ter-load di database
- mengunduh binary dari `public_url` legacy bila masih `http(s)`
- meng-upload binary ke `storage_bucket` / `storage_path` target
- memperbarui `public_url`, `mime_type`, dan ukuran file di `file_assets`
- menulis hasil ke `meta/asset-sync-report.json`

## Urutan kerja yang disarankan

Paling praktis untuk staging dry-run:

```bash
npm run backfill:stage -- \
  --input ./firestore-legacy-export \
  --target-team-id <uuid-team-existing> \
  --env-file ./.env.backfill.local
```

`--input` bisa menunjuk ke folder hasil `extract.mjs` yang punya `meta/manifest.json`, atau ke snapshot mentah Firestore. Kalau input masih snapshot mentah, `backfill:stage` akan auto-normalize ke `normalized-artifact` di bawah snapshot source, lalu lanjut validate/load/sync.

Kalau ingin output artifact normalisasi ditaruh di lokasi lain, tambahkan `--artifact-output <dir>`.

Kalau `--input` menunjuk ke container snapshot yang berisi beberapa export bertimestamp, runner akan memilih snapshot terbaru berdasarkan `exportedAt`.

Perintah ini menjalankan:

- `extract.mjs --snapshot-input ...` bila diperlukan
- `validate.mjs --strict`
- `load.mjs --dry-run --strict`
- `sync-assets.mjs --dry-run`

Kalau sudah siap live ke staging, pakai:

```bash
npm run backfill:stage:live -- \
  --input ./firestore-legacy-export \
  --target-team-id <uuid-team-existing> \
  --env-file ./.env.backfill.local
```

Mode live:

- wajib `--confirm-live`
- wajib `--target-team-id`
- tetap auto-normalize snapshot mentah sebelum validate/load/sync
- menjalankan `load.mjs` dan `sync-assets.mjs` tanpa `--dry-run`
- `sync-assets.mjs` live berjalan dengan `--strict`
- kalau memanggil `load.mjs` atau `sync-assets.mjs` langsung tanpa `backfill:stage:live`, tetap tambahkan `--confirm-live`

Checklist operasional live staging ada di `docs/firestore-backfill-live-staging-checklist.md`.

Kalau ingin langkah manual, pakai urutan berikut:

```bash
npm run backfill:extract -- --service-account ./serviceAccount.json --project-id legacy-project-id --output ./firestore-legacy-export
npm run backfill:validate -- --input ./firestore-legacy-export --strict
npm run backfill:load:dry -- --input ./firestore-legacy-export --target-team-id <uuid-team-existing>
npm run backfill:load -- --input ./firestore-legacy-export --env-file ./.env.backfill.local --target-team-id <uuid-team-existing> --confirm-live
npm run backfill:sync-assets -- --input ./firestore-legacy-export --env-file ./.env.backfill.local --confirm-live
```

## Catatan

- `file_assets` disintesis dari URL attachment/logo legacy.
- `worker_wage_rates` dipecah dari object `projectWages`.
- `expense_line_items` dipecah dari array `items`.
- `bill_payments` dan `loan_payments` diekstrak dari subcollection `payments`.
- `load.mjs` sengaja memisahkan backfill domain data dari bridge identity Telegram/auth.
