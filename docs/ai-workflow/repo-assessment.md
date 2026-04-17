# Repo Assessment (Sumber Kebenaran Repo-First)

Dokumen ini merangkum kondisi repo berdasarkan inspeksi file aktual. Jika ada pernyataan yang belum bisa dibuktikan dari repo, ditandai sebagai perlu verifikasi lanjutan.

Tanggal assessment: 2026-04-17

---

## Ringkasan Proyek (Terverifikasi)
- Aplikasi frontend React berjalan sebagai Telegram Mini Web App (menggunakan `window.Telegram.WebApp`).
- Routing menggunakan `react-router-dom` (Routes/Route) dengan `BrowserRouter`.
- State management menggunakan Zustand.
- Integrasi Supabase ada (client di frontend) dan migrasi schema ada di repo.
- Ada backend ringan berupa Vercel Serverless Functions di folder `api/`.

---

## Stack yang Terdeteksi (Berdasarkan `package.json`)
- Build tool: Vite
- UI: React + React DOM
- Routing: react-router-dom
- State: Zustand
- Backend client: @supabase/supabase-js
- Ikon: lucide-react
- PDF: jspdf + jspdf-autotable
- Linting: ESLint (flat config)
- Styling: Tailwind CSS + PostCSS + Autoprefixer

Tidak terdeteksi:
- TypeScript config (`tsconfig.json`) atau typecheck script.
- Test runner/script (`test`) di `package.json`.

---

## Struktur Folder Penting

### Frontend (utama)
- `src/main.jsx`: entry, `BrowserRouter` membungkus `<App />`.
- `src/App.jsx`: flow Telegram readiness + auth init + definisi routes.
- `src/pages/*`: halaman utama (Dashboard, Transactions, Projects, Master, More, dll).
- `src/components/*`: komponen feature/form.
- `src/components/layouts/*`: layout (misal MainLayout, FormLayout).
- `src/components/ui/*`: komponen UI reusable (misal BottomNav, SmartList).
- `src/store/*`: Zustand stores (auth, dashboard, master, dll).
- `src/hooks/useTelegram.js`: akses Telegram WebApp SDK.
- `src/lib/supabase.js`: inisialisasi Supabase client berbasis env Vite.

### Styling dan Design System (aktual)
- `src/index.css`: sumber utama CSS variables dan kelas komponen `app-*`.
  - Menggunakan `--tg-theme-*` bila tersedia, dengan fallback.
  - Saat ini `color-scheme` di root ditetapkan `light`.
- `tailwind.config.js`: konfigurasi Tailwind minimal (extend boxShadow `telegram`).

Catatan mismatch penting:
- Tidak ditemukan definisi token Tailwind seperti `bg-brand-bg`, `text-brand-text-primary`, dll di `tailwind.config.js`.
- Design system yang terverifikasi saat ini lebih dominan berbasis CSS variables `--app-*` + kelas `app-*`.

### Backend / Infrastruktur
- `api/*`: Vercel Serverless Functions (Node runtime).
  - Contoh: `api/auth.js` menggunakan Supabase dan memverifikasi initData Telegram.
- `supabase/migrations/*`: migrasi SQL untuk schema.

### Docs / Planning
- `docs/*`: dokumen perencanaan UI/UX dan playbook AI workflow.

---

## Script Validasi yang Tersedia (Berdasarkan `package.json`)
- `npm run dev`: jalankan Vite dev server
- `npm run build`: Vite build
- `npm run preview`: preview build
- `npm run lint`: ESLint untuk seluruh repo

Tidak tersedia:
- `test`
- `typecheck`

---

## Asumsi Awal yang Terbukti Benar
- "Telegram Mini Web App": benar (ada `useTelegram`, `tg.ready()`, `tg.expand()`).
- Ada pemisahan area frontend/backend: benar (frontend di `src/`, backend di `api/`, schema di `supabase/`).
- Ada area dashboard/operator/workspace: benar secara fungsional (halaman `Dashboard`, `Transactions`, `Projects`, dll di `src/pages/`).

---

## Asumsi Awal yang Tidak Terverifikasi / Perlu Koreksi
- "High-Contrast Dark Mode via tokens `brand-*` di Tailwind": tidak terverifikasi dari `tailwind.config.js`.
  - Repo saat ini masih dominan light theme via CSS variables di `src/index.css`.
- "Ada folder `src/routes/operator`": tidak ada.

---

## Risiko Salah-Scope untuk Task Berikutnya
- Mengubah styling dengan asumsi token `brand-*` ada dapat menyebabkan kelas Tailwind tidak ter-resolve.
- Mengubah flow auth Telegram/Supabase di `src/App.jsx` atau `src/store/useAuthStore.js` berisiko tinggi (login/akses).
- Mengubah migrasi `supabase/migrations/*` tanpa task khusus berisiko data/schema.
- Mengubah `api/auth.js` atau `api/notify.js` berisiko memutus integrasi serverless.

---

## Rekomendasi Boundary Kerja Codex (Berdasarkan Repo Nyata)
- UI-only (paling aman):
  - `src/pages/*`, `src/components/*`, `src/components/ui/*`, `src/components/layouts/*`, `src/index.css`
  - Larangan default: `api/*`, `supabase/migrations/*`, `src/store/*`, `src/lib/supabase.js`, `src/App.jsx` kecuali diminta.
- Backend-only:
  - `api/*` (serverless)
  - Larangan default: `src/**`
- Contract/shared-only:
  - `src/lib/*` dan store interface tertentu, tetapi harus dengan scope ketat dan audit pemakai.

Catatan repo hygiene:
- `.codex/` di-ignore oleh `.gitignore`, sehingga `.\.codex\config.toml` tidak otomatis ter-track git.

