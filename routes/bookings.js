const express = require('express');
const router = express.Router();
const db = require('../database');

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
    const database = db.getDb();
    
    // Define all possible time slots (9 AM to 9 PM, hourly)
    const allTimeSlots = [
      '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
      '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
    ];
    
    // Get booked slots for the date
    database.all(
      'SELECT time_slot FROM bookings WHERE date = ? AND status = ?',
      [date, 'active'],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        const bookedSlots = rows.map(row => row.time_slot);
        const availableSlots = allTimeSlots.filter(slot => !bookedSlots.includes(slot));
        
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
    
    if (!telegramUser || !date || !timeSlot) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get or create user
    const user = await getOrCreateUser(telegramUser);
    
    const database = db.getDb();
    
    // Check if slot is available
    database.get(
      'SELECT * FROM bookings WHERE date = ? AND time_slot = ? AND status = ?',
      [date, timeSlot, 'active'],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (row) {
          return res.status(409).json({ error: 'Time slot already booked' });
        }
        
        // Create booking
        database.run(
          'INSERT INTO bookings (user_id, date, time_slot, notes) VALUES (?, ?, ?, ?)',
          [user.id, date, timeSlot, notes],
          function(err) {
            if (err) {
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
