const express = require('express');
const router = express.Router();
const db = require('../database');

// Generate 24 1-hour slots: ['00:00', '01:00', ..., '23:00']
const ALL_TIME_SLOTS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

// Get or create user
async function getOrCreateUser(telegramUser) {
  return new Promise((resolve, reject) => {
    const database = db.getDb();
    
    database.get(
      'SELECT * FROM users WHERE telegram_id = ?',
      [telegramUser.id],
      (err, row) => {
        if (err) return reject(err);
        if (row) return resolve(row);
        
        database.run(
          'INSERT INTO users (telegram_id, telegram_username, first_name, last_name) VALUES (?, ?, ?, ?)',
          [telegramUser.id, telegramUser.username, telegramUser.first_name, telegramUser.last_name],
          function(err) {
            if (err) return reject(err);
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

// Get available time slots with booking details for transparency
router.get('/available/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const level = parseInt(req.query.level) || 9;
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    const database = db.getDb();
    
    // UPDATED QUERY: JOIN with users to get the name and include notes
    const sql = `
      SELECT b.time_slot, b.notes, u.first_name, u.last_name, u.telegram_username 
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.date = ? AND b.lounge_level = ? AND b.status = 'active'
    `;

    database.all(sql, [date, level], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // rows now contains [{time_slot: '12:00', notes: 'Study', first_name: 'Gabriel'}, ...]
      const bookedSlots = rows.map(row => row.time_slot);
      const availableSlots = ALL_TIME_SLOTS.filter(slot => !bookedSlots.includes(slot));
      
      res.json({
        date,
        lounge_level: level,
        available: availableSlots,
        bookedDetails: rows // Send the full objects to the frontend
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new multi-slot booking for a specific level
router.post('/', async (req, res) => {
  try {
    const { telegramUser, date, timeSlots, notes, lounge_level } = req.body; 
    
    const level = parseInt(lounge_level);
    if (![9, 10, 11].includes(level)) {
      return res.status(400).json({ error: 'Invalid lounge level. Choose 9, 10, or 11.' });
    }

    if (!telegramUser || !date || !timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Invalid date format.' });
    }
    
    const bookingDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return res.status(400).json({ error: 'Cannot book dates in the past' });
    }
    
    const user = await getOrCreateUser(telegramUser);
    const database = db.getDb();
    
    // Conflict check including the floor level
    const placeholders = timeSlots.map(() => '?').join(',');
    database.get(
        `SELECT COUNT(*) as count FROM bookings WHERE date = ? AND lounge_level = ? AND status = 'active' AND time_slot IN (${placeholders})`,
        [date, level, ...timeSlots],
        (err, conflictRow) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            
            if (conflictRow && conflictRow.count > 0) {
                return res.status(409).json({ error: 'One or more slots on this floor are already booked!' });
            }

            // Insert bookings with the lounge_level column
            const insertPlaceholders = timeSlots.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
            const insertValues = [];
            timeSlots.forEach(slot => {
                insertValues.push(user.id, level, date, slot, notes, 'active');
            });

            database.run(
                `INSERT INTO bookings (user_id, lounge_level, date, time_slot, notes, status) VALUES ${insertPlaceholders}`,
                insertValues,
                function(err) {
                    if (err) return res.status(500).json({ error: 'Failed to create booking' });
                    res.status(201).json({ message: 'Bookings created successfully', level: level });
                }
            );
        }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's bookings (displays all levels)
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
        if (err) return res.status(500).json({ error: 'Database error' });
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
    // Ensure telegramId is being pulled from the body
    const { telegramId } = req.body;

    if (!telegramId) {
      return res.status(400).json({ error: 'User authorization (telegramId) is required to cancel.' });
    }

    const database = db.getDb();
    
    // Using a subquery to verify the user owns the booking before 'deleting' (updating status)
    database.run(
      `UPDATE bookings SET status = 'cancelled' 
       WHERE id = ? AND user_id IN (SELECT id FROM users WHERE telegram_id = ?)`,
      [id, telegramId],
      function(err) {
        if (err) {
          console.error('Database error during cancellation:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        // If this.changes is 0, it means the ID didn't exist OR the user didn't own it
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Booking not found or unauthorized.' });
        }
        
        res.json({ message: 'Booking cancelled successfully' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;