# Browser Desktop Jurnal Implementation Brief - 2026-04-26

## Summary

Brief ini mengunci batch pertama untuk desktop `Jurnal` di route canonical `/transactions`.
Targetnya adalah contract desktop `Jurnal` + adaptasi awal tabel `Aktif`, dengan boundary tetap menjaga tab `Tagihan` dan `Riwayat` sebagai bagian workspace yang sama.

Status:

- Draft implementasi masa depan.
- Turn ini docs-only; brief ini belum boleh dipakai untuk mengubah runtime code.
- Eksekusi baru boleh dibuka setelah gate auth-first dan desktop shell dinyatakan siap di progress log stream.

## Backlog IDs

- `BDA-L2-J1` — Lock Jurnal redesign contract
- `BDA-L2-J2` — Define sticky desktop Jurnal header
- `BDA-L2-J3` — Adapt Aktif into context-rich table

## Goal

- Menetapkan `Jurnal` sebagai workspace table desktop yang tetap route-based.
- Mempertahankan tiga tab setara: `Aktif`, `Tagihan`, `Riwayat`.
- Menyusun presentasi awal `Aktif` menjadi tabel desktop yang lebih informatif tanpa mengubah source-of-truth atau pola mutation.

## Source of Truth

- Route canonical: `/transactions`
- Tab state: query `tab` existing untuk `active`, `tagihan`, `history`
- UI surface: `src/pages/TransactionsPage.jsx`
- Presentation helpers: `src/lib/transaction-presentation.js`
- Data layer: `src/lib/transactions-api.js`
- Server boundary: `api/transactions.js`
- Final read sources: `vw_workspace_transactions`, `vw_history_transactions`

## Allowed Files

- `src/pages/TransactionsPage.jsx`
- `src/lib/transaction-presentation.js`

## Forbidden Files

- `src/App.jsx`
- `src/components/layouts/MainLayout.jsx`
- `src/components/ui/BottomNav.jsx`
- `src/store/*`
- `api/*`
- `supabase/migrations/*`
- `package.json`
- `package-lock.json`

## Scope In

- Kunci kontrak desktop `Jurnal` pada route `/transactions`.
- Pertahankan tab `Aktif`, `Tagihan`, dan `Riwayat` tanpa membuat tab baru.
- Tambahkan sticky workspace header desktop yang memuat title, tabs, search/filter controls, dan shortcut `Arsip`.
- Adaptasi tab `Aktif` menjadi tabel desktop dengan kolom baseline:
  - `Tanggal/Waktu`
  - `Tipe/Source`
  - `Proyek/Pihak`
  - `Deskripsi`
  - `Status Settlement`
  - `Nominal`
  - `Aksi`
- Pertahankan row click ke detail route existing dan action column + kebab model.
- Pertahankan cursor pagination existing dan `Muat Berikutnya`.

## Scope Out

- Rewrite `Dashboard`, `Reports`, `Payments`, atau `Master`.
- Numbered pagination baru.
- Inline mutation di tabel.
- Perubahan kontrak `/api/transactions`.
- Perubahan mutation flow pay/edit/delete.
- Perubahan `MainLayout`, `BottomNav`, atau shell mobile.

## Validation

- `npm run lint`
- `npm run build`
- Smoke mobile: `/transactions` tab switching dan navigasi existing tetap normal.
- Smoke desktop 1366px: sticky header, tabel `Aktif`, row click, dan `Muat Berikutnya`.

## Output

- Contract desktop `Jurnal` terdokumentasi dan siap dieksekusi.
- `Aktif` punya arah presentasi desktop yang jelas tanpa source-of-truth drift.
- Boundary perubahan tetap sempit dan audit-friendly.
