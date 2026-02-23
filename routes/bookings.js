const express = require('express');
const router = express.Router();
const db = require('../database');

// Generate 24 1-hour slots: ['00:00', '01:00', ..., '23:00']
const ALL_TIME_SLOTS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

// Get or create user
async function getOrCreateUser(telegramUser) {
  return new Promise((resolve, reject) => {
    const database = db.getDb();
    
    // Check if user exists
    database.get(
      'SELECT * FROM users WHERE telegram_id = ?',
      [telegramUser.id],
      (err, row) => {
        if (err) {
          return reject(err);
        }
        
        if (row) {
          return resolve(row);
        }
        
        // Create new user
        database.run(
          'INSERT INTO users (telegram_id, telegram_username, first_name, last_name) VALUES (?, ?, ?, ?)',
          [telegramUser.id, telegramUser.username, telegramUser.first_name, telegramUser.last_name],
          function(err) {
            if (err) {
              return reject(err);
            }
            
            resolve({
              id: this.lastID,
              telegram_id: telegramUser.id,
              telegram_username: telegramUser.username,
              first_name: telegramUser.first_name,
              last_name: telegramUser.last_name
            });
          }
        );
      }
    );
  });
}

// Get available time slots for a date
router.get('/available/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    const database = db.getDb();
    
    // Get booked slots for the date
    database.all(
      'SELECT time_slot FROM bookings WHERE date = ? AND status = ?',
      [date, 'active'],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        const bookedSlots = rows.map(row => row.time_slot);
        // Compare against our new 24-hour list
        const availableSlots = ALL_TIME_SLOTS.filter(slot => !bookedSlots.includes(slot));
        
        res.json({
          date,
          available: availableSlots,
          booked: bookedSlots
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new multi-slot booking
router.post('/', async (req, res) => {
  try {
    const { telegramUser, date, timeSlots, notes } = req.body; 
    
    // Validate required fields
    if (!telegramUser) {
      return res.status(400).json({ error: 'Missing telegramUser' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Missing date' });
    }
    // Check that timeSlots exists, is an array, and has at least one item
    if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid time slots' });
    }
    
    // Validate date format (YYYY-MM-DD)