export interface CommitData {
  sha: string
  timestamp: number // Unix ms
  message: string
  insertions: number
  deletions: number
  author: string
}

export interface VibeSignal {
  type:
    | 'burst_speed'
    | 'window_speed'
    | 'fix_fix'
    | 'coauthored'
    | 'rapid_commits'
    | 'ci_failure'
    | 'line_volume'
  score: number
  description: string
  commitSha?: string
}

export interface AnalysisResult {
  score: number           // unbounded raw float
  signals: VibeSignal[]
  timeline: { hour: string; score: number; commits: number }[]
  commitCount: number
  latestSha: string
  analyzedAt: number
  oldestCommitAt: number  // Unix ms of earliest commit
  // breakdown for display
  breakdown: ScoreBreakdown
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

// ── GitHub GraphQL ─────────────────────────────────────────────────────────────

const COMMITS_QUERY = `
query($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 100, after: $cursor) {
            nodes {
              oid
              committedDate
              message
              additions
              deletions
              author { name email }
            }
            pageInfo { endCursor hasNextPage }
          }
        }
      }
    }
  }
}
`

interface GQLCommitNode {
  oid: string
  committedDate: string
  message: string
  additions: number
  deletions: number
  author: { name: string; email: string }
}

interface GQLResponse {
  data?: {
    repository?: {
      defaultBranchRef?: {
        target?: {
          history?: {
            nodes: GQLCommitNode[]
            pageInfo: { endCursor: string; hasNextPage: boolean }
          }
        }
      }
    }
  }
  errors?: Array<{ message: string }>
}

export interface RateLimitInfo {
  remaining: number
  resetsAt: number // unix seconds
}

export interface FetchResult {
  commits: CommitData[]
  rateLimit: RateLimitInfo
}

// Fetch a single page of commits (up to 100), returns commits + pageInfo
export async function fetchCommitsPage(
  owner: string,
  repo: string,
  token: string,
  cursor: string | null
): Promise<{ commits: CommitData[]; rateLimit: RateLimitInfo; endCursor: string | null; hasNextPage: boolean }> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'vibecheck/1.0',
    },
    body: JSON.stringify({
      query: COMMITS_QUERY,
      variables: { owner, repo, cursor: cursor ?? null },
    }),
  })

  const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') ?? '9999', 10)
  const resetsAt = parseInt(res.headers.get('X-RateLimit-Reset') ?? '0', 10)
  const rateLimit: RateLimitInfo = { remaining, resetsAt }

  if (!res.ok) {
    throw new Error(`GitHub GraphQL error ${res.status}: ${await res.text()}`)
  }
  if (remaining < 10) {
    const err: any = new Error('rate_limit')
    err.rateLimit = rateLimit
    throw err
  }

  const gql: GQLResponse = await res.json()
  if (gql.errors?.length) {
    throw new Error(`GraphQL error: ${gql.errors.map((e) => e.message).join(', ')}`)
  }

  const history = gql.data?.repository?.defaultBranchRef?.target?.history
  if (!history) throw new Error('Repository not found or has no commits on default branch')

  const commits: CommitData[] = history.nodes.map((node) => ({
    sha: node.oid,
    timestamp: new Date(node.committedDate).getTime(),
    message: node.message,
    insertions: node.additions,
    deletions: node.deletions,
    author: node.author.name || node.author.email || 'unknown',
  }))

  return {
    commits,
    rateLimit,
    endCursor: history.pageInfo.endCursor ?? null,
    hasNextPage: history.pageInfo.hasNextPage,
  }
}

export async function fetchCommitsGraphQL(
  owner: string,
  repo: string,
  token: string
): Promise<FetchResult> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'vibecheck/1.0',
    },
    body: JSON.stringify({
      query: COMMITS_QUERY,
      variables: { owner, repo, cursor: null },
    }),
  })

  // Parse rate limit headers
  const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') ?? '9999', 10)
  const resetsAt = parseInt(res.headers.get('X-RateLimit-Reset') ?? '0', 10)
  const rateLimit: RateLimitInfo = { remaining, resetsAt }

  if (!res.ok) {
    throw new Error(`GitHub GraphQL error ${res.status}: ${await res.text()}`)
  }

  // Check rate limit BEFORE processing (so the caller can return 429 promptly)
  if (remaining < 10) {
    const err: any = new Error('rate_limit')
    err.rateLimit = rateLimit
    throw err
  }

  const gql: GQLResponse = await res.json()

  if (gql.errors?.length) {
    throw new Error(`GraphQL error: ${gql.errors.map((e) => e.message).join(', ')}`)
  }

  const history = gql.data?.repository?.defaultBranchRef?.target?.history
  if (!history) {
    throw new Error('Repository not found or has no commits on default branch')
  }

  const commits: CommitData[] = history.nodes.map((node) => ({
    sha: node.oid,
    timestamp: new Date(node.committedDate).getTime(),
    message: node.message,
    insertions: node.additions,
    deletions: node.deletions,
    author: node.author.name || node.author.email || 'unknown',
  }))

  return { commits, rateLimit }
}

