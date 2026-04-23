# Planning Decision Freeze

Freeze date: `2026-04-19`
Runtime reconciliation: `2026-04-23`
Product baseline: `Banplex Greenfield`

## 1. Product posture final

Banplex Greenfield adalah `Telegram Mini Web` untuk operator tim yang mengelola operasi harian melalui `Dashboard`, `Jurnal`, `Unit Kerja`, `Referensi`, `Tagihan`, `Pembayaran`, `Halaman Absensi`, `Catatan Absensi`, dan `Tagihan Upah`.

Postur final produk:

- produk ini adalah workspace operasional finansial dan eksekusi lapangan, bukan web dashboard generik,
- `Dashboard` adalah overview cepat,
- `Jurnal` adalah workspace aktif utama untuk record finansial, settlement, dan derived payable yang memang masuk ledger,
- `Halaman Absensi` existing adalah workspace input absensi harian,
- `Catatan Absensi` adalah halaman operasional payroll untuk histori, filter, dan rekap; ia bukan row utama ledger finance,
- `Tagihan Upah` adalah derived payable payroll yang boleh muncul di `Jurnal` dan `Riwayat`,
- `Riwayat` adalah completed/history surface,
- `Recycle Bin` adalah deleted/recovery surface terpisah,
- `Tim` adalah capability support/admin yang tetap masuk release core,
- `Telegram assistant` adalah helper read-only finance core di bot Telegram; ia hanya membaca data yang sudah ada, mendukung intent `status/search/navigate/analytics/clarify/refuse`, surface command `/menu /status /cari /analytics /riwayat /buka`, inline keyboard callback/deep link read-only, hybrid transcript pendek per chat, dan hasil akhir boleh natural-language selama tetap tervalidasi backend dari fact packet yang aman,
- `Referensi` / `Master` adalah jantung logika bisnis yang dipakai semua domain; secara product scope ia core release, walau beberapa boundary runtime masih transitional,
- `HRD` dan `Penerima Manfaat` tetap ada di repo tetapi bukan gate release inti,
- `Payment Receipt PDF` adalah supporting capability resmi fase awal untuk flow `Pembayaran`, bisa diregenerate, dan bukan source of truth,
- `Stok Barang` sudah hidup sebagai route supporting dengan monitoring stok dan manual stock-out terbatas, tetapi tetap bukan blocker release inti.

## 2. User, role, dan responsibility

| Role | Responsibility final | Batas utama |
| --- | --- | --- |
| `Owner` | mengawasi kebenaran data, keputusan hapus sensitif, scope release, dan kontrol `Tim` | tidak menjadi write surface harian wajib |
| `Admin` | menjalankan CRUD inti, restore, payment, referensi, dan pengelolaan `Tim` | tidak boleh mengubah logic inti di luar contract task |
| `Administrasi` | membantu input operasional yang disetujui role matrix | tanpa destructive action tertinggi |
| `Logistik` | mengelola `Dokumen Barang`, supplier/material, dan attachment yang relevan | tidak memegang delete sensitif finansial |
| `Payroll` | mengelola input di `Halaman Absensi`, histori/rekap di `Catatan Absensi`, `Tagihan Upah`, dan pembayaran gaji | tidak menjadi owner pengeluaran, pinjaman, atau dokumen barang |
| `Viewer` | baca data dan audit | tanpa write, restore, atau delete |

User utama release inti adalah `Owner`, `Admin`, `Administrasi`, `Logistik`, dan `Payroll`.

## 3. Entry model final

- Mode resmi saat ini adalah `Telegram Mini Web`.
- Entry resmi dimulai dari Telegram deep link atau launch Mini App, lalu bootstrap identitas dan akses workspace melalui `/api/auth`.
- Invite onboarding tetap resmi dan menjadi bagian dari capability `Tim`.
- Browser di luar Telegram hanya fallback dev atau reviewer. Browser bukan mode produk resmi.
- Bot Telegram tetap dipakai sebagai identity surface dan notification surface, bukan workflow chat utama.
- `Telegram assistant` dipakai sebagai surface percakapan read-only untuk finance core dengan command/inline read-only yang mengikuti planner dan verifier yang sama; ia bukan kanal chat bebas atau workflow mutasi.

