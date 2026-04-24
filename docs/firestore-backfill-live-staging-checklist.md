# Firestore Backfill Live Staging Checklist

Pakai checklist ini setelah `backfill:stage` dry-run sudah bersih dan `target-team-id` staging final sudah dipilih.

## Prasyarat

- `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` sudah ada di `.env.backfill.local`
- `target-team-id` final sudah ditentukan
- staging sudah dibackup jika ada data yang perlu dipertahankan
- input menunjuk ke snapshot export atau artifact hasil normalisasi

## Command

Jalankan live staging dengan gate eksplisit:

```bash
npm run backfill:stage:live -- \
  --input ./firestore-legacy-export/full-export-2026-04-23-retry \
  --target-team-id <uuid-team-existing> \
  --env-file ./.env.backfill.local
```

Kalau ingin artifact hasil normalisasi ditaruh di lokasi lain, tambahkan:

```bash
--artifact-output ./firestore-legacy-export/<snapshot-name>/normalized-artifact
```

## Alur Yang Dijalankan

1. Auto-extract snapshot mentah bila input belum berupa artifact.
2. Jalankan `validate.mjs --strict`.
3. Jalankan `load.mjs` live ke Supabase.
4. Jalankan `sync-assets.mjs --strict` live ke Supabase Storage.

## Output Yang Harus Dicek

Setelah command selesai, review:

- `.../normalized-artifact/meta/load-report.json`
- `.../normalized-artifact/meta/asset-sync-report.json`

Checklist lulus kalau:

- exit code command `0`
- `load-report.json` tidak berisi issue blocking
- `asset-sync-report.json` tidak berisi issue
- `target-team-id` yang terpakai memang workspace staging final
- kalau bypass runner dan memanggil `load.mjs` / `sync-assets.mjs` langsung, tetap tambahkan `--confirm-live`

## Stop Condition

Hentikan proses bila:

- `backfill:stage:live` gagal di salah satu step
- `load-report.json` atau `asset-sync-report.json` menunjukkan issue
- env live tidak menunjuk ke Supabase staging yang benar

## Setelah Berhasil

- smoke test UI pada workspace staging
- cek PDF/report, payment, attendance, stock, dan attachment
- jangan lanjut production sebelum staging lolos audit
