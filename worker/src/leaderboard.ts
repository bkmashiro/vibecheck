import type { D1Database } from '@cloudflare/workers-types'
import type { VibeSignal } from './analyze'

export interface ScoringVersion {
  version: string
  label: string
  description: string | null
  releasedAt: number
  isCurrent: boolean
}

export interface LeaderboardEntry {
  repo: string
  owner: string
  name: string
  score: number
  signalsSummary: VibeSignal[] | null
  commitCount: number | null
  analyzedAt: number
  version: string
}

export async function getCurrentVersion(db: D1Database): Promise<ScoringVersion | null> {
  const row = await db
    .prepare(`SELECT * FROM scoring_versions WHERE is_current = 1 LIMIT 1`)
    .first<{
      version: string
      label: string
      description: string | null
      released_at: number
      is_current: number
    }>()

  if (!row) return null
  return {
    version: row.version,
    label: row.label,
    description: row.description,
    releasedAt: row.released_at,
    isCurrent: row.is_current === 1,
  }
}

export async function getAllVersions(db: D1Database): Promise<ScoringVersion[]> {
  const result = await db
    .prepare(`SELECT * FROM scoring_versions ORDER BY released_at DESC`)
    .all<{
      version: string
      label: string
      description: string | null
      released_at: number
      is_current: number
    }>()

  return (result.results ?? []).map((row) => ({
    version: row.version,
    label: row.label,
    description: row.description,
    releasedAt: row.released_at,
    isCurrent: row.is_current === 1,
  }))
}

export async function getLeaderboard(
  db: D1Database,
  version: string,
  limit = 20
): Promise<LeaderboardEntry[]> {
  const result = await db
    .prepare(
      `SELECT repo, owner, name, score, signals_summary, commit_count, analyzed_at, version, ai_provider, language
       FROM leaderboard
       WHERE version = ?
       ORDER BY score DESC
       LIMIT ?`
    )
    .bind(version, limit)
    .all<{
      repo: string
      owner: string
      name: string
      score: number
      signals_summary: string | null
      commit_count: number | null
      analyzed_at: number
      version: string
      ai_provider: string | null
      language: string | null
    }>()

  return (result.results ?? []).map((row) => ({
    repo: row.repo,
    owner: row.owner,
    name: row.name,
    score: row.score,
    signalsSummary: row.signals_summary ? JSON.parse(row.signals_summary) : null,
    commitCount: row.commit_count,
    analyzedAt: row.analyzed_at,
    version: row.version,
    aiProvider: row.ai_provider,
    language: row.language,
  }))
}

export async function enrollToLeaderboard(
  db: D1Database,
  owner: string,
  repo: string,
  score: number,
  signals: VibeSignal[],
  commitCount: number,
  version: string,
  ai_provider?: string,
  language?: string
): Promise<void> {
  const top5 = signals.slice(0, 5)
  const signalsSummary = JSON.stringify(top5)

  await db
    .prepare(
      `INSERT OR REPLACE INTO leaderboard
         (repo, version, owner, name, score, signals_summary, commit_count, analyzed_at, ai_provider, language)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `${owner}/${repo}`,
      version,
      owner,
      repo,
      score,
      signalsSummary,
      commitCount,
      Date.now(),
      ai_provider ?? null,
      language ?? null
    )
    .run()
}

export async function getStats(db: D1Database, version: string) {
  const [providerRows, scoreRows, totalRow] = await Promise.all([
    db.prepare(
      `SELECT ai_provider, COUNT(*) as count, AVG(score) as avg_score
       FROM leaderboard WHERE version = ? AND ai_provider IS NOT NULL
       GROUP BY ai_provider ORDER BY avg_score DESC`
    ).bind(version).all<{ ai_provider: string; count: number; avg_score: number }>(),

    db.prepare(
      `SELECT score FROM leaderboard WHERE version = ? ORDER BY score DESC`
    ).bind(version).all<{ score: number }>(),

    db.prepare(
      `SELECT COUNT(*) as total, AVG(score) as avg, MAX(score) as max FROM leaderboard WHERE version = ?`
    ).bind(version).first<{ total: number; avg: number; max: number }>(),
  ])

  return {
    providers: providerRows.results,
    scores: scoreRows.results.map(r => r.score),
    summary: totalRow,
  }
}
