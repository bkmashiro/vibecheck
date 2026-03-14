CREATE TABLE IF NOT EXISTS leaderboard (
  repo TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  top_signal TEXT,
  commit_count INTEGER,
  analyzed_at INTEGER NOT NULL
);
