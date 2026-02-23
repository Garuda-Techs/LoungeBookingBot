const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./database');
const bookingRoutes = require('./routes/bookings');

// Initialize Telegram Bot
try {
  require('./bot');
  console.log('Telegram bot initialized');
} catch (error) {
  console.error('Failed to initialize Telegram bot:', error);
}

const app = express();
const PORT = process.env.PORT || 8080; // Railway uses 8080 usually

// --- THE FIX FOR RESPONSIVENESS ---
// Tell Express to trust Railway's proxy headers
app.set('trust proxy', 1); 

// --- UPDATED RATE LIMITER ---
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 300,               // High limit for rapid testing
  message: 'Too many requests, please try again in a minute.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.WEB_APP_URL] 
    : '*',
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Apply rate limiting once to all API routes
app.use('/api/', apiLimiter);

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/bookings', bookingRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database (with WAL mode) and start server
db.initialize()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app;