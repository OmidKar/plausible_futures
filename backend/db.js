// TODO: Replace sql.js with PostgreSQL for production
// Current: sql.js (in-memory, single-threaded) - MAX 5-10 concurrent users
// Production: PostgreSQL with connection pooling - supports 100+ users
// 
// Migration steps:
// 1. npm install pg
// 2. Replace this file with pg.Pool
// 3. Update queries (minimal changes needed)
// 4. Enable connection pooling (max 20-50 connections)
// 
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize sql.js
const SQL = await initSqlJs();

// Database file path
const dbPath = join(__dirname, 'ideation.db');

// Load existing database or create new one
let db;
if (process.env.NODE_ENV === 'test' || !existsSync(dbPath)) {
  db = new SQL.Database();
} else {
  const buffer = readFileSync(dbPath);
  db = new SQL.Database(buffer);
}

// Wrapper to match better-sqlite3 API
const dbWrapper = {
  prepare: (sql) => {
    return {
      run: (...params) => {
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params.length > 0 ? params : undefined);
          stmt.step();
          stmt.free();
          saveDatabase();
          return { changes: db.getRowsModified() };
        } catch (error) {
          console.error('Error in run:', error, 'SQL:', sql, 'Params:', params);
          throw error;
        }
      },
      get: (...params) => {
        try {
          const stmt = db.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          if (stmt.step()) {
            const result = stmt.getAsObject();
            stmt.free();
            return result;
          }
          stmt.free();
          return undefined;
        } catch (error) {
          console.error('Error in get:', error, 'SQL:', sql, 'Params:', params);
          throw error;
        }
      },
      all: (...params) => {
        try {
          const stmt = db.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        } catch (error) {
          console.error('Error in all:', error, 'SQL:', sql, 'Params:', params);
          throw error;
        }
      }
    };
  },
  exec: (sql) => {
    try {
      db.exec(sql);
      saveDatabase();
    } catch (error) {
      console.error('Error in exec:', error, 'SQL:', sql);
      throw error;
    }
  },
  close: () => {
    db.close();
  },
  transaction: (fn) => {
    return (...args) => {
      try {
        db.exec('BEGIN TRANSACTION');
        const result = fn(...args);
        db.exec('COMMIT');
        saveDatabase();
        return result;
      } catch (error) {
        try {
          db.exec('ROLLBACK');
        } catch (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError);
        }
        throw error;
      }
    };
  }
};

// Save database to file (skip for test environment)
function saveDatabase() {
  if (process.env.NODE_ENV !== 'test') {
    const data = db.export();
    writeFileSync(dbPath, data);
  }
}

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON');

// Initialize schema
dbWrapper.exec(`
  -- Sessions table
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    session_state TEXT DEFAULT 'published',
    created_at TEXT DEFAULT (datetime('now')),
    published_at TEXT,
    voting_enabled_at TEXT,
    voting_locked_at TEXT,
    finalized_at TEXT
  );

  -- Topics table
  CREATE TABLE IF NOT EXISTS topics (
    topic_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    topic_name TEXT NOT NULL,
    sort_order INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
  );

  -- Session participants table
  CREATE TABLE IF NOT EXISTS session_participants (
    session_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    display_name TEXT,
    email TEXT,
    status TEXT DEFAULT 'joined',
    joined_at TEXT DEFAULT (datetime('now')),
    submitted_at TEXT,
    PRIMARY KEY (session_id, participant_id),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
  );

  -- Contributions table
  CREATE TABLE IF NOT EXISTS contributions (
    contribution_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    current_status TEXT,
    minor_impact TEXT,
    disruption TEXT,
    reimagination TEXT,
    submitted_at TEXT DEFAULT (datetime('now')),
    UNIQUE(session_id, topic_id, participant_id),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE CASCADE
  );

  -- Votes table
  CREATE TABLE IF NOT EXISTS votes (
    vote_id TEXT PRIMARY KEY,
    contribution_id TEXT NOT NULL,
    voter_id TEXT NOT NULL,
    voted_at TEXT DEFAULT (datetime('now')),
    UNIQUE(contribution_id, voter_id),
    FOREIGN KEY (contribution_id) REFERENCES contributions(contribution_id) ON DELETE CASCADE
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_contributions_session ON contributions(session_id);
  CREATE INDEX IF NOT EXISTS idx_contributions_participant ON contributions(participant_id);
  CREATE INDEX IF NOT EXISTS idx_votes_contribution ON votes(contribution_id);
  CREATE INDEX IF NOT EXISTS idx_session_participants_session ON session_participants(session_id);
`);

console.log('✅ Database initialized');

export default dbWrapper;

