# Phase Boundaries (Repo-First)

Dokumen ini mendefinisikan boundary kerja per phase berdasarkan struktur repo aktual, agar task berikutnya tetap sempit, audit-friendly, dan minim regresi.

---

## Definisi Phase Saat Ini (Berdasarkan Repo)
Repo berisi:
- UI (React pages/components) yang aktif dikembangkan.
- Integrasi Telegram WebApp + Supabase (frontend).
- Backend ringan (Vercel serverless) + schema migrations (Supabase).

Kesimpulan repo-first:
- "UI-driven" bukan fitur bawaan repo, tetapi mode kerja yang bisa dipilih untuk membatasi scope.
- Jika user menyatakan UI-driven, artinya: treat backend/schema/integrasi data sebagai read-only kecuali diminta eksplisit.

---

## Phase: UI-Driven (Operasional)
### Tujuan
Memperbaiki UX/UI dan mobile behavior tanpa menyentuh sumber data, kontrak, atau integrasi backend.

### Boleh Disentuh (default)
- UI leaf dan layout:
  - `src/pages/*`
  - `src/components/*`
  - `src/components/ui/*`
  - `src/components/layouts/*`
- Styling:
  - `src/index.css`
  - `tailwind.config.js` (hanya jika task memang design-system/config, dan dengan audit ketat)
- Docs workflow:
  - `docs/ai-workflow/*`

### Jangan Disentuh (default)
- Backend serverless: `api/*`
- Schema/migrations: `supabase/migrations/*`
- Integrasi Supabase client: `src/lib/supabase.js`
- Auth bootstrap & routing core: `src/App.jsx` (kecuali task memang routing/auth)
- State global: `src/store/*` (kecuali task memang state/store)
- Config/dependency: `package.json`, lockfile, env, CI, Docker

### Kapan Task Dianggap UI-Only
- Hanya mengubah layout, komponen, copy, styling, aksesibilitas, dan behavior UI lokal.
- Tidak mengubah store, kontrak payload, atau API call.

### Validasi Minimal yang Disarankan
- `npm run lint`
- `npm run build` hanya jika perubahan memengaruhi bundling/routing/style global.

---

## Phase: Frontend-Integration (High Risk)
Phase ini berlaku jika task menyentuh salah satu:
- `src/App.jsx` (auth init, gating registered user, routes)
- `src/store/useAuthStore.js` atau store core lainnya
- `src/lib/supabase.js` atau flow query/mutations yang menyentuh backend

Aturan khusus:
- Scope harus eksplisit dan kecil.
- Wajib audit pemakai terdekat (search usage).
- Wajib validasi minimal + jelaskan risiko regresi.

---

## Phase: Backend-Only (Serverless)
### Boleh Disentuh
- `api/*` (Vercel serverless functions)

### Jangan Disentuh
- `src/**` (UI)
- `supabase/migrations/*` kecuali task schema khusus

### Validasi Minimal
- `npm run lint` (untuk kualitas JS)
- Tambahkan instruksi manual testing endpoint jika diperlukan (task harus menyebutkan).

---

## Phase: Schema/DB (Supabase) (Highest Risk)
### Boleh Disentuh
- `supabase/migrations/*` hanya untuk task schema yang eksplisit.

### Aturan Khusus
- Wajib rencana migrasi (backward compatibility, rollback).
- Jangan eksekusi migrasi atau menghubungkan DB kecuali task memang meminta.

---

## Contoh Task Aman vs Berisiko
### Aman (UI-driven)
- "Perbaiki scroll/overflow di `src/components/layouts/FormLayout.jsx` saja."
- "Rapikan class Tailwind pada `src/components/ui/BottomNav.jsx` tanpa ubah logic."
- "Perbaiki copy/label di `src/pages/TransactionsPage.jsx` tanpa ubah store."

### Berisiko (butuh scope ekstra)
- "Ubah flow auth Telegram" (menyentuh `src/App.jsx`/auth store).
- "Ubah schema tagihan" (migrasi supabase).
- "Refactor global design system" (menyentuh banyak halaman + CSS global).

---

## Catatan Area Operator/Dashboard
Tidak ada folder `src/routes/operator` di repo ini.
Area UI yang paling relevan untuk operator dashboard saat ini adalah:
- `src/pages/Dashboard.jsx`
- `src/pages/TransactionsPage.jsx`
- `src/components/layouts/MainLayout.jsx` + `src/components/ui/BottomNav.jsx`

