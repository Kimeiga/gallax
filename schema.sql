-- Players table
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,              -- Google user ID
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  resources TEXT DEFAULT '{"wood":0,"stone":0,"fish":0,"gems":0,"shells":0,"herbs":0}',
  lng REAL DEFAULT -73.965,
  lat REAL DEFAULT 40.782,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Buildings table
CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  lng REAL NOT NULL,
  lat REAL NOT NULL,
  rotation REAL DEFAULT 0,
  owner_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_buildings_owner ON buildings(owner_id);

-- Sessions table for auth tokens
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,              -- Session token
  player_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

