# 🏢 CAPT Garuda Lounge Booking Bot

A Telegram Mini App for booking time slots at the CAPT Garuda Lounge (Levels 9, 10, and 11). This bot provides a mobile-first interface for residents to select lounge levels, dates, and multi-hour time slots with automatic profile integration from Telegram.

## ✨ Features

- 📱 **Telegram Mini App Integration** - Seamless integration with Telegram Mini Apps and `initDataUnsafe` profile autofill.
- 🏢 **Multi-Level Support** - Independent booking tracks for Level 9, 10, and 11 lounges.
- 📅 **Interactive Calendar** - Highlights selection, disables past dates, and prevents invalid ranges.
- ⏰ **Multi-Slot Selection** - Book multiple consecutive hourly slots in a single transaction.
- 👤 **User Profile Autofill** - Automatic profile data retrieval from the Telegram web app payload.
- 💾 **Persistence** - SQLite database with recommended Railway Volume mounting for data durability.
- 🔒 **Proxy-Aware & Secure** - Server configured for `trust proxy`, rate limiting, and authorization checks.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- HTTPS-enabled web hosting for Telegram Mini Apps

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

3. Create `.env` from the example and configure the variables:
```env
TELEGRAM_BOT_TOKEN=your_bot_token
WEB_APP_URL=https://your-app-url
NODE_ENV=production
TRUST_PROXY=true
PORT=3000
DB_PATH=./data/lounge_bookings.db
```

Notes:
- Set `TRUST_PROXY=true` in production when the app runs behind a reverse proxy (Railway, Heroku, Nginx, etc.).
- For persistence on Railway, mount a Volume to `/app/data` and set `DB_PATH=/app/data/lounge_bookings.db`.

## 🏗️ Project Structure

- `public/js/app.js` — Frontend logic (level switching, multi-slot selection, calendar tweaks).
- `server.js` — Express server configured with `trust proxy`, rate limiting, and JSON parsing.
- `routes/bookings.js` — Secure API endpoints for availability, booking, and cancellations.
- `database.js` — SQLite schema initialization and connection pooling.
- `bot.js` — Telegram bot logic that opens the mini app and handles commands.

## 🔌 API Endpoints (Updated)

### Get Available Slots
```
GET /api/bookings/available/:date?level=9
```
Returns available and booked slots for the specified lounge level and date.

Response sample:
```json
{
  "date":"2026-02-24",
  "level":9,
  "available":["08:00","09:00","10:00"],
  "booked":[{"time":"11:00","telegramId":12345}]
}
```

### Create Booking
```
POST /api/bookings
Body: {
  "telegramUser": { "id": 12345, "first_name": "Gabriel" },
  "lounge_level": 9,
  "date": "2026-02-24",
  "timeSlots": ["08:00","09:00"],
  "notes": "Study group"
}
```
- `timeSlots` accepts an array of consecutive hourly slots. The server validates overlaps and conflicts per level.

### Get User Bookings
```
GET /api/bookings/user/:telegramId
```
Returns active bookings for the Telegram user.

### Cancel Booking
```
DELETE /api/bookings/:id
Body: { "telegramId": 12345 }
```
- Cancellation requires the Telegram ID to match the booking owner; server verifies authorization.

## 🔒 Security

- `trust proxy` support for correct client IP handling behind proxies.
- Rate limiting middleware to mitigate abuse while allowing trusted proxies.
- Parameterized SQL queries to prevent injection.
- Authorization checks for cancellation and booking management.

## 🌐 Deployment (Railway recommended)

1. Create and mount a Volume at `/app/data` to persist `lounge_bookings.db` across restarts.
2. Set required environment variables: `TELEGRAM_BOT_TOKEN`, `WEB_APP_URL`, `TRUST_PROXY=true`, `PORT`, `NODE_ENV=production`, `DB_PATH=/app/data/lounge_bookings.db`.
3. Deploy and ensure HTTPS is enabled for the web app URL (Telegram requirement).

## ✅ What Changed (summary)

- **Multi-Level & Multi-Slot**: Backend and frontend support selecting lounge level (9/10/11) and booking multiple consecutive slots.
- **Proxy Configuration**: Add `TRUST_PROXY` environment variable and Express `app.set('trust proxy', true)` recommendation to fix cancel-button responsiveness behind proxies.
- **Railway Volume Tips**: Guidance to mount a volume for SQLite persistence.
- **API Update**: `POST /api/bookings` now accepts `lounge_level` and `timeSlots` array.

## 🧪 Testing & Local Run

Start server locally (development):
```bash
npm start
```
Use `npm run bot` in a separate terminal to run the Telegram bot locally (if configured).

## 🤝 Contributing

Contributions are welcome — open a PR or an issue.

---

Built with ❤️ for CAPT Garuda
