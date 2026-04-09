const express = require('express');
require('dotenv').config();
const telegramController = require('./src/controllers/telegramController');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser for Telegram Webhook
app.use(express.json());

// Initialize Telegram Bot commands
telegramController.initTelegramBot();

// Webhook endpoint
app.post('/api/webhook', async (req, res) => {
    await telegramController.handleWebhook(req, res);
});

// Cron job endpoint
app.get('/api/cron/cek', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).send('Unauthorized');
    }
    
    try {
        await telegramController.handleScheduledCheck();
        res.status(200).send('Cron processed');
    } catch (error) {
        console.error('Cron error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).send('Jira QA Telegram Bot is alive!');
});

// Root route
app.get('/', (req, res) => {
    res.send('Jira QA Telegram Bot is running on Vercel!');
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

// Proactive Trigger (Optional, based on requirements)
// This can be used to manually trigger a summary push to the space
app.get('/trigger-summary', async (req, res) => {
    // If user wants to trigger a notification to the webhook URL
    const axios = require('axios');
    const jiraService = require('./src/services/jiraService');
    const WEBHOOK_URL = process.env.GOOGLE_CHAT_WEBHOOK;

    try {
        const tasks = await jiraService.getMyTasks();
        const responseText = `🔔 *Notifikasi Harian Jira*\n\n` + 
            tasks.map(t => `🔹 *${t.key}* - ${t.status}\n   _${t.summary}_`).join('\n\n');
        
        await axios.post(WEBHOOK_URL, { text: responseText });
        res.status(200).send('Summary sent to Google Chat!');
    } catch (error) {
        console.error('Error triggering summary:', error);
        res.status(500).send('Failed to send summary.');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
