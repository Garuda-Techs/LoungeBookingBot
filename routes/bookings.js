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

// Create a new booking
router.post('/', async (req, res) => {
  try {
    const { telegramUser, date, timeSlot, notes } = req.body;
    
    // Validate required fields
    if (!telegramUser) {
      return res.status(400).json({ error: 'Missing telegramUser' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Missing date' });
    }
    if (!timeSlot) {
      return res.status(400).json({ error: 'Missing timeSlot' });
    }
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    // Validate date is not in the past
    const bookingDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return res.status(400).json({ error: 'Cannot book dates in the past' });
    }
    
    // Validate time slot format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(timeSlot)) {
      return res.status(400).json({ error: 'Invalid time slot format. Use HH:MM' });
    }
    
    // Validate time slot is in our new 24-hour range
    if (!ALL_TIME_SLOTS.includes(timeSlot)) {
      return res.status(400).json({ error: 'Time slot not available' });
    }
    
    // Validate notes length
    if (notes && notes.length > 500) {
      return res.status(400).json({ error: 'Notes must be 500 characters or less' });
    }
    
    // Get or create user
    const user = await getOrCreateUser(telegramUser);
    
    const database = db.getDb();
    
    // Create booking - explicitly set status to 'active'
    database.run(
      'INSERT INTO bookings (user_id, date, time_slot, notes, status) VALUES (?, ?, ?, ?, ?)',
      [user.id, date, timeSlot, notes, 'active'],
      function(err) {
        if (err) {
          // Check if error is due to unique constraint violation
          if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Time slot already booked' });
          }
          return res.status(500).json({ error: 'Failed to create booking' });
        }
        
        res.status(201).json({
          id: this.lastID,
          user_id: user.id,
          date,
          time_slot: timeSlot,
          notes,
          status: 'active'
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's bookings
router.get('/user/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const database = db.getDb();
    
    database.all(
      `SELECT b.* FROM bookings b 
       JOIN users u ON b.user_id = u.id 
       WHERE u.telegram_id = ? AND b.status = ?
       ORDER BY b.date, b.time_slot`,
      [telegramId, 'active'],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(rows);
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel a booking
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { telegramId } = req.body;
    
    if (!telegramId) {
      return res.status(400).json({ error: 'Missing telegram ID' });
    }
    
    const database = db.getDb();
    
    // Verify ownership and cancel
    database.run(
      `UPDATE bookings SET status = 'cancelled' 
       WHERE id = ? AND user_id IN (SELECT id FROM users WHERE telegram_id = ?)`,
      [id, telegramId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Booking not found or unauthorized' });
        }
        
        res.json({ message: 'Booking cancelled successfully' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;