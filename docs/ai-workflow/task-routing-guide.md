# Task Routing Guide (Berdasarkan Struktur Repo)

Tujuan: membantu menentukan klasifikasi task sebelum implementasi agar scope tetap sempit dan minim regresi.

---

## 1) Docs-only
Ciri:
- Hanya menyentuh `docs/**`, `AGENTS.md`, atau file workflow non-produksi.
Contoh scope file:
- `docs/ai-workflow/*`
- `docs/*.md`
Validasi:
- Self-review + cek konsistensi path.
Larangan:
- Jangan menyentuh `src/**`, `api/**`, `supabase/**`.

---

## 2) UI-only (UI-driven)
Ciri:
- Perubahan UI/UX lokal tanpa mengubah state global, kontrak data, atau integrasi backend.
Contoh scope file:
- `src/pages/*`
- `src/components/*`
- `src/components/ui/*`
- `src/components/layouts/*`
- `src/index.css`
Validasi:
- `npm run lint`
- `npm run build` hanya jika perubahan menyentuh area global (routing core/CSS global/Tailwind config).
Larangan default:
- `src/store/*`, `src/lib/supabase.js`, `src/App.jsx`, `api/*`, `supabase/migrations/*`

---

## 3) Backend-only (Serverless)
Ciri:
- Perubahan pada Vercel serverless functions, tanpa perubahan UI.
Contoh scope file:
- `api/auth.js`, `api/notify.js`
Validasi:
- `npm run lint`
Larangan:
- Jangan menyentuh `src/**` kecuali task eksplisit lintas boundary.

---

## 4) Shared/Contract
Ciri:
- Perubahan menyentuh bagian yang dipakai banyak area (risk of regression).
Contoh kandidat (gunakan hanya jika task memang contract):
- `src/lib/*` (misal `src/lib/rbac.js`, `src/lib/auth-context.js`)
- Interface/payload yang dipakai store dan UI
Aturan:
- Scope kecil, audit pemakai (search), dan jelaskan risiko.
Validasi:
- `npm run lint`
- `npm run build` jika perubahan memengaruhi bundling/import graph.

---

## 5) Review/Audit-only
Ciri:
- User meminta review tanpa perubahan.
Aturan:
- Jangan edit file.
Output:
- Temuan terurut, risiko, dan rekomendasi micro-task (dengan scope file).

