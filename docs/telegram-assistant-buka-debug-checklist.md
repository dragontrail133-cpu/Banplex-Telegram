# Telegram Assistant `buka` Debug Checklist

Checklist ini dipakai untuk membedakan tiga sumber masalah yang paling mungkin saat tombol inline `buka` terasa tidak bekerja: pesan lama, deploy terbaru yang belum dipakai, atau konfigurasi Telegram Mini App/BotFather.

## Baseline yang sudah terverifikasi
- Bot username aktif: `banplex_greenfield_bot`
- Webhook production aktif: `https://banplex-telegram.vercel.app/api/telegram-assistant`
- Format tombol `buka` canonical: `https://t.me/<bot>?startapp=...`

## Checklist
1. Kirim `/menu` atau `/buka` dari pesan baru, setelah deploy production terbaru.
2. Klik tombol dari balasan terbaru itu, bukan dari pesan lama yang masih tersimpan di chat.
3. Jika tombol tidak membuka app, cek apakah URL target yang dibangun memang memakai format `https://t.me/<bot>?startapp=...`.
4. Jika URL benar tetapi Mini App tetap tidak terbuka, cek `BotFather`:
   - `Main Mini App`
   - `/setdomain`
   - domain production `https://banplex-telegram.vercel.app`
5. Jika URL salah atau kosong, periksa `VITE_TELEGRAM_BOT_USERNAME` / `TELEGRAM_BOT_USERNAME` pada environment production lalu redeploy.
6. Jika semua di atas benar, masalah tersisa biasanya ada di Telegram client, cache pesan lama, atau client yang tidak memuat update terbaru.

## Interpretasi cepat
- Pesan baru berhasil membuka app: problem ada di pesan lama.
- Pesan baru gagal, URL salah: problem ada di bot username/env atau builder link.
- Pesan baru gagal, URL benar: problem ada di BotFather atau client Telegram.
