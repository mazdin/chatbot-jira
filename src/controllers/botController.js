const jiraService = require('../services/jiraService');

/**
 * Handle incoming messages from Google Chat
 */
async function handleMessage(req, res) {
    const event = req.body;
    console.log('Received event:', JSON.stringify(event, null, 2));

    if (event.type === 'ADDED_TO_SPACE') {
        return res.json({
            text: 'Terima kasih telah menambahkan saya ke ruang ini! Gunakan `cek task`, `task testing`, atau `task done` untuk mengecek status task Anda.'
        });
    }

    if (event.type === 'MESSAGE') {
        const text = event.message.text ? event.message.text.trim().toLowerCase() : '';
        
        try {
            let tasks = [];
            let title = '';

            if (text.includes('cek task')) {
                tasks = await jiraService.getMyTasks();
                title = '📋 *Daftar Task (Sprint Aktif)*';
            } else if (text.includes('task testing')) {
                tasks = await jiraService.getMyTasks('TESTING');
                title = '🧪 *Task dalam Status TESTING*';
            } else if (text.includes('task done')) {
                tasks = await jiraService.getMyTasks('DONE');
                title = '✅ *Task Selesai (DONE)*';
            } else {
                // If not a recognized command, but the bot was mentioned or DM'd
                return res.json({
                    text: 'Maaf, saya tidak mengerti perintah tersebut. Gunakan: \n- `cek task` \n- `task testing` \n- `task done`'
                });
            }

            const responseText = formatResponse(title, tasks);
            return res.json({ text: responseText });

        } catch (error) {
            console.error('Error handling message:', error);
            return res.json({
                text: 'Maaf, terjadi kesalahan saat mengambil data dari Jira. Pastikan konfigurasi API sudah benar.'
            });
        }
    }

    return res.status(200).send();
}

/**
 * Format tasks into a readable string for Google Chat
 */
function formatResponse(title, tasks) {
    if (tasks.length === 0) {
        return `${title}\n\nTidak ada task ditemukan.`;
    }

    let message = `${title}\n\n`;
    tasks.forEach(task => {
        message += `🔹 *${task.key}* - ${task.status}\n`;
        message += `   _${task.summary}_\n`;
        message += `   🏃 Sprint: ${task.sprint}\n\n`;
    });

    return message;
}

module.exports = {
    handleMessage
};
