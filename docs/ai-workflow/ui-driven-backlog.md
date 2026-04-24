# UI-Driven Backlog (Micro-Task, Repo-First)

Backlog ini disusun berdasarkan struktur repo aktual. Semua item dirancang agar sempit, audit-friendly, dan minim regresi.
Catatan: ini adalah backlog rencana, bukan perubahan kode.

Format:
- ID
- Nama
- Tujuan
- Boleh disentuh
- Dilarang disentuh
- Validasi
- Risiko regresi
- Prasyarat
- Output diharapkan

---

## UI-001
Nama: Audit dan standardisasi pola scroll layout utama
Tujuan: memastikan pola scroll/safe-area konsisten di layout utama (tanpa menyentuh logic auth/store).
Boleh disentuh:
- `src/components/layouts/MainLayout.jsx`
- `src/components/ui/BottomNav.jsx`
- `src/index.css` (jika diperlukan untuk safe-area/padding)
Dilarang disentuh:
- `src/App.jsx`, `src/store/*`, `api/*`, `supabase/migrations/*`
Validasi:
- `npm run lint`
Risiko regresi:
- Medium (layout & scroll dapat memengaruhi seluruh halaman)
Prasyarat:
- Tidak ada
Output diharapkan:
- Layout scroll mobile stabil, tidak ada konten tertutup nav.

---

## UI-002
Nama: Perbaiki konsistensi surface (app-page-surface vs app-section-surface)
Tujuan: mengurangi inkonsistensi card/surface pada halaman utama tanpa refactor global.
Boleh disentuh:
- `src/index.css` (kelas `app-page-surface`, `app-section-surface`)
- 1 halaman target saja (contoh: `src/pages/Dashboard.jsx`)
Dilarang disentuh:
- `tailwind.config.js`, `src/store/*`, `api/*`, `supabase/migrations/*`
Validasi:
- `npm run lint`
- `npm run build` hanya jika menyentuh CSS global dalam skala besar
Risiko regresi:
- Medium (CSS global)
Prasyarat:
- Tentukan 1 halaman target untuk trial
Output diharapkan:
- Hierarki visual card lebih jelas dengan perubahan minimal.

---

## UI-003
Nama: Komponen list konsisten untuk transaksi (SmartList usage)
Tujuan: merapikan render item transaksi agar konsisten dengan design system `app-*` dan mengurangi class ad-hoc.
Boleh disentuh:
- `src/pages/TransactionsPage.jsx`
- `src/components/ui/SmartList.jsx`
Dilarang disentuh:
- `src/store/useDashboardStore.js`, `api/*`, `supabase/migrations/*`
Validasi:
- `npm run lint`
Risiko regresi:
- Low-Medium (render list)
Prasyarat:
- Pastikan tidak mengubah kontrak data transaksi
Output diharapkan:
- UI list lebih konsisten, tanpa mengubah data flow.

---

## UI-004
Nama: Form layout standar untuk halaman full-screen form
Tujuan: memastikan `FormLayout` konsisten untuk form full-screen (header, content scroll, footer submit) dan mobile safe-area.
Boleh disentuh:
- `src/components/layouts/FormLayout.jsx`
- 1 form target (contoh: `src/pages/AttendancePage.jsx` atau `src/pages/EditRecordPage.jsx`)
Dilarang disentuh:
- `src/store/*` kecuali diminta, `api/*`, `supabase/migrations/*`
Validasi:
- `npm run lint`
Risiko regresi:
- Medium (mempengaruhi banyak form)
Prasyarat:
- Pilih satu halaman form sebagai baseline
Output diharapkan:
- Scroll form stabil, footer submit tidak dobel, safe-area benar.

---

## UI-005
Nama: UX copy dan empty/error state konsisten
Tujuan: menyelaraskan copy dan style empty/error state di satu halaman prioritas tanpa sweeping.
Boleh disentuh:
- `src/pages/Dashboard.jsx` atau `src/pages/TransactionsPage.jsx` (pilih satu)
- `src/index.css` (jika butuh util class kecil)
Dilarang disentuh:
- `src/store/*`, `api/*`, `supabase/migrations/*`
Validasi:
- `npm run lint`
Risiko regresi:
- Low
Prasyarat:
- Pilih halaman prioritas
Output diharapkan:
- Empty/error state lebih jelas dan konsisten.

---

