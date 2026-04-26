# Production Readiness Env, Secret, and Logging Audit - 2026-04-25

Audit baseline date: `2026-04-25`  
Stream: `Production Readiness Hardening`  
Task: `PRH-L1-03`

## Scope

Audit ini memeriksa tiga hal yang paling rawan jangka panjang:

- kontrak environment variable untuk frontend, server, dan cron,
- boundary secret agar tidak bocor ke client atau log,
- dan pola logging yang bisa membuka data sensitif secara tidak sengaja.

Tidak ada runtime patch, migration, DDL/DML, atau deploy yang dijalankan.

## Sources Reviewed

- `.env`
- `.env.local`
- `.env.backfill.local`
- `vercel.json`
- `src/lib/supabase.js`
- `src/store/useTeamStore.js`
- `src/pages/HomePage.jsx`
- `api/auth.js`
- `api/recycle-bin-retention.js`
- `api/transactions.js`
- `api/records.js`
- `api/telegram-assistant.js`
- `api/report-pdf-delivery.js`
- `api/notify.js`
- Supabase advisors: security + performance

## Env Surface Inventory

| Surface | Env vars observed | Contract note | Risk |
| --- | --- | --- | --- |
| Frontend client | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `VITE_TELEGRAM_BOT_USERNAME` | Client only membaca publishable / anon key dan username bot untuk UI/linking | Rendah, selama tidak ada `service_role` masuk bundle |
| Auth bootstrap | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `TELEGRAM_BOT_TOKEN`, `APP_AUTH_SECRET`, `OWNER_TELEGRAM_ID`, `OWNER_TELEGRAM_IDS`, `TELEGRAM_OWNER_ID`, `VITE_OWNER_TELEGRAM_ID` | Server auth memegang semua secret; `APP_AUTH_SECRET` fallback ke bot token | Sedang, karena contract fallback implisit |
| Recycle-bin cron | `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RECYCLE_BIN_RETENTION_DAYS`, `RECYCLE_BIN_RETENTION_BATCH_LIMIT` | Endpoint retention diproteksi bearer cron secret dan service client | Rendah jika secret benar-benar server-only |
| Transaction/record servers | `SUPABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_INVOICE_MODEL`, `GEMINI_INVOICE_FALLBACK_MODELS` | Ada fallback ke `VITE_*` untuk kompatibilitas, tapi contract produksi perlu tetap mengutamakan var server-side | Sedang, karena fallback menyamarkan source contract |
| Telegram assistant | `SUPABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_ASSISTANT_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ASSISTANT_GEMINI_API_KEY`, `GEMINI_API_KEY`, `TELEGRAM_ASSISTANT_XAI_API_KEY`, `XAI_API_KEY`, `TELEGRAM_ASSISTANT_GEMINI_MODEL`, `TELEGRAM_ASSISTANT_XAI_MODEL` | Secret assistant dan provider AI tetap server-only; webhook secret punya dua nama yang harus dianggap setara | Sedang, karena surface besar dan variatif |
| Report delivery | `SUPABASE_URL`, `VITE_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `TELEGRAM_BOT_TOKEN` | Delivery DM memakai publishable key plus bearer user, bukan service role | Rendah, selama bot token tidak pernah keluar dari server |
| Notification worker | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_BOT_USERNAME`, `VITE_TELEGRAM_BOT_USERNAME` | Worker notifikasi sepenuhnya server-side | Rendah |

## Client Exposure Audit

- `src/lib/supabase.js` hanya memakai `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY`; tidak ada service role, bot token, atau cron secret di bundle client.
- `src/store/useTeamStore.js` hanya memakai `VITE_TELEGRAM_BOT_USERNAME` untuk link/label bot; ini bukan secret.
- `src/pages/HomePage.jsx` hanya menampilkan readiness status env client; tidak ada secret yang dirender.
- Tidak ditemukan pola client yang mengakses `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, atau webhook secret.

## Server Secret Boundary Audit

- `api/auth.js` memegang bootstrap auth penuh: verifikasi initData, create session, dan role bootstrap. Secret auth tetap server-side, tetapi `APP_AUTH_SECRET` masih fallback ke `TELEGRAM_BOT_TOKEN`, jadi contract produksinya harus didokumentasikan jelas.
- `api/recycle-bin-retention.js` benar-benar server-side: endpoint hanya jalan jika bearer `CRON_SECRET` valid dan service client tersedia.
- `api/transactions.js` dan `api/records.js` memakai fallback `SUPABASE_SERVICE_ROLE_KEY -> publishableKey`. Itu kompatibel, tetapi harus diperlakukan sebagai fallback deployment, bukan kontrak utama produksi.
- `api/telegram-assistant.js` memegang secret terbesar: Telegram bot token, webhook secret, Supabase service boundary, serta provider AI keys. Semua diproses di server dan tidak terlihat dibawa ke browser.
- `api/report-pdf-delivery.js` menggunakan Telegram bot token server-side untuk DM delivery, sementara auth ke Supabase tetap berbasis publishable key + bearer user.
- `api/notify.js` hanya membaca bot token dan chat id dari server env. Tidak ada indikasi secret ini dibundle ke client.

## Logging Audit

| Area | Log shape | Secret risk | Assessment |
| --- | --- | --- | --- |
| `api/auth.js` | `console.warn` saat redeem invite token dilewati; `console.error` saat bootstrap gagal dengan `stage`, `message`, `statusCode`, dan `profilesRoleColumnState` | Tidak menampilkan token, initData, atau service key | Aman untuk audit, tapi masih unstructured |
| `api/telegram-assistant.js` | `console.warn` untuk cleanup skipped / persist skipped; `console.error` untuk writer failed, classifier failed, dan fail final dengan `message`, `provider`, `statusCode`, `webhookSecretConfigured` | Tidak menampilkan secret literal, tapi memuat metadata operasional | Aman, tetapi log volume besar dan belum terpusat |
| `api/records.js` | `console.error` untuk cleanup / rollback / usage AI gagal | Error object bisa membawa detail provider, tapi tidak ada secret literal yang terlihat | Aman dengan catatan tetap hindari raw payload |
| `src/*` UI/store | Banyak `console.error` user-facing untuk fetch/save/mutation gagal | Bukan secret exposure, tapi bisa membocorkan detail error internal ke devtools | Rendah, namun noise tinggi |

## Findings

- Tidak ditemukan service role, bot token, atau cron secret di client bundle yang diperiksa.
- Tidak ditemukan log yang secara eksplisit mencetak secret literal atau request body mentah pada jalur yang diaudit.
- Kontrak env server masih tersebar di beberapa fallback chain `VITE_*` dan belum didokumentasikan dengan file `env example` atau contract file yang eksplisit.
- `.env`, `.env.local`, dan `.env.backfill.local` ada, tetapi tidak ada `.env.example`; ini membuat contract production vs local lebih sulit diaudit oleh manusia.
- Logging server sudah cukup aman secara isi, tetapi belum memiliki lapisan redaction atau structured logger yang konsisten.

## Conclusion

`PRH-L1-03` lolos sebagai audit hardening:

1. boundary secret client/server tidak menunjukkan bocor langsung,
2. logging yang ditemukan tidak memuat secret literal,
3. tetapi contract env masih terlalu implisit untuk production-grade maintenance.

Gap yang masih harus dibawa ke task berikutnya:

- dokumentasi contract env yang eksplisit,
- review fallback `VITE_*` pada server agar tidak jadi contract utama,
- dan opsi structured logging/redaction untuk server functions.

## Next Task

Rekomendasi lanjutannya adalah `PRH-L2-01` untuk delete/restore integrity.
