const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface VibeSignal {
  type: 'burst_speed' | 'window_speed' | 'fix_fix' | 'coauthored' | 'rapid_commits'
  score: number
  description: string
  commitSha?: string
}

export interface AnalysisResult {
  overallScore: number
  signals: VibeSignal[]
  timeline: { hour: string; score: number; commits: number }[]
  commitCount: number
  analyzedAt: number
}

export interface LeaderboardEntry {
  repo: string
  owner: string
  name: string
  score: number
  topSignal: string | null
  commitCount: number
  analyzedAt: number
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('vibecheck_session')
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

export class AuthRequiredError extends Error {
  constructor() {
    super('Authentication required')
    this.name = 'AuthRequiredError'
  }
}

export async function analyzeRepo(owner: string, repo: string): Promise<{ data: AnalysisResult; cached: boolean }> {
  const res = await fetch(`${API_BASE}/api/analyze/${owner}/${repo}`, {
    headers: getAuthHeaders(),
  })
  if (res.status === 401) {
    throw new AuthRequiredError()
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Analysis failed')
  return { data: json.data, cached: json.cached }
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_BASE}/api/leaderboard`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return json.entries
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

export function getLoginUrl(): string {
  return `${API_BASE}/auth/login`
}
