const API_BASE = import.meta.env.VITE_API_URL ?? ''
export const API_URL = API_BASE

// ── Types ──────────────────────────────────────────────────────────────────────

export interface VibeSignal {
  type: 'burst_speed' | 'window_speed' | 'fix_fix' | 'coauthored' | 'rapid_commits' | 'ci_failure' | 'line_volume'
  score: number
  description: string
  commitSha?: string
}

export interface ScoreBreakdown {
  burstSignals: number
  lineVolume: number
  windowSpeed: number
  fixFix: number
  coauthored: number
  rapidCommits: number
  ciFailures: number
}

export interface AnalysisResult {
  score: number           // unbounded
  signals: VibeSignal[]
  timeline: { hour: string; score: number; commits: number }[]
  commitCount: number
  latestSha: string
  analyzedAt: number
  breakdown: ScoreBreakdown
}

export interface RateLimitInfo {
  remaining: number
  resetsAt: number
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

export interface ScoringVersion {
  version: string
  label: string
  description: string | null
  releasedAt: number
  isCurrent: boolean
}

export interface UserRepo {
  fullName: string
  name: string
  owner: string
  description: string | null
  private: boolean
  stars: number
  updatedAt: string
  language: string | null
}

// ── Errors ─────────────────────────────────────────────────────────────────────

export class AuthRequiredError extends Error {
  constructor() {
    super('Authentication required')
    this.name = 'AuthRequiredError'
  }
}

export class RateLimitError extends Error {
  remaining: number
  resetsAt: number
  constructor(remaining: number, resetsAt: number, message: string) {
    super(message)
    this.name = 'RateLimitError'
    this.remaining = remaining
    this.resetsAt = resetsAt
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('vibecheck_session')
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

async function ghFetch(url: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...opts,
    headers: { ...getAuthHeaders(), ...(opts?.headers ?? {}) },
  })
  if (res.status === 401) throw new AuthRequiredError()
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}))
    throw new RateLimitError(body.remaining ?? 0, body.resetsAt ?? 0, body.message ?? 'Rate limited')
  }
  return res
}

// ── API calls ──────────────────────────────────────────────────────────────────

export async function analyzeRepo(
  owner: string,
  repo: string,
  force = false
): Promise<{ data: AnalysisResult; cached: boolean; rateLimit?: RateLimitInfo }> {
  const url = `/api/analyze/${owner}/${repo}${force ? '?force=true' : ''}`
  const res = await ghFetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Analysis failed')
  return { data: json.data, cached: json.cached, rateLimit: json.rateLimit }
}

export async function enrollRepo(owner: string, repo: string, ai_provider?: string): Promise<{ version: string; label: string }> {
  const res = await ghFetch('/api/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo, ai_provider }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getLeaderboard(
  version?: string
): Promise<{ entries: LeaderboardEntry[]; version: ScoringVersion | null }> {
  const url = version ? `/api/leaderboard?v=${version}` : '/api/leaderboard'
  const res = await fetch(`${API_BASE}${url}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getVersions(): Promise<ScoringVersion[]> {
  const res = await fetch(`${API_BASE}/api/versions`)
  if (!res.ok) return []
  const json = await res.json()
  return json.versions ?? []
}

export async function getMe(): Promise<{ login: string; avatar_url: string; name: string } | null> {
  const token = localStorage.getItem('vibecheck_session')
  if (!token) return null
  const res = await fetch(`${API_BASE}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.user
}

export async function getMyRepos(): Promise<UserRepo[]> {
  const res = await ghFetch('/api/me/repos')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return json.repos ?? []
}

export function getLoginUrl(): string {
  return `${API_BASE}/auth/login`
}

export async function checkEnrolled(owner: string, repo: string): Promise<{ enrolled: boolean; score?: number; aiProvider?: string | null }> {
  try {
    const res = await fetch(`${API_BASE}/api/enrolled/${owner}/${repo}`)
    if (!res.ok) return { enrolled: false }
    return res.json()
  } catch {
    return { enrolled: false }
  }
}