## UI-006
Nama: Boundary design system untuk dark/high-contrast (assessment-only)
Tujuan: menentukan apakah repo siap migrasi ke high-contrast dark mode (tanpa implementasi dulu).
Boleh disentuh:
- `docs/ai-workflow/*` (audit + rencana)
Boleh dibaca:
- `src/index.css`, `tailwind.config.js`
Dilarang disentuh:
- `src/**` (implementasi) pada task ini
Validasi:
- Tidak perlu command
Risiko regresi:
- None (docs-only)
Prasyarat:
- Tidak ada
Output diharapkan:
- Rencana migrasi bertahap, file target, dan risiko.

---

## UI-007
Nama: Struktur ulang keyboard Telegram assistant tanpa rename label
Tujuan: merapikan UX Telegram assistant agar menu utama tampil sebagai reply keyboard persisten, sementara aksi lanjutan tetap inline, tanpa mengubah label/command/callback existing.
Boleh disentuh:
- `api/telegram-assistant.js`
- `src/lib/telegram-assistant-routing.js`
- `tests/unit/telegram-assistant-routing.test.js`
- `docs/progress/PROGRESS_LOG.md`
Dilarang disentuh:
- `src/store/*`, `supabase/migrations/*`, `api/records.js`, `api/transactions.js`
Validasi:
- `npm run lint`
- `npm run build`
- `node --test tests/unit/telegram-assistant-routing.test.js`
Risiko regresi:
- Medium (perubahan routing text-to-command dan markup Telegram)
Prasyarat:
- Audit repo Telegram assistant sudah selesai
Output diharapkan:
- `/start` dan `Menu` menampilkan reply keyboard utama dengan label existing; aksi contextual tetap inline; command lama tetap kompatibel.

---

## UI-008
Nama: Summary drilldown untuk Status/Riwayat/Analytics tanpa buka workspace
Tujuan: ubah flow `Status`, `Riwayat`, dan `Analytics` supaya bucket/detail tampil sebagai summary chat AI hybrid, dengan drilldown inline, tanpa membuka workspace untuk summary flow.
Boleh disentuh:
- `api/telegram-assistant.js`
- `src/lib/telegram-assistant-routing.js`
- `tests/unit/telegram-assistant-routing.test.js`
- `docs/progress/PROGRESS_LOG.md`
Dilarang disentuh:
- `src/store/*`, `supabase/migrations/*`, `api/records.js`, `api/transactions.js`
Validasi:
- `npm run lint`
- `npm run build`
- `node --test tests/unit/telegram-assistant-routing.test.js`
Risiko regresi:
- Medium (callback routing baru dan formatting summary)
Prasyarat:
- UI-007 selesai dan reply keyboard utama sudah aktif
Output diharapkan:
- Bucket `Lunas / Dicicil / Belum lunas` membalas summary chat, analytics tetap inline, dan summary flow tidak membuka workspace.

---

## UI-009
Nama: Summary visual lebih menarik dan cleanup sesi Telegram
Tujuan: buat summary `Status`, `Riwayat`, dan `Analytics` lebih menarik secara visual, lalu bersihkan thread summary aktif saat sesi ditutup lewat `Menu`/back agar grup tidak noisy.
Boleh disentuh:
- `api/telegram-assistant.js`
- `src/lib/telegram-assistant-transport.js`
- `tests/unit/telegram-assistant-routing.test.js`
- `docs/progress/PROGRESS_LOG.md`
Dilarang disentuh:
- `src/store/*`, `supabase/migrations/*`, `api/records.js`, `api/transactions.js`
Validasi:
- `npm run lint`
- `npm run build`
- `node --test tests/unit/telegram-assistant-routing.test.js`
Risiko regresi:
- Medium (edit/delete message behavior di group)
Prasyarat:
- UI-008 selesai dan summary callback sudah aktif
Output diharapkan:
- Summary chat tampil lebih hidup dengan headline/Inti/Sorotan/CTA, dan thread summary di group dibersihkan otomatis saat summary baru terkirim serta saat sesi ditutup.

---