// ── Vibe Analysis ──────────────────────────────────────────────────────────────

const CI_FAILURE_PATTERNS = ['fix ci', 'fix build', 'fix test', 'fix workflow', 'fix: ci', 'fix: build', 'fix: test']

function isCiFailureCommit(message: string): boolean {
  const lower = message.toLowerCase()
  return CI_FAILURE_PATTERNS.some((p) => lower.includes(p))
}

function deduplicateSignals(signals: VibeSignal[]): VibeSignal[] {
  // For signals with a sha: keep highest-score per sha per type
  // For signals without sha (line_volume, window_speed aggregates): keep all
  const byShaType = new Map<string, VibeSignal>()
  const other: VibeSignal[] = []

  for (const sig of signals) {
    if (!sig.commitSha) {
      other.push(sig)
      continue
    }
    const key = `${sig.commitSha}:${sig.type}`
    const existing = byShaType.get(key)
    if (!existing || sig.score > existing.score) {
      byShaType.set(key, sig)
    }
  }

  return [...byShaType.values(), ...other]
}

function buildTimeline(
  commits: CommitData[],
  signals: VibeSignal[]
): { hour: string; score: number; commits: number }[] {
  const signalMap = new Map<string, number>()
  for (const sig of signals) {
    if (sig.commitSha) {
      signalMap.set(sig.commitSha, (signalMap.get(sig.commitSha) ?? 0) + sig.score)
    }
  }

  // bucket by UTC hour — store as Unix ms (start of each hour) so frontend can localise
  const buckets = new Map<number, { score: number; commits: number }>()

  for (const commit of commits) {
    const d = new Date(commit.timestamp)
    // round down to the nearest hour (UTC)
    const hourStart = Math.floor(d.getTime() / 3_600_000) * 3_600_000
    const bucket = buckets.get(hourStart) ?? { score: 0, commits: 0 }
    bucket.commits++
    bucket.score += signalMap.get(commit.sha) ?? 0
    buckets.set(hourStart, bucket)
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, v]) => ({ hour: String(ts), ...v }))
}

