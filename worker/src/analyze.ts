export interface CommitData {
  sha: string
  timestamp: number // Unix ms
  message: string
  insertions: number
  deletions: number
  author: string
  parentCount?: number
}

export interface VibeSignal {
  type:
    | 'explicit_ai'
    | 'burst_speed'
    | 'session_density'
    | 'repair_chain'
    // Legacy v1 values remain readable in historical leaderboard entries.
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
  score: number           // bounded 0–100 likelihood index
  confidence: number      // bounded 0–100 sample confidence
  energy: number          // raw evidence points; diagnostics only
  algorithmVersion: 'v2'
  signals: VibeSignal[]
  timeline: { hour: string; score: number; commits: number }[]
  commitCount: number
  latestSha: string
  analyzedAt: number
  oldestCommitAt: number
  breakdown: ScoreBreakdown
  sample: {
    eligibleCommits: number
    mergeCommitsExcluded: number
    timespanDays: number
  }
}

export interface ScoreBreakdown {
  explicitAi: number
  burstSpeed: number
  sessionDensity: number
  repairChains: number
  rapidCommits: number
}

// ── GitHub GraphQL ─────────────────────────────────────────────────────────────

const COMMITS_QUERY = `
query($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    isPrivate
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
              parents { totalCount }
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
  parents: { totalCount: number }
}

interface GQLResponse {
  data?: {
    repository?: {
      isPrivate: boolean
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
  isPrivate: boolean
}

// Fetch a single page of commits (up to 100), returns commits + pageInfo
export async function fetchCommitsPage(
  owner: string,
  repo: string,
  token: string,
  cursor: string | null
): Promise<{ commits: CommitData[]; rateLimit: RateLimitInfo; endCursor: string | null; hasNextPage: boolean; isPrivate: boolean }> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
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
    parentCount: node.parents.totalCount,
  }))

  return {
    commits,
    rateLimit,
    endCursor: history.pageInfo.endCursor ?? null,
    hasNextPage: history.pageInfo.hasNextPage,
    isPrivate: gql.data?.repository?.isPrivate ?? false,
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
      Authorization: 'Bearer ' + token,
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
    parentCount: node.parents.totalCount,
  }))

  return { commits, rateLimit, isPrivate: gql.data?.repository?.isPrivate ?? false }
}

// ── Vibe Analysis v2 ───────────────────────────────────────────────────────────

const AI_ATTRIBUTION_PATTERNS = [
  /co-authored-by:.*(?:claude|copilot|cursor|gemini|codex|chatgpt|openai|anthropic|devin|windsurf|codeium)/i,
  /generated (?:with|by).*(?:claude|copilot|cursor|gemini|codex|chatgpt|openai|anthropic|devin|windsurf|codeium)/i,
  /(?:ai|llm)[ -]generated/i,
]

function hasExplicitAiAttribution(message: string): boolean {
  return AI_ATTRIBUTION_PATTERNS.some((pattern) => pattern.test(message))
}

function isRepairCommit(message: string): boolean {
  return /^(?:fix|hotfix|revert)(?:\(|:|\s)/i.test(message.trim())
}

function deduplicateSignals(signals: VibeSignal[]): VibeSignal[] {
  const byShaType = new Map<string, VibeSignal>()
  const other: VibeSignal[] = []

  for (const signal of signals) {
    if (!signal.commitSha) {
      other.push(signal)
      continue
    }
    const key = `${signal.commitSha}:${signal.type}`
    const existing = byShaType.get(key)
    if (!existing || signal.score > existing.score) byShaType.set(key, signal)
  }

  return [...byShaType.values(), ...other]
}

function buildTimeline(
  commits: CommitData[],
  signals: VibeSignal[]
): { hour: string; score: number; commits: number }[] {
  const signalMap = new Map<string, number>()
  for (const signal of signals) {
    if (signal.commitSha) {
      signalMap.set(signal.commitSha, (signalMap.get(signal.commitSha) ?? 0) + signal.score)
    }
  }

  const buckets = new Map<number, { score: number; commits: number }>()
  for (const commit of commits) {
    const hourStart = Math.floor(commit.timestamp / 3_600_000) * 3_600_000
    const bucket = buckets.get(hourStart) ?? { score: 0, commits: 0 }
    bucket.commits++
    bucket.score += signalMap.get(commit.sha) ?? 0
    buckets.set(hourStart, bucket)
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([timestamp, value]) => ({ hour: String(timestamp), ...value }))
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10
}

function emptyResult(commitCount = 0, mergeCommitsExcluded = 0): AnalysisResult {
  return {
    score: 0,
    confidence: 0,
    energy: 0,
    algorithmVersion: 'v2',
    signals: [],
    timeline: [],
    commitCount,
    latestSha: '',
    analyzedAt: Date.now(),
    oldestCommitAt: Date.now(),
    breakdown: {
      explicitAi: 0,
      burstSpeed: 0,
      sessionDensity: 0,
      repairChains: 0,
      rapidCommits: 0,
    },
    sample: { eligibleCommits: 0, mergeCommitsExcluded, timespanDays: 0 },
  }
}

export function analyzeVibe(inputCommits: CommitData[]): AnalysisResult {
  if (inputCommits.length === 0) return emptyResult()

  const allCommits = [...inputCommits].sort((a, b) => a.timestamp - b.timestamp)
  const commits = allCommits.filter((commit) => (commit.parentCount ?? 1) <= 1)
  const mergeCommitsExcluded = allCommits.length - commits.length
  if (commits.length === 0) return emptyResult(allCommits.length, mergeCommitsExcluded)

  const signals: VibeSignal[] = []

  // Explicit tool attribution is the only strong identity signal. A generic human
  // Co-Authored-By trailer is intentionally ignored.
  for (const commit of commits) {
    if (hasExplicitAiAttribution(commit.message)) {
      signals.push({
        type: 'explicit_ai',
        score: 18,
        description: 'Commit explicitly attributes an AI coding tool',
        commitSha: commit.sha,
      })
    }
  }

  // Commit-to-commit timing is only compared within one author. It is weak process
  // evidence: timestamps do not tell us when work actually started.
  const previousByAuthor = new Map<string, CommitData>()
  for (const commit of commits) {
    const authorKey = commit.author.trim().toLowerCase()
    const previous = previousByAuthor.get(authorKey)
    previousByAuthor.set(authorKey, commit)
    if (!previous) continue

    const deltaMinutes = (commit.timestamp - previous.timestamp) / 60_000
    if (deltaMinutes <= 0 || deltaMinutes > 30) continue

    const speed = commit.insertions / deltaMinutes
    const burstPoints = speed > 500 ? 8 : speed > 200 ? 5 : speed > 100 ? 3 : 0
    if (burstPoints > 0) {
      signals.push({
        type: 'burst_speed',
        score: burstPoints,
        description: `${commit.insertions} added lines in a ${deltaMinutes.toFixed(1)} min same-author interval`,
        commitSha: commit.sha,
      })
    }

    if (deltaMinutes < 2 && commit.insertions > 30) {
      signals.push({
        type: 'rapid_commits',
        score: 4,
        description: `${commit.insertions} added lines committed ${deltaMinutes.toFixed(1)} min after the same author's previous commit`,
        commitSha: commit.sha,
      })
    }

    if (isRepairCommit(previous.message) && isRepairCommit(commit.message) && deltaMinutes < 15) {
      signals.push({
        type: 'repair_chain',
        score: 5,
        description: `Same-author repair chain within ${deltaMinutes.toFixed(1)} min`,
        commitSha: commit.sha,
      })
    }
  }

  // Group same-author commits into non-overlapping 30-minute sessions. This avoids
  // the v1 sliding-window double counting that rewarded every overlapping window.
  const commitsByAuthor = new Map<string, CommitData[]>()
  for (const commit of commits) {
    const key = commit.author.trim().toLowerCase()
    commitsByAuthor.set(key, [...(commitsByAuthor.get(key) ?? []), commit])
  }
  for (const authorCommits of commitsByAuthor.values()) {
    let session: CommitData[] = []
    const flushSession = () => {
      if (session.length < 3) return
      const durationMinutes = Math.max(
        5,
        (session[session.length - 1].timestamp - session[0].timestamp) / 60_000,
      )
      const addedLines = session.reduce((sum, commit) => sum + commit.insertions, 0)
      const speed = addedLines / durationMinutes
      const points = speed > 200 ? 8 : speed > 80 ? 4 : 0
      if (points > 0) {
        signals.push({
          type: 'session_density',
          score: points,
          description: `${session.length} same-author commits and ${addedLines.toLocaleString()} added lines in ${durationMinutes.toFixed(0)} min`,
          commitSha: session[session.length - 1].sha,
        })
      }
    }

    for (const commit of authorCommits) {
      const previous = session[session.length - 1]
      if (previous && commit.timestamp - previous.timestamp > 30 * 60_000) {
        flushSession()
        session = []
      }
      session.push(commit)
    }
    flushSession()
  }

  const deduped = deduplicateSignals(signals)
  const pointsFor = (type: VibeSignal['type']) =>
    deduped.filter((signal) => signal.type === type).reduce((sum, signal) => sum + signal.score, 0)

  // Per-category caps keep one repetitive behavior from dominating the index.
  const breakdown: ScoreBreakdown = {
    explicitAi: Math.min(45, pointsFor('explicit_ai')),
    burstSpeed: Math.min(25, pointsFor('burst_speed')),
    sessionDensity: Math.min(20, pointsFor('session_density')),
    repairChains: Math.min(10, pointsFor('repair_chain')),
    rapidCommits: Math.min(10, pointsFor('rapid_commits')),
  }
  const energy = Object.values(breakdown).reduce((sum, value) => sum + value, 0)
  const score = rounded(100 * (1 - Math.exp(-energy / 32)))

  const oldestCommitAt = commits[0].timestamp
  const latestCommitAt = commits[commits.length - 1].timestamp
  const timespanDays = Math.max(0, (latestCommitAt - oldestCommitAt) / 86_400_000)
  const confidence = Math.round(Math.min(
    95,
    10
      + Math.min(55, Math.log2(commits.length + 1) * 10)
      + Math.min(30, Math.sqrt(timespanDays) * 6),
  ))

  return {
    score,
    confidence,
    energy,
    algorithmVersion: 'v2',
    signals: [...deduped].sort((a, b) => b.score - a.score).slice(0, 20),
    timeline: buildTimeline(commits, deduped),
    commitCount: allCommits.length,
    latestSha: commits[commits.length - 1].sha,
    analyzedAt: Date.now(),
    oldestCommitAt,
    breakdown,
    sample: {
      eligibleCommits: commits.length,
      mergeCommitsExcluded,
      timespanDays: rounded(timespanDays),
    },
  }
}
