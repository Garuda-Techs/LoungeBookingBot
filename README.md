# 🦅 CAPT Garuda Lounge Booking Bot

A Telegram Mini App for booking time slots at the CAPT Garuda Lounge (Levels 9, 10, and 11). This bot provides a mobile-first interface for residents to select lounge levels, dates, and multi-hour time slots with automatic profile integration from Telegram.

## ✨ Features

- 📱 **Telegram Mini App Integration** — Seamless integration with Telegram Mini Apps and `initDataUnsafe` profile autofill.
- 🏢 **Multi-Level Support** — Independent booking tracks for Level 9, 10, and 11 lounges.
- 📅 **Interactive Calendar** — Highlights selection, disables past dates, and prevents invalid ranges.
- ⏰ **Multi-Slot Selection** — Book multiple consecutive hourly slots in a single transaction.
- 👤 **User Profile Autofill** — Automatic profile data retrieval from the Telegram web app payload.
- 🛡️ **Int64 Data Sanitization** — Safely handles large Telegram IDs by forcing string conversion, preventing 32-bit integer overflows and floating-point precision loss in SQLite.
- 💾 **Persistent Storage** — SQLite database optimized for cloud deployment with Railway Volume mounting for data durability.
- 🔒 **Proxy-Aware & Secure** — Server configured for `trust proxy`, rate limiting, and authorization checks.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- `npm` or `yarn`
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

3. Configure the environment

Create a `.env` file from the example and configure your variables:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
WEB_APP_URL=https://your-app-url
NODE_ENV=production
TRUST_PROXY=true
PORT=3000
DB_PATH=/app/data/lounge_bookings.db
```

#### Deployment Notes

- Set `TRUST_PROXY=true` in production when the app runs behind a reverse proxy (Railway, Heroku, Nginx, etc.).
- For persistence on Railway, mount a Volume to `/app/data` and set `DB_PATH=/app/data/lounge_bookings.db`.

## 🏗️ Project Structure

- `public/js/app.js` — Frontend logic (level switching, multi-slot selection, calendar tweaks).
- `server.js` — Express server configured with `trust proxy`, rate limiting, and JSON parsing.
- `routes/bookings.js` — Secure API endpoints featuring data sanitization for availability, booking, and cancellations.
- `database.js` — SQLite schema initialization and connection pooling.
- `bot.js` — Telegram bot logic that opens the mini app and handles commands.

## 🔌 API Endpoints

### Get Available Slots

`GET /api/bookings/available/:date?level=9`

Returns available and booked slots for the specified lounge level and date.

Response sample:

```json
{
  "date": "2026-02-24",
  "level": 9,
  "available": ["08:00", "09:00", "10:00"],
  "bookedDetails": [
    {
      "time_slot": "11:00",
      "first_name": "Gabriel",
      "telegram_username": "gabrielwan",
      "notes": "Study session"
    }
  ]
}
```

### Create Booking

`POST /api/bookings`

Accepts an array of consecutive hourly slots. The server validates overlaps and conflicts per lounge level.

Request body example:

```json
{
  "telegramUser": { "id": "6032579306", "first_name": "Justine" },
  "lounge_level": 9,
  "date": "2026-02-24",
  "timeSlots": ["08:00", "09:00"],
  "notes": "Project meeting"
}
```

### Get User Bookings

`GET /api/bookings/user/:telegramId`

Returns active bookings for the requested Telegram user. Uses strict string matching to support large user IDs.

### Cancel Booking

`DELETE /api/bookings/:id`

Cancellation requires the Telegram ID to match the booking owner; the server verifies authorization via database JOINs.

Request body example:

```json
{
  "telegramId": "6032579306"
}
```

---

## 🔒 Security & Data Integrity

- **Data Type Safety:** Telegram IDs are explicitly cast to strings and sanitized to prevent `.0` float artifacts in the database.
- **Trust Proxy:** Support for correct client IP handling behind cloud proxies.
- **Rate Limiting:** Middleware to mitigate API abuse while allowing trusted proxies.
- **Parameterized Queries:** SQL queries use `?` placeholders to prevent SQL injection.
- **Ownership Verification:** Strict authorization subqueries for cancellation and booking management.

---

## 🌐 Deployment (Railway Recommended)

1. Create and mount a **Volume** at `/app/data` to persist `lounge_bookings.db` across container restarts.
2. Set the required environment variables in your Railway project settings.
3. Deploy the project and ensure HTTPS is enabled for the generated web app URL (a strict Telegram requirement).

---

## ✅ Recent Updates

- **Multi-Level & Multi-Slot:** Backend and frontend support selecting lounge level (9/10/11) and booking multiple consecutive slots.
- **Int64 Sanitization:** Fixed a critical bug where massive Telegram IDs exceeded the 32-bit integer limit, ensuring flawless profile matching.
- **Proxy Configuration:** Added Express `app.set('trust proxy', 1)` to fix rate-limiter IP blocking behind cloud proxies.
- **Admin UI**: Added a dynamic "Admin: Cancel" button to the calendar modal that only renders for authorized users.
- **Dynamic Admin Management**: Admins can now be added or removed instantly via Railway environment variables without redeploying code.

---

## 🧪 Testing Locally

Start the server locally in development mode:

```bash
npm start
```

Use `npm run bot` in a separate terminal to run the Telegram bot locally (if configured).

---

## 🤝 Contributing

Contributions are welcome — open a PR or an issue.

---

Built with ❤️ for CAPT Garuda.