export function analyzeVibe(commits: CommitData[]): AnalysisResult {
  if (commits.length === 0) {
    return {
      score: 0,
      signals: [],
      timeline: [],
      commitCount: 0,
      latestSha: '',
      analyzedAt: Date.now(),
      oldestCommitAt: Date.now(),
      breakdown: {
        burstSignals: 0,
        lineVolume: 0,
        windowSpeed: 0,
        fixFix: 0,
        coauthored: 0,
        rapidCommits: 0,
        ciFailures: 0,
      },
    }
  }

  commits.sort((a, b) => a.timestamp - b.timestamp)

  const signals: VibeSignal[] = []
  const breakdown: ScoreBreakdown = {
    burstSignals: 0,
    lineVolume: 0,
    windowSpeed: 0,
    fixFix: 0,
    coauthored: 0,
    rapidCommits: 0,
    ciFailures: 0,
  }

  // ── Line volume: total insertions × 0.05 ────────────────────────────────────
  const totalInsertions = commits.reduce((s, c) => s + c.insertions, 0)
  const lineVolumeScore = totalInsertions * 0.05
  breakdown.lineVolume = lineVolumeScore
  if (totalInsertions > 0) {
    signals.push({
      type: 'line_volume',
      score: lineVolumeScore,
      description: `${totalInsertions.toLocaleString()} total lines added (×0.05)`,
    })
  }

  for (let i = 1; i < commits.length; i++) {
    const curr = commits[i]
    const prev = commits[i - 1]
    const dtMinutes = (curr.timestamp - prev.timestamp) / 60000

    if (dtMinutes <= 0) continue

    // ── Signal: Instant typing speed ──────────────────────────────────────────
    const instantSpeed = curr.insertions / dtMinutes
    if (instantSpeed > 500) {
      const pts = 40
      breakdown.burstSignals += pts
      signals.push({
        type: 'burst_speed',
        score: pts,
        description: `${curr.insertions} lines in ${dtMinutes.toFixed(1)} min (${Math.round(instantSpeed)} lines/min)`,
        commitSha: curr.sha,
      })
    } else if (instantSpeed > 200) {
      const pts = 20
      breakdown.burstSignals += pts
      signals.push({
        type: 'burst_speed',
        score: pts,
        description: `${curr.insertions} lines in ${dtMinutes.toFixed(1)} min (${Math.round(instantSpeed)} lines/min)`,
        commitSha: curr.sha,
      })
    } else if (instantSpeed > 100) {
      const pts = 10
      breakdown.burstSignals += pts
      signals.push({
        type: 'burst_speed',
        score: pts,
        description: `Fast burst: ${curr.insertions} lines in ${dtMinutes.toFixed(1)} min`,
        commitSha: curr.sha,
      })
    }

    // ── Signal: Rapid commits (<2 min) with substantial code ──────────────────
    if (dtMinutes < 2 && curr.insertions > 30) {
      const pts = 15
      breakdown.rapidCommits += pts
      signals.push({
        type: 'rapid_commits',
        score: pts,
        description: `${curr.insertions} lines committed ${dtMinutes.toFixed(1)} min after previous`,
        commitSha: curr.sha,
      })
    }

    // ── Signal: fix-fix pattern ────────────────────────────────────────────────
    const prevMsg = prev.message.toLowerCase()
    const currMsg = curr.message.toLowerCase()
    if (
      (prevMsg.startsWith('fix') || prevMsg.includes('fix:')) &&
      (currMsg.startsWith('fix') || currMsg.includes('fix:')) &&
      dtMinutes < 10
    ) {
      const pts = 50
      breakdown.fixFix += pts
      signals.push({
        type: 'fix_fix',
        score: pts,
        description: `fix→fix in ${dtMinutes.toFixed(1)} min`,
        commitSha: curr.sha,
      })
    }

    // ── Signal: Co-authored-by ─────────────────────────────────────────────────
    if (curr.message.toLowerCase().includes('co-authored-by')) {
      const pts = 200
      breakdown.coauthored += pts
      signals.push({
        type: 'coauthored',
        score: pts,
        description: 'AI co-author attribution in commit message',
        commitSha: curr.sha,
      })
    }

    // ── Signal: CI failure hints ───────────────────────────────────────────────
    if (isCiFailureCommit(curr.message)) {
      const pts = 30
      breakdown.ciFailures += pts
      signals.push({
        type: 'ci_failure',
        score: pts,
        description: `CI/build failure fix: "${curr.message.split('\n')[0].slice(0, 60)}"`,
        commitSha: curr.sha,
      })
    }
  }

  // ── Signal: 30-min sliding window speed ───────────────────────────────────
  for (let i = 0; i < commits.length; i++) {
    const windowEnd = commits[i].timestamp
    const windowStart = windowEnd - 30 * 60 * 1000
    const windowCommits = commits.filter(
      (c) => c.timestamp >= windowStart && c.timestamp <= windowEnd
    )
    const totalLines = windowCommits.reduce((s, c) => s + c.insertions, 0)
    const windowSpeed = totalLines / 30 // lines/min

    if (windowSpeed > 300 && windowCommits.length >= 3) {
      const pts = 30
      breakdown.windowSpeed += pts
      signals.push({
        type: 'window_speed',
        score: pts,
        description: `${totalLines.toLocaleString()} lines in 30-min window (${Math.round(windowSpeed)}/min)`,
        commitSha: commits[i].sha,
      })
    }
  }

  const deduped = deduplicateSignals(signals)

  // Total score = sum of all signal scores (unbounded)
  const score = deduped.reduce((s, sig) => s + sig.score, 0)

  // Sort signals by score desc for display
  const sortedSignals = [...deduped].sort((a, b) => b.score - a.score)

  const timeline = buildTimeline(commits, deduped)
  const latestSha = commits[commits.length - 1].sha

  const oldestCommitAt = commits.length > 0
    ? Math.min(...commits.map(c => c.timestamp))
    : Date.now()

  return {
    score,
    signals: sortedSignals.slice(0, 20),
    timeline,
    commitCount: commits.length,
    latestSha,
    analyzedAt: Date.now(),
    oldestCommitAt,
    breakdown,
  }
}
