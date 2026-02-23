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
    
    // Validate ALL requested time slots format and availability
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    for (const slot of timeSlots) {
        if (!timeRegex.test(slot) || !ALL_TIME_SLOTS.includes(slot)) {
            return res.status(400).json({ error: `Invalid or unavailable time slot: ${slot}` });
        }
    }
    
    // Validate notes length
    if (notes && notes.length > 500) {
      return res.status(400).json({ error: 'Notes must be 500 characters or less' });
    }
    
    // Get or create user
    const user = await getOrCreateUser(telegramUser);
    
    const database = db.getDb();
    
    // Check if ANY of the requested slots were just booked by someone else
    const placeholders = timeSlots.map(() => '?').join(',');
    database.get(
        `SELECT COUNT(*) as count FROM bookings WHERE date = ? AND status = 'active' AND time_slot IN (${placeholders})`,
        [date, ...timeSlots],
        (err, conflictRow) => {
            if (err) {
                return res.status(500).json({ error: 'Database error checking conflicts' });
            }
            
            if (conflictRow && conflictRow.count > 0) {
                return res.status(409).json({ error: 'One or more selected slots were just booked by someone else!' });
            }

            // Bulk Insert all slots into the database
            const insertPlaceholders = timeSlots.map(() => '(?, ?, ?, ?, ?)').join(',');
            const insertValues = [];
            timeSlots.forEach(slot => {
                insertValues.push(user.id, date, slot, notes, 'active');
            });

            database.run(
                `INSERT INTO bookings (user_id, date, time_slot, notes, status) VALUES ${insertPlaceholders}`,
                insertValues,
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to create multi-hour booking' });
                    }
                    
                    res.status(201).json({ message: 'Bookings created successfully', status: 'active' });
                }
            );
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