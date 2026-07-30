CREATE TABLE IF NOT EXISTS llm_daily_budget (
  usage_date TEXT PRIMARY KEY,
  reserved_millineurons INTEGER NOT NULL DEFAULT 0 CHECK (reserved_millineurons >= 0),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_llm_daily_budget_updated
  ON llm_daily_budget(updated_at);
