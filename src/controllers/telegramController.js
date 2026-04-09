const TelegramBot = require('node-telegram-bot-api');
const jiraService = require('../services/jiraService');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
// Enable polling for local testing, disable for Webhook mode (Vercel/Production)
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';
const bot = new TelegramBot(token, { polling: !isProduction });

// Configuration for commands and their associated statuses
const COMMAND_CONFIG = {
    '/cek': ['Picked Development', 'In Progress', 'Code Review', 'Feedback'],
    '/testing': ['Testing'],
    '/complete': ['Test Complete'],
    '/complite': ['Test Complete'], // Alias for typo
    '/done': ['Done']
};

/**
 * Priority for sorting. Lower number = higher priority (appears first)
 */
const STATUS_PRIORITY = {
    'PICKED DEVELOPMENT': 1,
    'IN PROGRESS': 2,
    'CODE REVIEW': 3,
    'FEEDBACK': 4,
    'TESTING': 5,
    'TEST COMPLETE': 6,
    'DONE': 7
};

function initTelegramBot() {
    console.log('Telegram Bot configured for Webhooks.');

    // Set the command menu (the '/' button menu)
    bot.setMyCommands([
        { command: 'cek', description: 'Cek task PICKED DEVELOPMENT - FEEDBACK' },
        { command: 'testing', description: 'Cek task status TESTING' },
        { command: 'complete', description: 'Cek task status TEST COMPLETE' },
        { command: 'done', description: 'Cek task status DONE' }
    ]);
}

/**
 * Main Webhook Dispatcher
 * Handles incoming updates from Telegram and routes them to the correct command
 */
async function handleWebhook(req, res) {
    const update = req.body;
    
    if (!update || !update.message) {
        return res.status(200).send('OK');
    }

    const msg = update.message;
    const text = msg.text ? msg.text.trim() : '';
    const chatId = msg.chat.id;

    try {
        // 1. Handle /start
        if (text.startsWith('/start')) {
            const keyboard = {
                reply_markup: {
                    keyboard: [
                        ['/cek', '/testing'],
                        ['/complete', '/done']
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: false
                }
            };
            await bot.sendMessage(chatId, 'Halo! Saya Jira QA Bot. 🤖\n\nGunakan menu di bawah ini untuk mengecek task Anda:', keyboard);
            return res.status(200).send('OK');
        }

        // 2. Handle mapped commands
        let matched = false;
        for (const [command, statuses] of Object.entries(COMMAND_CONFIG)) {
            if (text.startsWith(command)) {
                const title = `*Jira Task Summary (${command})*`;
                await handleJiraCommand(msg, statuses, title);
                matched = true;
                break;
            }
        }

        // 3. Handle plain text aliases if not matched yet
        if (!matched) {
            const lowerText = text.toLowerCase();
            if (lowerText === 'cek task') {
                await handleJiraCommand(msg, COMMAND_CONFIG['/cek'], '*📋 Daftar Task (Sprint Aktif)*');
            } else if (lowerText === 'task testing') {
                await handleJiraCommand(msg, COMMAND_CONFIG['/testing'], '*🧪 Task dalam Status TESTING*');
            } else if (lowerText === 'task done') {
                await handleJiraCommand(msg, COMMAND_CONFIG['/done'], '*✅ Task Selesai (DONE)*');
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook processing error:', error);
        // Still send 200 to Telegram to prevent retries if the error is handled
        res.status(200).send('OK');
    }
}

/**
 * Common logic to fetch, sort, count, and send to Telegram
 */
async function handleJiraCommand(msg, statuses, title) {
    const chatId = msg.chat.id;
    try {
        let tasks = await jiraService.getMyTasks(statuses);
        
        // Sort tasks by priority map
        tasks.sort((a, b) => {
            const priorityA = STATUS_PRIORITY[a.status.toUpperCase()] || 99;
            const priorityB = STATUS_PRIORITY[b.status.toUpperCase()] || 99;
            return priorityA - priorityB;
        });

        // Generate counts and category breakdown per status
        const statusData = {};
        statuses.forEach(s => {
            statusData[s.toUpperCase()] = { count: 0, tr: 0, tc: 0 };
        });

        tasks.forEach(task => {
            const statusKey = task.status.toUpperCase();
            if (!statusData[statusKey]) {
                statusData[statusKey] = { count: 0, tr: 0, tc: 0 };
            }
            
            statusData[statusKey].count++;
            
            const summary = task.summary.toUpperCase();
            if (summary.includes('QA TEST RUN')) {
                statusData[statusKey].tr++;
            } else if (summary.includes('QA TEST CASE')) {
                statusData[statusKey].tc++;
            }
        });

        const messages = formatTelegramResponse(title, tasks, statusData, statuses);
        
        for (const message of messages) {
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        console.error('Error in Telegram Bot:', error);
        bot.sendMessage(chatId, '❌ Maaf, terjadi kesalahan saat mengambil data dari Jira.');
    }
}

/**
 * Format tasks for Telegram Markdown, including counts and splitting if too long
 */
function formatTelegramResponse(title, tasks, statusData, targetStatuses) {
    const MAX_LENGTH = 4000;
    const messages = [];

    // Header with Counts and Breakdown
    let header = `${title}\n`;
    header += `📊 *Total: ${tasks.length} Task*\n\n`;
    
    targetStatuses.forEach(s => {
        const data = statusData[s.toUpperCase()] || { count: 0, tr: 0, tc: 0 };
        header += `📍 *${s}*: ${data.count}`;
        if (data.tr > 0 || data.tc > 0) {
            header += ` (TR: ${data.tr}, TC: ${data.tc})`;
        }
        header += '\n';
    });
    header += '\n';

    if (tasks.length === 0) {
        messages.push(header + 'Tidak ada task ditemukan.');
        return messages;
    }

    let currentMessage = header;
    
    tasks.forEach(task => {
        let taskString = `🔹 *${task.key}* [${task.status}]\n`;
        const safeSummary = task.summary.replace(/[_*`]/g, '\\$&');
        taskString += `_${safeSummary}_\n`;
        taskString += `🏃 Sprint: ${task.sprint}\n\n`;

        if ((currentMessage.length + taskString.length) > MAX_LENGTH) {
            messages.push(currentMessage);
            currentMessage = `(Lanjutan)\n\n${taskString}`;
        } else {
            currentMessage += taskString;
        }
    });

    messages.push(currentMessage);
    return messages;
}

// handleWebhook is now defined above with the dispatcher logic

module.exports = {
    initTelegramBot,
    handleWebhook
};
