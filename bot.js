const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set in environment variables');
  process.exit(1);
}

// Create a bot instance
const bot = new TelegramBot(token, { polling: true });

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'there';
  
  const welcomeMessage = `
Welcome to CAPT Garuda Lounge Booking Bot, ${firstName}! 🏢

This bot helps you book time slots at the CAPT Garuda Lounge.

Click the button below to open the booking app:
  `;
  
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📅 Book a Slot',
            web_app: { url: webAppUrl }
          }
        ],
        [
          {
            text: '📖 Help',
            callback_data: 'help'
          }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, welcomeMessage, options);
});

// Help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `
📖 *Help - CAPT Garuda Lounge Booking*

*How to book:*
1. Click "Book a Slot" button
2. Select a date from the calendar
3. Choose an available time slot
4. Add any notes (optional)
5. Confirm your booking

*Features:*
• View available time slots in real-time
• Manage your bookings
• Cancel bookings if needed
• Mobile-friendly interface

*Commands:*
/start - Start the bot
/book - Open booking app
/help - Show this help message

Need assistance? Contact the lounge administrator.
  `;
  
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Book command
bot.onText(/\/book/, (msg) => {
  const chatId = msg.chat.id;
  
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📅 Open Booking App',
            web_app: { url: webAppUrl }
          }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, 'Click the button below to open the booking app:', options);
});

// Handle callback queries
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  
  if (query.data === 'help') {
    const helpMessage = `
📖 *Help - CAPT Garuda Lounge Booking*

*How to book:*
1. Click "Book a Slot" button
2. Select a date from the calendar
3. Choose an available time slot
4. Add any notes (optional)
5. Confirm your booking

*Features:*
• View available time slots in real-time
• Manage your bookings
• Cancel bookings if needed
• Mobile-friendly interface

    `;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  }
  
  // Answer callback query to remove loading state
  bot.answerCallbackQuery(query.id);
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.response?.body);
});

console.log('Telegram bot is running...');
console.log('Web App URL:', webAppUrl);

module.exports = bot;
