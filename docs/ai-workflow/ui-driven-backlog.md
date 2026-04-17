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

