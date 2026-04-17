# Transactions CRUD Backend Follow-up

Tanggal: 2026-04-17
Status: partial
Scope: backend/store follow-up untuk mock CRUD di halaman `Transaksi`

## Latar Belakang

Halaman `Transaksi` saat ini hanya memakai source of truth dari `useDashboardStore` yang menggabungkan:

- `project_incomes`
- `loans`
- `bill_payments`
- `loan_payments`

Pada revisi frontend phase 3, tombol `Detail`, `Edit`, dan `Hapus` di setiap item masih **mock only**. Tujuannya hanya menyediakan affordance UI tanpa mengubah backend aktif pada fase ini.

Catatan implementasi terbaru:

- item mutasi yang editable sekarang sudah memakai aksi nyata di `src/pages/TransactionsPage.jsx`
- mutasi `project-income` dan `loan-disbursement` bisa dibuka, diedit, dan dihapus sesuai policy store yang ada
- mutasi pembayaran tetap read-only karena belum ada kontrak edit/reverse yang aman

## Kenapa Belum Diimplementasikan Sekarang

- Scope user untuk task ini adalah frontend-only.
- Model data transaksi masih agregasi lintas tabel, belum ada satu kontrak backend khusus untuk list transaksi dengan operasi CRUD generik.
- Beberapa item di list adalah event pembayaran (`bill_payments`, `loan_payments`), bukan entitas transaksi tunggal yang aman diperlakukan dengan CRUD universal.

## Gap Teknis yang Harus Diselesaikan

### 1. Kontrak item transaksi terpadu

Butuh kontrak backend/store yang eksplisit untuk setiap row list transaksi, minimal:

- `id`
- `source_type`
- `entity_id`
- `team_id`
- `can_view`
- `can_edit`
- `can_delete`
- `detail_route` atau metadata resolver
- `delete_strategy`

Tanpa ini, frontend hanya bisa menebak aksi berdasarkan `sourceType`.

### 2. Resolver detail per source type

Perlu pemetaan yang jelas:

- `project-income` -> detail/edit dari `project_incomes`
- `loan-disbursement` -> detail/edit dari `loans`
- `bill-payment` -> detail read-only atau reverse flow khusus
- `loan-payment` -> detail read-only atau reverse flow khusus

### 3. Delete policy yang aman

Delete tidak bisa digeneralisasi. Perlu policy per entitas:

- apakah soft delete
- apakah hanya boleh untuk draft
- apakah forbidden jika sudah punya relasi turunan
- bagaimana audit trail dicatat

### 4. Read/detail endpoint atau selector

Tombol `Detail` perlu sumber data yang konsisten. Opsi:

- buat RPC/view transaksi terpadu
- buat selector store per `sourceType`
- atau buat service resolver frontend yang memanggil fetch detail spesifik

### 5. Edit policy untuk item pembayaran

Perlu keputusan bisnis:

- apakah `bill_payments` bisa diedit
- apakah `loan_payments` bisa diedit
- apakah hanya bisa void/reverse
- apakah harus immutable untuk alasan audit

## Rekomendasi Implementasi Bertahap

### Phase A — Metadata resolver

- Tambah metadata transaksi terpadu di store dashboard
- Tentukan `can_edit`, `can_delete`, dan `detail_mode` per row

### Phase B — Detail flow

- Implement tombol `Detail` real
- Resolver diarahkan per `sourceType`
- Minimal read-only lebih dulu

### Phase C — Edit flow

- Aktifkan `Edit` hanya untuk entitas yang benar-benar aman
- Reuse route existing jika sudah ada

### Phase D — Delete flow

- Tambahkan confirm dialog + soft delete policy
- Pastikan audit trail dan constraint relasional aman

## File Kandidat yang Nanti Perlu Dikerjakan

- `src/store/useDashboardStore.js`
- `src/pages/TransactionsPage.jsx`
- `src/store/useIncomeStore.js`
- `src/store/usePaymentStore.js`
- `src/store/useBillStore.js`

Jika perlu backend/schema tambahan:

- `supabase/migrations/*`
- `api/*` hanya bila kontrak baru memang dibutuhkan

## Catatan Penting

- Jangan implement CRUD universal transaksi sebelum kontrak source of truth final disepakati.
- Untuk repo ini, transaksi adalah agregasi lintas domain, jadi shortcut backend yang terlalu generik berisiko merusak audit trail dan integrasi pembayaran.
