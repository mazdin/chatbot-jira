const axios = require('axios');

/**
 * Send a message to Google Chat via Webhook
 * @param {string} message 
 * @returns {Promise<void>}
 */
async function sendMessage(message) {
    const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK;
    if (!webhookUrl) {
        console.warn('Google Chat notification skipped: GOOGLE_CHAT_WEBHOOK not configured');
        return;
    }

    try {
        await axios.post(webhookUrl, {
            text: message
        });
        console.log('Message sent to Google Chat successfully');
    } catch (error) {
        console.error('Error sending message to Google Chat:', error.response ? JSON.stringify(error.response.data) : error.message);
    }
}

module.exports = {
    sendMessage
};
