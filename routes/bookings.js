const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../database');
const { requireTelegramAuth } = require('../telegramAuth');

// Generate 24 1-hour slots: ['00:00', '01:00', ..., '23:00']
const ALL_TIME_SLOTS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
const VALID_SLOTS = new Set(ALL_TIME_SLOTS);

// Get or create user
async function getOrCreateUser(telegramUser) {
  return new Promise((resolve, reject) => {
    const database = db.getDb();
    
    // --- THE FIX: Clean the ID --- PREVENT INT OVERFLOW BY CONVERTING TO STRING AND SPLITTING
    const cleanId = String(telegramUser.id).split('.')[0];
    
    database.get(
      'SELECT * FROM users WHERE telegram_id = ?',
      [cleanId], // Use cleaned ID
      (err, row) => {
        if (err) return reject(err);
        if (row) return resolve(row);
        
        database.run(
          'INSERT INTO users (telegram_id, telegram_username, first_name, last_name) VALUES (?, ?, ?, ?)',
          [cleanId, telegramUser.username, telegramUser.first_name, telegramUser.last_name], // Use cleaned ID
          function(err) {
            if (err) return reject(err);
            resolve({
              id: this.lastID,
              telegram_id: cleanId,
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
      SELECT b.id, b.time_slot, b.notes, b.booking_group, u.first_name, u.last_name, u.telegram_username
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
router.post('/', requireTelegramAuth, async (req, res) => {
  try {
    const { date, timeSlots, notes, lounge_level } = req.body;
    const telegramUser = req.telegramUser; // verified identity, never trusted from body

    const level = parseInt(lounge_level);
    if (![9, 10, 11].includes(level)) {
      return res.status(400).json({ error: 'Invalid lounge level. Choose 9, 10, or 11.' });
    }

    if (!date || !timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Reject unknown slot strings and collapse duplicates so a single request
    // can't smuggle in junk like "25:00" or violate the unique index.
    const uniqueSlots = [...new Set(timeSlots)];
    if (uniqueSlots.some(slot => !VALID_SLOTS.has(slot))) {
      return res.status(400).json({ error: 'Invalid time slot(s).' });
    }
    timeSlots.length = 0;
    timeSlots.push(...uniqueSlots);

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

            // Split the slots into consecutive runs; every hour in a run shares
            // one booking_group id so the run is treated as a single booking.
            const sortedSlots = [...timeSlots].sort();
            const slotGroup = {};
            let currentGroupId = null;
            let prevHour = null;
            sortedSlots.forEach(slot => {
                const hour = parseInt(slot.split(':')[0]);
                if (prevHour === null || hour !== prevHour + 1) {
                    currentGroupId = crypto.randomUUID(); // start of a new consecutive run
                }
                slotGroup[slot] = currentGroupId;
                prevHour = hour;
            });

            // Insert bookings with the lounge_level and booking_group columns
            const insertPlaceholders = timeSlots.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
            const insertValues = [];
            timeSlots.forEach(slot => {
                insertValues.push(user.id, level, date, slot, notes, 'active', slotGroup[slot]);
            });

            database.run(
                `INSERT INTO bookings (user_id, lounge_level, date, time_slot, notes, status, booking_group) VALUES ${insertPlaceholders}`,
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

// Get upcoming bookings for a specific level (Current Week + Next Week up to Sunday)
// Get upcoming bookings for a specific level (Current Week + Next Week up to Sunday)
router.get('/upcoming/:level', (req, res) => {
  try {
    const level = parseInt(req.params.level);
    if (![9, 10, 11].includes(level)) {
      return res.status(400).json({ error: 'Invalid lounge level.' });
    }

    const today = new Date();

    // --- 1. THE FIX: Create a bulletproof "Today" string in Node.js ---
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

    // --- 2. CALCULATE THE CUTOFF DATE (Sunday of Next Week) ---
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); 
    const daysUntilThisSunday = 7 - dayOfWeek;
    
    const endOfNextWeek = new Date(today);
    endOfNextWeek.setDate(today.getDate() + daysUntilThisSunday + 7);
    
    const year = endOfNextWeek.getFullYear();
    const month = String(endOfNextWeek.getMonth() + 1).padStart(2, '0');
    const day = String(endOfNextWeek.getDate()).padStart(2, '0');
    const cutoffDate = `${year}-${month}-${day}`;

    const database = db.getDb(); 
    
    // --- 3. Pass BOTH Node.js dates to completely bypass SQLite's clock ---
    const sql = `
      SELECT b.date, b.time_slot, u.first_name, u.telegram_username 
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.lounge_level = ? 
        AND b.date >= ?  /* Replaced date('now', 'localtime') with our todayStr */
        AND b.date <= ? 
        AND b.status = 'active'
      ORDER BY b.date ASC, b.time_slot ASC
    `;

    // Now passing [level, todayStr, cutoffDate]
    database.all(sql, [level, todayStr, cutoffDate], (err, rows) => {
      if (err) {
        console.error("Database error fetching upcoming:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's bookings (displays all levels)
router.get('/user/:telegramId', requireTelegramAuth, async (req, res) => {
  try {
    // Identity comes from the verified Telegram payload, not the URL param,
    // so a user can only ever read their own bookings.
    const cleanId = String(req.telegramUser.id).split('.')[0];
    const database = db.getDb();
    
    database.all(
      `SELECT b.* FROM bookings b 
       JOIN users u ON b.user_id = u.id 
       WHERE u.telegram_id = ? AND b.status = ?
       ORDER BY b.date, b.time_slot`,
      [cleanId, 'active'], // Use cleaned ID
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if a user is an admin
router.get('/is-admin/:telegramId', requireTelegramAuth, (req, res) => {
    try {
        const cleanId = String(req.telegramUser.id).split('.')[0];
        const adminEnv = process.env.ADMIN_IDS || '';
        const ADMIN_IDS = adminEnv.split(',').filter(id => id.trim()).map(id => id.trim());
        
        res.json({ isAdmin: ADMIN_IDS.includes(cleanId) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel an entire booking group (all consecutive hours booked together)
router.delete('/group/:groupId', requireTelegramAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const database = db.getDb();
    const cleanId = String(req.telegramUser.id).split('.')[0];

    const adminEnv = process.env.ADMIN_IDS || '';
    const ADMIN_IDS = adminEnv.split(',').filter(id => id.trim()).map(id => id.trim());
    const isAdmin = ADMIN_IDS.includes(cleanId);

    let sql;
    let params;

    if (isAdmin) {
        // God Mode: admin can cancel any group by its id
        sql = `UPDATE bookings SET status = 'cancelled' WHERE booking_group = ? AND status = 'active'`;
        params = [groupId];
    } else {
        // Normal Mode: users can only cancel groups they own
        sql = `UPDATE bookings SET status = 'cancelled'
               WHERE booking_group = ? AND status = 'active'
                 AND user_id IN (SELECT id FROM users WHERE telegram_id = ?)`;
        params = [groupId, cleanId];
    }

    database.run(sql, params, function(err) {
      if (err) {
        console.error('Database error during group cancellation:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Booking not found or unauthorized.' });
      }
      res.json({ message: 'Booking cancelled successfully', cancelled: this.changes });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel a single booking by id (With Admin Override)
router.delete('/:id', requireTelegramAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const database = db.getDb();
    // Verified identity — the caller cannot claim to be someone else.
    const cleanId = String(req.telegramUser.id).split('.')[0];
    
    const adminEnv = process.env.ADMIN_IDS || '';
    const ADMIN_IDS = adminEnv.split(',').filter(id => id.trim()).map(id => id.trim());
    
    const isAdmin = ADMIN_IDS.includes(cleanId);

    let sql;
    let params;

    if (isAdmin) {
        // God Mode: Admin can cancel ANY booking just by its ID
        sql = `UPDATE bookings SET status = 'cancelled' WHERE id = ?`;
        params = [id];
    } else {
        // Normal Mode: Users can only cancel if they own it
        sql = `UPDATE bookings SET status = 'cancelled' 
               WHERE id = ? AND user_id IN (SELECT id FROM users WHERE telegram_id = ?)`;
        params = [id, cleanId];
    }

    database.run(sql, params, function(err) {
      if (err) {
        console.error('Database error during cancellation:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Booking not found or unauthorized.' });
      }
      
      res.json({ message: 'Booking cancelled successfully' });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;