-- Players table
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,              -- Google user ID or guest_xxx
  email TEXT,                       -- Empty for guest users
  name TEXT NOT NULL,
  avatar_url TEXT,
  resources TEXT DEFAULT '{"wood":0,"stone":0,"fish":0,"gems":0,"shells":0,"herbs":0}',
  coins INTEGER DEFAULT 0,          -- Mission rewards currency
  lng REAL DEFAULT -73.965,
  lat REAL DEFAULT 40.782,
  is_guest INTEGER DEFAULT 0,       -- 1 for guest users, 0 for authenticated
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

-- Public spaces (landmarks with missions)
CREATE TABLE IF NOT EXISTS public_spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lng REAL NOT NULL,
  lat REAL NOT NULL,
  radius REAL DEFAULT 50, -- meters
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Missions available at public spaces
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL, -- 'collect', 'visit', 'build', 'social', 'distance'
  objective TEXT NOT NULL, -- JSON: {"type": "collect", "resource": "wood", "amount": 10}
  reward_coins INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (space_id) REFERENCES public_spaces(id) ON DELETE CASCADE
);

-- Player missions (active and completed)
CREATE TABLE IF NOT EXISTS player_missions (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'claimed'
  progress TEXT DEFAULT '{}', -- JSON: {"collected": 5, "target": 10}
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  claimed_at TEXT,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_missions_player ON player_missions(player_id);
CREATE INDEX IF NOT EXISTS idx_player_missions_status ON player_missions(status);

-- Game metadata for cache invalidation
CREATE TABLE IF NOT EXISTS game_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Initialize buildings version
INSERT OR IGNORE INTO game_metadata (key, value) VALUES ('buildings_version', '1');

