const TelegramBot = require('node-telegram-bot-api');
const jiraService = require('../services/jiraService');
const googleChatService = require('../services/googleChatService');
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
        { command: 'done', description: 'Cek task status DONE' },
        { command: 'issue', description: 'Cek task type Issue (Project SBXS)' }
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

        // 2. Handle /myid
        if (text.startsWith('/myid')) {
            await bot.sendMessage(chatId, `ID Chat Anda adalah: \`${chatId}\``, { parse_mode: 'Markdown' });
            return res.status(200).send('OK');
        }

        // 3. Handle /issue
        if (text.startsWith('/issue')) {
            await handleIssueCommand(chatId);
            return res.status(200).send('OK');
        }

        // 3. Handle mapped commands
        let matched = false;
        for (const [command, statuses] of Object.entries(COMMAND_CONFIG)) {
            if (text.startsWith(command)) {
                const title = `*Jira Task Summary (${command})*`;
                await handleJiraCommand(chatId, statuses, title);
                matched = true;
                break;
            }
        }

        // 4. Handle plain text aliases if not matched yet
        if (!matched) {
            const lowerText = text.toLowerCase();
            if (lowerText === 'cek task') {
                await handleJiraCommand(chatId, COMMAND_CONFIG['/cek'], '*📋 Daftar Task (Sprint Aktif)*');
            } else if (lowerText === 'task testing') {
                await handleJiraCommand(chatId, COMMAND_CONFIG['/testing'], '*🧪 Task dalam Status TESTING*');
            } else if (lowerText === 'task done') {
                await handleJiraCommand(chatId, COMMAND_CONFIG['/done'], '*✅ Task Selesai (DONE)*');
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
async function handleJiraCommand(chatId, statuses, title) {
    try {
        let tasks = await jiraService.getMyTasks(statuses);
        await processAndSendTasks(chatId, tasks, statuses, title);
    } catch (error) {
        console.error('Error in Telegram Bot:', error);
        bot.sendMessage(chatId, '❌ Maaf, terjadi kesalahan saat mengambil data dari Jira.');
    }
}

/**
 * Handle searching for specific project issues
 */
async function handleIssueCommand(chatId) {
    try {
        const project = 'SBXS';
        const type = 'Issue';
        const title = `📋 Issue Type: ${type} (Project ${project})`;
        
        let tasks = await jiraService.getProjectIssuesByType(project, type);
        
        // Get unique statuses from the tasks to show in the header
        const uniqueStatuses = [...new Set(tasks.map(t => t.status))];
        // Sort unique statuses based on priority if possible
        uniqueStatuses.sort((a, b) => {
            const priorityA = STATUS_PRIORITY[a.toUpperCase()] || 99;
            const priorityB = STATUS_PRIORITY[b.toUpperCase()] || 99;
            return priorityA - priorityB;
        });

        await processAndSendTasks(chatId, tasks, uniqueStatuses, title);
    } catch (error) {
        console.error('Error in handleIssueCommand:', error);
        let errorDetail = 'Unknown error';
        if (error.response) {
            errorDetail = JSON.stringify(error.response.data);
        } else if (error.message) {
            errorDetail = error.message;
        } else {
            // Get all property names (including non-enumerable ones like 'message', 'stack')
            const propNames = Object.getOwnPropertyNames(error);
            errorDetail = JSON.stringify(error, propNames, 2);
        }
        const timestamp = new Date().toISOString();
        // Ensure errorDetail is a string
        const errorStr = String(errorDetail || 'Unknown error');
        const safeError = errorStr.substring(0, 3000);
        bot.sendMessage(chatId, `❌ [${timestamp}] Maaf, terjadi kesalahan:\n<pre>${escapeHtml(safeError)}</pre>`, { parse_mode: 'HTML' });
    }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Shared logic to process task list, count statuses, and send messages
 */
async function processAndSendTasks(chatId, tasks, statuses, title) {
    // Sort tasks by priority map
    tasks.sort((a, b) => {
        const statusA = (a.status || '').toUpperCase();
        const statusB = (b.status || '').toUpperCase();
        const priorityA = STATUS_PRIORITY[statusA] || 99;
        const priorityB = STATUS_PRIORITY[statusB] || 99;
        return priorityA - priorityB;
    });

    // Generate counts and category breakdown per status
    const statusData = {};
    statuses.forEach(s => {
        if (s) {
            statusData[s.toUpperCase()] = { count: 0, tr: 0, tc: 0 };
        }
    });

    tasks.forEach(task => {
        const statusKey = (task.status || 'UNKNOWN').toUpperCase();
        if (!statusData[statusKey]) {
            statusData[statusKey] = { count: 0, tr: 0, tc: 0 };
        }
        
        statusData[statusKey].count++;
        
        const summary = (task.summary || '').toUpperCase();
        if (summary.includes('QA TEST RUN')) {
            statusData[statusKey].tr++;
        } else if (summary.includes('QA TEST CASE')) {
            statusData[statusKey].tc++;
        }
    });

    const isHtml = title.includes('Issue Type') || title.includes('<b>');
    const messages = formatTelegramResponse(title, tasks, statusData, statuses, isHtml);
    
    for (const message of messages) {
        // Send to Telegram
        const options = isHtml ? { parse_mode: 'HTML' } : { parse_mode: 'Markdown' };
        await bot.sendMessage(chatId, message, options);
        
        // Mirror to Google Chat if configured
        if (process.env.GOOGLE_CHAT_WEBHOOK) {
            let cleanMessage = message;
            if (isHtml) {
                // Strip HTML tags for Google Chat plain text
                cleanMessage = message.replace(/<[^>]*>/g, '');
            } else {
                // Clean up markdown escapes
                cleanMessage = message.replace(/\\([_*`\[\]\(\)])/g, '$1');
            }
            await googleChatService.sendMessage(cleanMessage);
        }
    }
}

/**
 * Format tasks for Telegram Markdown, including counts and splitting if too long
 */
function formatTelegramResponse(title, tasks, statusData, targetStatuses, useHtml = false) {
    const MAX_LENGTH = 4000;
    const messages = [];

    // Header logic
    let header = useHtml ? `<b>${title}</b>\n` : `${title}\n`;
    header += useHtml ? `📊 <b>Total: ${tasks.length} Task</b>\n` : `📊 *Total: ${tasks.length} Task*\n`;
    
    if (tasks.length > 0 && tasks[0].startDate && tasks[0].endDate) {
        const dateStr = `${tasks[0].startDate} sd ${tasks[0].endDate}`;
        header += useHtml ? `📅 <b>Range: ${dateStr}</b>\n` : `📅 *Range: ${dateStr}*\n`;
    }
    header += '\n';
    
    targetStatuses.forEach(s => {
        if (!s) return;
        const data = statusData[s.toUpperCase()] || { count: 0, tr: 0, tc: 0 };
        header += useHtml ? `📍 <b>${s}</b>: ${data.count}` : `📍 *${s}*: ${data.count}`;
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
        let taskString = '';
        if (useHtml) {
            taskString = `🔹 <b>${task.key}</b> [${task.status}]\n`;
            taskString += `<i>${escapeHtml(task.summary)}</i>\n`;
            taskString += `🏃 Sprint: ${task.sprint}\n\n`;
        } else {
            taskString = `🔹 *${task.key}* [${task.status}]\n`;
            const safeSummary = (task.summary || '').replace(/[_*`]/g, '\\$&');
            taskString += `_${safeSummary}_\n`;
            taskString += `🏃 Sprint: ${task.sprint}\n\n`;
        }

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

/**
 * Triggered by Cron jobs to send automatic /cek
 */
async function handleScheduledCheck() {
    const targetChatId = process.env.TELEGRAM_CHAT_ID;
    if (!targetChatId) {
        console.error('Scheduled check failed: TELEGRAM_CHAT_ID not configured');
        return;
    }
    const statuses = COMMAND_CONFIG['/cek'];
    const title = '*⏰ Laporan Otomatis (10.00 & 17.00 WIB)*';
    await handleJiraCommand(targetChatId, statuses, title);
}

module.exports = {
    initTelegramBot,
    handleWebhook,
    handleScheduledCheck
};
