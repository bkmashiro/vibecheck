export interface CommitData {
  sha: string
  timestamp: number // Unix ms
  message: string
  insertions: number
  deletions: number
  author: string
}

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
  latestSha: string
  analyzedAt: number
}

// ── GitHub GraphQL ────────────────────────────────────────────────────────────

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

export async function fetchCommitsGraphQL(
  owner: string,
  repo: string,
  token: string
): Promise<CommitData[]> {
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

  if (!res.ok) {
    throw new Error(`GitHub GraphQL error ${res.status}: ${await res.text()}`)
  }

  const gql: GQLResponse = await res.json()

  if (gql.errors?.length) {
    throw new Error(`GraphQL error: ${gql.errors.map((e) => e.message).join(', ')}`)
  }

  const history = gql.data?.repository?.defaultBranchRef?.target?.history
  if (!history) {
    throw new Error('Repository not found or has no commits on default branch')
  }

  return history.nodes.map((node) => ({
    sha: node.oid,
    timestamp: new Date(node.committedDate).getTime(),
    message: node.message,
    insertions: node.additions,
    deletions: node.deletions,
    author: node.author.name || node.author.email || 'unknown',
  }))
}

// ── Vibe Analysis ─────────────────────────────────────────────────────────────

function deduplicateSignals(signals: VibeSignal[]): VibeSignal[] {
  const bySha = new Map<string, VibeSignal>()
  const noSha: VibeSignal[] = []

  for (const sig of signals) {
    if (!sig.commitSha) {
      noSha.push(sig)
      continue
    }
    const existing = bySha.get(sig.commitSha)
    if (!existing || sig.score > existing.score) {
      bySha.set(sig.commitSha, sig)
    }
  }

  return [...bySha.values(), ...noSha]
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

  const buckets = new Map<string, { score: number; commits: number }>()

  for (const commit of commits) {
    const d = new Date(commit.timestamp)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`
    const bucket = buckets.get(key) ?? { score: 0, commits: 0 }
    bucket.commits++
    bucket.score += signalMap.get(commit.sha) ?? 0
    buckets.set(key, bucket)
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, v]) => ({ hour, ...v }))
}

export function analyzeVibe(commits: CommitData[]): AnalysisResult {
  if (commits.length === 0) {
    return {
      overallScore: 0,
      signals: [],
      timeline: [],
      commitCount: 0,
      latestSha: '',
      analyzedAt: Date.now(),
    }
  }

  commits.sort((a, b) => a.timestamp - b.timestamp)

  const signals: VibeSignal[] = []

  for (let i = 1; i < commits.length; i++) {
    const curr = commits[i]
    const prev = commits[i - 1]
    const dtMinutes = (curr.timestamp - prev.timestamp) / 60000

    if (dtMinutes <= 0) continue

    // Signal 1: Instant typing speed (lines added vs time)
    const instantSpeed = curr.insertions / dtMinutes
    if (instantSpeed > 500) {
      signals.push({
        type: 'burst_speed',
        score: 40,
        description: `${curr.insertions} lines in ${dtMinutes.toFixed(1)} min (${Math.round(
          instantSpeed
        )} lines/min)`,
        commitSha: curr.sha,
      })
    } else if (instantSpeed > 200) {
      signals.push({
        type: 'burst_speed',
        score: 20,
        description: `${curr.insertions} lines in ${dtMinutes.toFixed(1)} min`,
        commitSha: curr.sha,
      })
    } else if (instantSpeed > 100) {
      signals.push({
        type: 'burst_speed',
        score: 10,
        description: `Fast burst detected`,
        commitSha: curr.sha,
      })
    }

    // Signal 2: Rapid commits (< 2 min apart) with substantial code
    if (dtMinutes < 2 && curr.insertions > 30) {
      signals.push({
        type: 'rapid_commits',
        score: 15,
        description: `Large commit ${dtMinutes.toFixed(1)} min after previous`,
        commitSha: curr.sha,
      })
    }

    // Signal 3: fix-fix pattern
    const prevMsg = prev.message.toLowerCase()
    const currMsg = curr.message.toLowerCase()
    if (
      (prevMsg.startsWith('fix') || prevMsg.includes('fix:')) &&
      (currMsg.startsWith('fix') || currMsg.includes('fix:')) &&
      dtMinutes < 10
    ) {
      signals.push({
        type: 'fix_fix',
        score: 10,
        description: `fix-fix pattern in ${dtMinutes.toFixed(1)} min`,
        commitSha: curr.sha,
      })
    }

    // Signal 4: Co-authored-by
    if (curr.message.toLowerCase().includes('co-authored-by')) {
      signals.push({
        type: 'coauthored',
        score: 30,
        description: 'AI co-author attribution in commit',
        commitSha: curr.sha,
      })
    }
  }

  // Signal 5: 30-minute sliding window speed
  for (let i = 0; i < commits.length; i++) {
    const windowEnd = commits[i].timestamp
    const windowStart = windowEnd - 30 * 60 * 1000
    const windowCommits = commits.filter(
      (c) => c.timestamp >= windowStart && c.timestamp <= windowEnd
    )
    const totalLines = windowCommits.reduce((s, c) => s + c.insertions, 0)
    const windowSpeed = totalLines / 30

    if (windowSpeed > 300 && windowCommits.length >= 3) {
      signals.push({
        type: 'window_speed',
        score: 30,
        description: `${totalLines} lines added in 30-min window (${Math.round(
          windowSpeed
        )}/min)`,
        commitSha: commits[i].sha,
      })
    }
  }

  const deduped = deduplicateSignals(signals)
  const rawScore = deduped.reduce((s, sig) => s + sig.score, 0)
  const overallScore = Math.min(100, Math.round((rawScore / commits.length) * 10))
  const timeline = buildTimeline(commits, deduped)

  // latest SHA (most recent commit after sort)
  const latestSha = commits[commits.length - 1].sha

  return {
    overallScore,
    signals: deduped.slice(0, 20),
    timeline,
    commitCount: commits.length,
    latestSha,
    analyzedAt: Date.now(),
  }
}
