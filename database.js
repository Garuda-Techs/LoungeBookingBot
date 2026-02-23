const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Check if we are running in the cloud (Railway usually sets a PORT variable)
const isRailway = process.env.PORT || process.env.RAILWAY_ENVIRONMENT;

// Use environment variable if set. If on Railway, use the protected Volume. Otherwise, use local file.
const DB_PATH = process.env.DB_PATH || (isRailway ? '/app/data/lounge_bookings.db' : path.join(__dirname, 'lounge_bookings.db'));

// Ensure the directory for the database exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created database directory: ${dbDir}`);
  } catch (err) {
    console.error(`Error creating database directory ${dbDir}:`, err);
  }
}

let db = null;

function initialize() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        return reject(err);
      }
      
      console.log(`Connected to SQLite database at ${DB_PATH}`);

      // --- THE SPEED FIXES ---
      // 1. Enable Write-Ahead Logging for concurrent read/writes
      db.run("PRAGMA journal_mode = WAL;"); 
      // 2. Prevent "Database is locked" errors by waiting up to 5s
      db.run("PRAGMA busy_timeout = 5000;");
      
      // Create tables
      db.serialize(() => {
        // Users table
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id TEXT UNIQUE NOT NULL,
            telegram_username TEXT,
            first_name TEXT,
            last_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Bookings table - UPDATED with lounge_level
        db.run(`
          CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            lounge_level INTEGER NOT NULL,
            date TEXT NOT NULL,
            time_slot TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `);
        
        // Create unique index for active bookings only - UPDATED to include lounge_level
        // This allows Level 9, 10, and 11 to have separate bookings at the same time.
        db.run(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_active_bookings 
          ON bookings(lounge_level, date, time_slot) 
          WHERE status = 'active'
        `, (err) => {
          if (err) {
            return reject(err);
          }
          console.log('Database tables initialized with floor levels');
          resolve();
        });
      });
    });
  });
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initialize() first.');
  }
  return db;
}

function close() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          return reject(err);
        }
        console.log('Database connection closed');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initialize,
  getDb,
  close
};