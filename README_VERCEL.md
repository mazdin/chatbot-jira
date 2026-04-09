# Panduan Deployment ke Vercel (Tanpa Kartu Kredit)

Vercel memungkinkan Anda men-deploy bot ini secara gratis tanpa memerlukan kartu kredit.

## Langkah 1: Push Kode Terbaru ke GitHub
Pastikan Anda sudah melakukan push perubahan terbaru (mode Webhook) ke repo Anda:
```bash
git add .
git commit -m "Switch to Vercel Webhook mode"
git push origin main
```

## Langkah 2: Setup di Vercel
1.  Buka [Vercel.com](https://vercel.com/) dan login dengan GitHub.
2.  Klik **Add New...** -> **Project**.
3.  Pilih repository `chatbot-jira`.
4.  Di bagian **Environment Variables**, masukkan semua data dari `.env`:
    -   `JIRA_DOMAIN`
    -   `JIRA_EMAIL`
    -   `JIRA_API_TOKEN`
    -   `TELEGRAM_BOT_TOKEN`
    -   `PORT` (isi `3000`)
5.  Klik **Deploy**.
6.  Setelah selesai, Anda akan mendapatkan URL (misal: `https://chatbot-jira.vercel.app`). Simpan URL ini.

## Langkah 3: Mengaktifkan Webhook Telegram
**PENTING**: Bot Anda tidak akan merespon sampai Anda mendaftarkan URL Vercel ke Telegram.
Buka browser dan akses alamat berikut (ganti dengan data Anda):

`https://api.telegram.org/bot<TOKEN_BOT_ANDA>/setWebhook?url=<URL_VERCEL_ANDA>/api/webhook`

**Contoh:**
`https://api.telegram.org/bot8293388795:AAFsIw1RS.../setWebhook?url=https://chatbot-jira.vercel.app/api/webhook`

Jika muncul pesan `{"ok":true,"result":true,"description":"Webhook was set"}`, berarti bot Anda sudah aktif!

## Catatan:
-   Bot di mode Webhook tidak perlu UptimeRobot karena akan otomatis "bangun" saat ada pesan masuk.
-   Local testing (`npm start`) tidak akan menerima pesan dari Telegram di mode ini.
