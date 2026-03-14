import type { D1Database } from '@cloudflare/workers-types'
import type { VibeSignal } from './analyze'

export interface LeaderboardEntry {
  repo: string
  owner: string
  name: string
  score: number
  topSignal: string | null
  commitCount: number
  analyzedAt: number
}

export const LEADERBOARD_SCHEMA = `
CREATE TABLE IF NOT EXISTS leaderboard (
  repo TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  top_signal TEXT,
  commit_count INTEGER,
  analyzed_at INTEGER NOT NULL
);
`

export async function getLeaderboard(db: D1Database, limit = 20): Promise<LeaderboardEntry[]> {
  const result = await db
    .prepare(
      `SELECT repo, owner, name, score, top_signal, commit_count, analyzed_at
       FROM leaderboard
       ORDER BY score DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<{
      repo: string
      owner: string
      name: string
      score: number
      top_signal: string | null
      commit_count: number
      analyzed_at: number
    }>()

  return (result.results ?? []).map((row) => ({
    repo: row.repo,
    owner: row.owner,
    name: row.name,
    score: row.score,
    topSignal: row.top_signal,
    commitCount: row.commit_count,
    analyzedAt: row.analyzed_at,
  }))
}

export async function upsertLeaderboard(
  db: D1Database,
  owner: string,
  repo: string,
  score: number,
  signals: VibeSignal[],
  commitCount: number
): Promise<void> {
  const topSignal =
    signals.length > 0 ? `${signals[0].type}: ${signals[0].description}` : null

  await db
    .prepare(
      `INSERT OR REPLACE INTO leaderboard
         (repo, owner, name, score, top_signal, commit_count, analyzed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `${owner}/${repo}`,
      owner,
      repo,
      score,
      topSignal,
      commitCount,
      Date.now()
    )
    .run()
}