## 4. IA/navigation final direction

Direction final arsitektur informasi:

- `Dashboard` = overview cepat, quick launch, dan status penting.
- `Jurnal` = workspace aktif utama untuk membaca dan menindaklanjuti record finansial, settlement, dan derived payable yang memang masuk ledger.
- `Unit Kerja` = ringkasan dan detail per proyek atau unit kerja.
- `Referensi` = master/reference yang menjadi fondasi input.
- `Tagihan` = workspace kewajiban aktif.
- `Pembayaran` = workspace histori dan aksi settlement per `Tagihan` atau `Dana Masuk / Pinjaman`.
- `Dokumen Barang` = keluarga dokumen untuk `Faktur Barang` dan `Surat Jalan Barang`.
- `Halaman Absensi` = workspace input absensi harian.
- `Catatan Absensi` = halaman histori absensi, filter bulanan, filter worker, dan aksi rekap payroll.
- `Tagihan Upah` = derived payable payroll yang boleh muncul di `Jurnal` dan `Riwayat`.
- `Riwayat` = completed/history surface.
- `Recycle Bin` = deleted/recovery surface terpisah.
- `Tim` = invite, membership, dan role management.
- `Stok Barang` = top-level route supporting aktif untuk monitoring stok dan manual stock-out terbatas; bukan blocker release inti.
- `Referensi` / `Master` = fondasi logika bisnis core release yang dipakai semua domain form inti; implementasi boundary yang masih transitional tidak menurunkan status domain ini.

### Superseded from older docs

- Label generik `More` tidak lagi menjadi bahasa produk resmi.
- Dashboard tidak lagi diposisikan sebagai surface CRUD campuran.
- `Team Invite` tidak lagi diperlakukan sekadar supporting optional; ia resmi menjadi capability support/admin di release core.

## 5. Dashboard contract

`Dashboard` dikunci sebagai overview cepat.

Aturan final:

- hanya menampilkan ringkasan yang dibaca dari read model server `/api/transactions?view=summary`,
- recent activity harus menjadi subset yang konsisten dari truth `Jurnal`,
- tidak menjadi write surface utama,
- tidak memegang menu aksi CRUD record,
- tetap memegang quick action ke route form inti dan navigasi ke `Tagihan`, `Jurnal`, `Unit Kerja`, atau `Tim`.

## 6. Ledger contract

`Jurnal` adalah workspace aktif utama.

Aturan final:

- `Jurnal` memuat record aktif lintas domain inti yang memang masuk ledger finance atau settlement,
- `Jurnal` tidak boleh bergantung pada load penuh client-side sebagai kontrak final,
- pencarian, filter, dan pagination wajib server-side,
- row `Jurnal` harus mengikuti canonical parent-child contract,
- `Tagihan` tidak menjadi ledger kedua yang bersaing dengan `Jurnal`,
- `Riwayat` dan completed dipisah dari flow aktif; completed tidak hilang dari histori,
- deleted recovery tetap memakai `Recycle Bin`, bukan `Riwayat`,
- tabel `transactions` bukan target write baru dan hanya dianggap compatibility/legacy layer bila masih dibaca.

Canonical domain aktif di `Jurnal`:

- `Pemasukan Proyek`
- `Pengeluaran`
- `Faktur Barang`
- `Surat Jalan Barang`
- `Dana Masuk / Pinjaman`
- `Tagihan Upah`
- `Pembayaran` sebagai settlement event kas nyata

`Halaman Absensi` dan `Catatan Absensi` tidak menjadi row utama di `Jurnal`.

`Tagihan` dan `Tagihan Upah` tampil sebagai child atau derived responsibility, bukan authoring surface yang menggantikan parent domain. `Tagihan Upah` boleh tampil sebagai row payroll payable di `Jurnal` dan `Riwayat`, dan dalam konteks payroll ia harus terbaca per worker.

## 7. Detail page contract

Detail page adalah surface audit dan navigasi keputusan.

Aturan final:

