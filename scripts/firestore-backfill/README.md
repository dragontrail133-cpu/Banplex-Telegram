# Firestore Legacy JSON Extractor

Script ini mengekspor data legacy Firestore ke tiga lapisan artifact:

- `raw/` untuk dump Firestore per collection path
- `canonical/` untuk JSON yang sudah disesuaikan ke schema repo aktual
- `sidecar/` untuk identity bridge yang masih butuh mapping Telegram
- `meta/` untuk `manifest`, `id-map`, dan `validation-report`

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

## Catatan

- `file_assets` disintesis dari URL attachment/logo legacy.
- `worker_wage_rates` dipecah dari object `projectWages`.
- `expense_line_items` dipecah dari array `items`.
- `bill_payments` dan `loan_payments` diekstrak dari subcollection `payments`.
