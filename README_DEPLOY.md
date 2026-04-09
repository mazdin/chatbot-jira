# Panduan Deployment ke Render (Free)

Ikuti langkah-langkah berikut untuk mengaktifkan bot Anda di cloud secara gratis.

## Langkah 1: Push ke GitHub
Buka terminal di folder proyek Anda dan jalankan perintah berikut:
```bash
git init
git add .
git commit -m "Initial commit for Jira Bot"
git branch -M main
git remote add origin https://github.com/mazdin/chatbot-jira.git
git push -u origin main
```
*Catatan: Pastikan file `.env` tidak ikut ter-upload (sudah diatur di `.gitignore`).*

## Langkah 2: Setup di Render.com
1.  Buka [Render.com](https://dashboard.render.com/) dan login menggunakan akun GitHub Anda.
2.  Klik tombol **New +** dan pilih **Web Service**.
3.  Pilih repository `chatbot-jira`.
4.  Konfigurasi Service:
    -   **Name**: `jira-qa-bot` (bebas).
    -   **Region**: Pilih yang terdekat (misal: Singapore).
    -   **Branch**: `main`.
    -   **Runtime**: `Node`.
    -   **Build Command**: `npm install`.
    -   **Start Command**: `npm start`.
    -   **Instance Type**: `Free`.
5.  Klik **Advanced** -> **Add Environment Variable** dan masukkan semua data dari file `.env` lokal Anda:
    -   `JIRA_DOMAIN`
    -   `JIRA_EMAIL`
    -   `JIRA_API_TOKEN`
    -   `TELEGRAM_BOT_TOKEN`
    -   `PORT` (isi `3000`)
6.  Klik **Create Web Service**.

## Langkah 3: Mencegah Bot "Tertidur" (UptimeRobot)
Karena menggunakan layanan gratis Render, bot akan "tidur" jika tidak ada aktivitas. Gunakan UptimeRobot untuk memancingnya:
1.  Buka [UptimeRobot.com](https://uptimerobot.com/).
2.  Tambahkan **New Monitor**:
    -   **Monitor Type**: `HTTP(s)`.
    -   **Friendly Name**: `Jira Bot Awake`.
    -   **URL**: Masukkan URL dari Render Anda (contoh: `https://jira-qa-bot.onrender.com/health`).
    -   **Monitoring Interval**: Setiap `10 menit`.
3.  Klik **Create Monitor**.

Bot Anda sekarang akan aktif 24/7!