- detail wajib menampilkan parent record,
- detail wajib menampilkan child tree yang memengaruhi bisnis,
- detail wajib menampilkan alasan lock jika record tidak boleh diedit atau dihapus,
- detail wajib menyediakan CTA ke `Pembayaran`, `Riwayat`, atau parent/child terkait bila relevan,
- detail bukan tempat menyembunyikan lifecycle penting di balik state lokal store.

## 8. Create/edit contract

Aturan create/edit final:

- create/edit domain inti memakai routed full-screen form,
- form tidak otomatis menutup Mini App setelah submit,
- local draft hanya diizinkan untuk `Faktur Barang` dan `Surat Jalan Barang`,
- modal generik bukan target final untuk domain inti,
- detail dan `Jurnal` boleh menjadi titik masuk ke route edit, tetapi bukan tempat edit inline liar,
- jika record sudah memiliki payment history atau child settlement sensitif, edit harus dikunci dan dibuka lagi hanya lewat policy yang tertulis.

## 9. Domain rules final

### Project income

- `Pemasukan Proyek` disimpan sebagai parent record sendiri.
- Parent ini dapat menghasilkan child `Tagihan` fee atau staf.
- Payment tidak terjadi di parent; payment terjadi di child `Tagihan`.
- Parent boleh diedit atau di-soft-delete hanya selama child `Tagihan` belum punya payment history.
- Setelah child payment history ada, parent dianggap locked secara bisnis.

### Expense

- `Pengeluaran` tetap dimodelkan sebagai parent expense.
- `Tagihan` muncul sebagai child settlement hanya ketika kewajiban pembayaran masih hidup setelah create.
- `Pengeluaran` yang langsung lunas saat create tidak dipaksa mempertahankan `Tagihan` aktif sebagai entitas universal.
- Jika child `Tagihan` ada, status settlement final dimiliki child itu.
- Record dengan payment history tidak boleh dihapus langsung.

### Dokumen barang

#### Faktur Barang

- `Faktur Barang` adalah dokumen finansial material.
- Ia juga dapat mencatat stok masuk.
- Ia menggerakkan nilai finansial dan settlement `Tagihan`.
- Ia boleh `paid`, `unpaid`, atau `partial` melalui child `Tagihan`.
- Bila dibuat standalone, ia boleh mencatat stok masuk.
- Bila hasil konversi dari `Surat Jalan Barang`, stok masuk dari dokumen asal tidak boleh dihitung dua kali.
- Line items, attachment, dan settlement tetap berada dalam satu tree parent-child.
- Setelah ada payment history, edit line item dan edit header dikunci.

#### Surat Jalan Barang

- `Surat Jalan Barang` adalah dokumen fisik dan logistik.
- Ia mencatat stok masuk.
- Ia bukan surface pembayaran langsung.
- Ia dapat dikonversi menjadi `Faktur Barang` saat nilai finansial perlu ditagihkan.
- Konversi `Surat Jalan Barang -> Faktur Barang` tidak boleh menghitung stok dua kali.
- Stok keluar tidak dihitung otomatis dari dokumen barang; fase manual stock-out berada di `Stok Barang`.
- Stok minus diblok keras pada fase awal.

#### Wording settlement

- `Tagihan` dan `Pembayaran` child merepresentasikan settlement awareness atau sisa kewajiban, bukan identitas domain parent.
- `unpaid / partial / paid` adalah status settlement awareness; parent tetap berada pada domain asalnya.
- `partial` berarti sebagian nilai parent sudah terealisasi secara finansial, sementara sisanya masih outstanding.

### Superseded from older docs

- Model lama yang memperlakukan `Surat Jalan Barang` sebagai dokumen payable final disupersede.
- Status internal seperti `delivery_order` boleh tetap hidup di repo sebagai flag teknis, tetapi bukan bahasa produk final.

### Loan / Dana Masuk

