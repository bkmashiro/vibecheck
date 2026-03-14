CREATE TABLE IF NOT EXISTS scoring_versions (
  version TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  released_at INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leaderboard (
  repo TEXT NOT NULL,
  version TEXT NOT NULL,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  score REAL NOT NULL,
  signals_summary TEXT,
  commit_count INTEGER,
  analyzed_at INTEGER NOT NULL,
  PRIMARY KEY (repo, version)
);

-- Seed v1 as current
INSERT OR IGNORE INTO scoring_versions VALUES ('v1', 'Alpha', 'Initial scoring algorithm', unixepoch(), 1);
