# 🏢 CAPT Garuda Lounge Booking Bot

A Telegram Mini App for booking time slots at the CAPT Garuda Lounge. This bot provides a mobile-friendly interface for users to select dates and time slots in a calendar fashion, with automatic profile autofill from Telegram.

## ✨ Features

- 📱 **Telegram Mini App Integration** - Seamlessly integrated with Telegram
- 📅 **Interactive Calendar** - Easy-to-use calendar interface for date selection
- ⏰ **Time Slot Management** - View available time slots in real-time
- 👤 **User Profile Autofill** - Automatic profile information from Telegram
- 💾 **Booking Management** - View and cancel your bookings
- 📱 **Mobile-Friendly** - Responsive design optimized for mobile devices
- ⚡ **Real-time Updates** - See slot availability instantly

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A Telegram Bot Token (get it from [@BotFather](https://t.me/BotFather))
- A web server with HTTPS (required for Telegram Mini Apps)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Garuda-Techs/LoungeBookingBot.git
cd LoungeBookingBot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_BOT_USERNAME=your_bot_username
PORT=3000
WEB_APP_URL=https://your-domain.com
DB_PATH=./lounge_bookings.db
```

### Setting Up the Telegram Bot

1. Create a bot with [@BotFather](https://t.me/BotFather):
   - Send `/newbot` and follow the instructions
   - Save the bot token

2. Set up the Web App:
   - Send `/newapp` to @BotFather
   - Select your bot
   - Provide a title, description, and photo
   - Enter your web app URL (must be HTTPS)

3. Configure the bot commands with @BotFather:
   ```
   start - Start the bot
   book - Open booking app
   help - Show help message
   ```

### Running the Application

1. Start the web server:
```bash
npm start
```

2. (Optional) Run the bot in a separate terminal:
```bash
npm run bot
```

The server will start on the port specified in your `.env` file (default: 3000).

## 📖 Usage

### For Users

1. Open your Telegram app and search for your bot
2. Send `/start` to the bot
3. Click "📅 Book a Slot" to open the mini app
4. Select a date from the calendar
5. Choose an available time slot
6. Add any notes (optional)
7. Confirm your booking
8. View and manage your bookings in the "My Bookings" section

### Bot Commands

- `/start` - Start the bot and see welcome message
- `/book` - Open the booking mini app
- `/help` - Display help information

## 🏗️ Project Structure

```
LoungeBookingBot/
├── public/              # Frontend files
│   ├── css/
│   │   └── styles.css   # Styles for the mini app
│   ├── js/
│   │   └── app.js       # Frontend JavaScript
│   └── index.html       # Main HTML file
├── routes/
│   └── bookings.js      # Booking API routes
├── bot.js               # Telegram bot logic
├── database.js          # Database initialization and helpers
├── server.js            # Express server
├── package.json         # Dependencies and scripts
├── .env.example         # Environment variables template
└── README.md            # This file
```

## 🔌 API Endpoints

### Get Available Time Slots
```
GET /api/bookings/available/:date
```
Returns available and booked time slots for a specific date.

### Create Booking
```
POST /api/bookings
Body: {
  telegramUser: { id, username, first_name, last_name },
  date: "YYYY-MM-DD",
  timeSlot: "HH:MM",
  notes: "optional notes"
}
```

### Get User Bookings
```
GET /api/bookings/user/:telegramId
```
Returns all active bookings for a user.

### Cancel Booking
```
DELETE /api/bookings/:id
Body: { telegramId: "user_telegram_id" }
```

## 💾 Database

The application uses SQLite for data storage with the following tables:

- **users** - Stores user information from Telegram
- **bookings** - Stores booking records with date, time, and status

## 🔒 Security

- User authentication through Telegram
- Input validation on all API endpoints
- SQL injection prevention with parameterized queries
- CORS enabled for web app requests

## 🌐 Deployment

### Deployment Options

1. **Heroku**
   - Add Heroku Postgres add-on (or use SQLite)
   - Set environment variables
   - Deploy with Git

2. **Railway**
   - Connect your GitHub repository
   - Set environment variables
   - Deploy automatically

3. **VPS (DigitalOcean, AWS, etc.)**
   - Install Node.js
   - Use PM2 for process management
   - Set up Nginx as reverse proxy
   - Configure SSL with Let's Encrypt

### Important Notes

- Telegram Mini Apps require HTTPS
- Set the correct `WEB_APP_URL` in your environment
- Keep your bot token secure

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

ISC License

## 📧 Support

For issues or questions, please open an issue on GitHub or contact the lounge administrator.

---

Built with ❤️ for CAPT Garuda