- `Dana Masuk / Pinjaman` adalah parent loan.
- Settlement terjadi melalui child `Pembayaran` pinjaman.
- `unpaid / partial / paid` tetap settlement awareness pada parent yang sama.
- `partial` berarti sebagian arus kas sudah terealisasi dan sisanya outstanding.
- Formula utama memakai bunga flat: `pokok + (pokok x suku bunga x tenor)` bila bunga aktif.
- Aturan keterlambatan dan penalti tetap memakai snapshot terms server-side.
- Edit dan delete term inti diblok ketika payment history pinjaman sudah ada.

### Attendance / payroll

- `Halaman Absensi` existing adalah write surface utama untuk input absensi harian. Ia bukan `Catatan Absensi`.
- `Catatan Absensi` adalah halaman baru untuk histori absensi, filter per bulan, filter per worker, dan aksi rekap.
- Rekap payroll harus mendukung dua mode: per hari untuk banyak worker, dan per worker untuk rentang tanggal tertentu.
- Dalam konteks payroll operasional, worker adalah parent utama grouping; absensi harian adalah child record di bawah worker.
- `Tagihan Upah` dibentuk dari rekap child absensi per worker yang masih `unbilled`.
- `Tagihan Upah` adalah derived payable payroll yang boleh muncul di `Jurnal` dan `Riwayat`.
- Saat `Tagihan Upah` masuk ke `Jurnal`, row payroll harus tampil per worker, bukan bundle generik tanpa parent worker.
- Setelah absensi masuk ke `Tagihan Upah`, record absensi menjadi `read-only`.
- Koreksi absensi billed tidak dilakukan dengan edit diam-diam.
- Jika `Tagihan Upah` belum punya payment history, koreksi dilakukan dengan `batalkan rekap gaji`.
- Jika payment history sudah ada, cancellation atau void payment harus terjadi dulu sebelum rekap dibuka ulang.

## 10. System rules final

### Output

- Output inti produk adalah `Dashboard`, `Jurnal`, `Tagihan`, `Pembayaran`, `Unit Kerja`, `Riwayat`, `Recycle Bin`, dan detail page domain.
- Telegram notification hanya side effect.
- `Payment Receipt PDF` resmi sebagai supporting capability awal dari `Pembayaran` atau detail terkait.
- `Payment Receipt PDF` boleh diregenerate dari data settlement resmi.
- `Payment Receipt PDF` bukan source of truth dan bukan full business PDF suite.
- PDF notifikasi bot lain tetap side effect dan bukan source of truth.

### Error policy

- Error harus eksplisit dan terlihat di UI.
- Tidak ada silent fallback yang menyamarkan conflict data.
- Optimistic concurrency adalah default untuk update sensitif.
- Delete default adalah soft delete dengan audit trail.
- Cancellation payment diperlakukan sebagai log terarsip atau void, bukan hard delete diam-diam.

### Data boundary

- Domain inti memakai pola `read direct or read model server`, lalu `write API/RPC only`.
- Core domain tidak boleh membuat jalur write baru yang langsung ke tabel tanpa contract map.
- `transactions` tidak boleh dipakai sebagai source of truth write baru.
- Notification, theme, dan cache client tidak pernah menjadi authority data bisnis.

### Release scope

Core release yang dibekukan:

- `Dashboard`
- `Jurnal`
- `Unit Kerja`
- `Referensi`
- `Pemasukan Proyek`
- `Pengeluaran`
- `Dokumen Barang`
- `Dana Masuk / Pinjaman`
- `Tagihan`
- `Pembayaran`
- `Halaman Absensi`
- `Catatan Absensi`
- `Tagihan Upah`
- `Riwayat`
- `Tim`

Di luar gate inti:

- `HRD`
- `Penerima Manfaat`
- `Stok Barang` sebagai supporting route aktif di luar gate release inti
- browser-first mode resmi

### Superseded from older docs

- Klasifikasi lama yang menaruh `Team Invite` di supporting-only disupersede; `Tim` tetap masuk release core sebagai capability support/admin.

## 11. Open decisions yang SUDAH SELESAI

