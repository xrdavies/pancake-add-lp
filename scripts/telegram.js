const axios = require('axios');

class TelegramMessenger {
  constructor(botToken) {
    this.botToken = botToken;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async sendMessage(chatId, message) {
    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
}

module.exports = TelegramMessenger;