## UI-010
Nama: Perbaiki tracking message_id agar cleanup summary benar-benar jalan
Tujuan: pastikan summary Telegram menyimpan `message_id` dari respons `sendMessage` yang benar, lalu auto-delete pesan summary lama bekerja konsisten di group dan private.
Boleh disentuh:
- `api/telegram-assistant.js`
- `tests/unit/telegram-assistant-routing.test.js`
- `docs/progress/PROGRESS_LOG.md`
Dilarang disentuh:
- `src/store/*`, `supabase/migrations/*`, `api/records.js`, `api/transactions.js`
Validasi:
- `npm run lint`
- `npm run build`
- `node --test tests/unit/telegram-assistant-routing.test.js`
Risiko regresi:
- Medium (perubahan cleanup dan tracking state Telegram)
Prasyarat:
- UI-009 selesai
Output diharapkan:
- Summary lama tidak menumpuk lagi; `Menu` membersihkan sesi aktif; group dan private tetap menyisakan satu summary aktif yang terbaru.

---

## UI-011
Nama: Formatter summary HTML untuk catatan/tagihan
Tujuan: ubah output summary settlement/status menjadi bubble chat HTML yang lebih rapi, dengan quote header, section visual, emoji, escape HTML, dan parse_mode HTML.
Boleh disentuh:
- `api/telegram-assistant.js`
- `src/lib/telegram-assistant-transport.js`
- `tests/unit/telegram-assistant-routing.test.js`
- `docs/progress/PROGRESS_LOG.md`
Dilarang disentuh:
- `src/store/*`, `supabase/migrations/*`, `api/records.js`, `api/transactions.js`
Validasi:
- `npm run lint`
- `npm run build`
- `node --test tests/unit/telegram-assistant-routing.test.js`
Risiko regresi:
- Medium (format Telegram HTML dan ringkasan settlement)
Prasyarat:
- UI-010 selesai
Output diharapkan:
- Summary settlement tampil dengan `<blockquote>`, section Ringkasan/Status/Sorotan yang rapi, data dinamis aman di-escape, dan parse_mode HTML aktif saat mengirim summary.
Status:
- Selesai

---

## UI-012
Nama: Analytics loading fallback dan auto-delete bot-only
Tujuan: pastikan command `analytics` selalu membalas di chat dengan indikator loading sebelum hasil final, lalu jaga auto-delete tetap terbatas pada pesan bot lama agar group/private tetap rapi tanpa menghapus pesan user.
Boleh disentuh:
- `api/telegram-assistant.js`
- `src/lib/telegram-assistant-transport.js`
- `tests/unit/telegram-assistant-routing.test.js`
- `docs/progress/PROGRESS_LOG.md`
Dilarang disentuh:
- `src/store/*`, `supabase/migrations/*`, `api/records.js`, `api/transactions.js`
Validasi:
- `npx eslint api/telegram-assistant.js src/lib/telegram-assistant-transport.js tests/unit/telegram-assistant-routing.test.js`
- `npm run build`
- `node --test tests/unit/telegram-assistant-routing.test.js`
Risiko regresi:
- Medium (routing analytics, loading/edit flow Telegram, dan cleanup bot message)
Prasyarat:
- UI-011 selesai
Output diharapkan:
- Command `analytics` selalu menghasilkan balasan, muncul indikator loading sebelum hasil final, dan pesan bot lama tetap dibersihkan tanpa menyentuh pesan user.
Status:
- Selesai

---

## UI-013
Nama: Reply keyboard group routing dan loading heavy reply
Tujuan: izinkan label reply keyboard existing diproses di group juga, lalu tampilkan indikator loading untuk reply berat seperti `Status`, `Riwayat`, dan `Analytics` sebelum hasil final muncul.
Boleh disentuh:
- `api/telegram-assistant.js`
- `src/lib/telegram-assistant-transport.js`
- `tests/unit/telegram-assistant-routing.test.js`
- `docs/progress/PROGRESS_LOG.md`
Dilarang disentuh:
- `src/store/*`, `supabase/migrations/*`, `api/records.js`, `api/transactions.js`
Validasi:
- `npx eslint api/telegram-assistant.js src/lib/telegram-assistant-transport.js tests/unit/telegram-assistant-routing.test.js`
- `npm run build`
- `node --test tests/unit/telegram-assistant-routing.test.js`
Risiko regresi:
- Medium (routing reply keyboard di group dan loading/edit flow Telegram)
Prasyarat:
- UI-012 selesai
Output diharapkan:
- Reply keyboard existing seperti `Analytics` tidak lagi diam di group, dan reply berat memakai typing/loading sebelum hasil akhir dikirim.
Status:
- Selesai