| Decision | Final answer |
| --- | --- |
| mode resmi produk | `Telegram Mini Web` |
| peran `Dashboard` | overview cepat |
| peran `Jurnal` | workspace aktif utama |
| dashboard vs ledger | dashboard tidak menjadi ledger kedua |
| status `transactions` | legacy compatibility layer, bukan write target baru |
| posisi `Tagihan` | derived payable workspace, bukan authoring parent |
| posisi `Halaman Absensi` | workspace input absensi harian existing |
| posisi `Catatan Absensi` | halaman baru untuk histori, filter, dan rekap payroll; bukan row utama `Jurnal` finance |
| posisi `Tagihan Upah` | derived payable payroll hasil rekap per worker yang boleh tampil di `Jurnal` dan `Riwayat` |
| semantik `Riwayat` | completed/history surface, bukan `Recycle Bin` |
| semantik `Recycle Bin` | deleted/recovery surface terpisah |
| relasi `Pengeluaran` vs `Tagihan` | child settlement hanya muncul saat kewajiban pembayaran masih hidup |
| payment deletion | soft delete atau void-log, bukan hard delete dari active flow |
| capability PDF awal | `Payment Receipt PDF` sederhana, regenerate-able, bukan source of truth |
| attendance correction | lewat pembatalan rekap atau payment, bukan edit diam-diam |
| klasifikasi `HRD` dan `Penerima Manfaat` | supporting, bukan gate release inti |
| klasifikasi `Tim` | core support/admin capability |
| peran `Stok Barang` | supporting route aktif, read/monitoring first + manual stock-out terbatas |

## 12. Remaining assumptions kecil yang tidak mengubah arah produk

- Nama route internal repo boleh tetap berbahasa Inggris selama bahasa produk dan UI mengikuti naming freeze.
- Suite business PDF penuh belum ditetapkan; capability PDF resmi fase awal hanya `Payment Receipt PDF`.
- `Stok Barang` boleh tetap hidup sebagai route supporting selama contract-nya tetap mengikuti freeze ini.
- Surface `HRD` dan `Penerima Manfaat` boleh tetap tampil di repo tanpa mengubah acceptance criteria core release.

## 13. Universal naming freeze

| Internal / legacy term | Nama final |
| --- | --- |
| `Dashboard` | `Dashboard` |
| `Transactions`, `Transaksi`, `Buku Kas Besar` | `Jurnal` |
| `Projects`, `Project Report` | `Unit Kerja` |
| `Master`, `Master Data` | `Referensi` |
| `Material Invoice`, `Material Docs` | `Dokumen Barang` |
| `material invoice`, `faktur material` | `Faktur Barang` |
| `surat_jalan`, `delivery order` | `Surat Jalan Barang` |
| `expense` | `Pengeluaran` |
| `loan`, `loan-disbursement` | `Dana Masuk / Pinjaman` |
| `bill` | `Tagihan` |
| `payment`, `bill payment`, `loan payment` | `Pembayaran` |
| `attendance`, `attendance input`, `attendance form` | `Halaman Absensi` |
| `attendance history`, `catatan absensi` | `Catatan Absensi` |
| `salary bill`, `payroll bill` | `Tagihan Upah` |
| `stock` | `Stok Barang` |
| `history`, `completed` | `Riwayat` |
| `recycle bin`, `deleted recovery`, `trash` | `Recycle Bin` |
| `team invite`, `team management` | `Tim` |

## 14. Planned but non-core modules

### Stok Barang

`Stok Barang` resmi masuk blueprint dan route runtime aktif, tetapi tetap bukan blocker core release.

Kontrak finalnya:

- modul ini supporting/non-core,
- modul ini sudah punya top-level route `/stock`,
- fase aktif sekarang adalah `read/monitoring first` dengan manual stock-out terbatas,
- stok masuk dipengaruhi `Surat Jalan Barang` dan `Faktur Barang`,
- `Faktur Barang` standalone boleh mencatat stok masuk,
- `Faktur Barang` hasil konversi dari `Surat Jalan Barang` tidak boleh double count stok masuk,
- stok keluar manual berada di `Halaman Stok` yang terpisah dan tidak berasal otomatis dari dokumen barang,
- stok minus diblok keras,
- `materials.current_stock` diperlakukan sebagai hasil domain movement, bukan angka bebas yang bisa diubah dari mana saja.
