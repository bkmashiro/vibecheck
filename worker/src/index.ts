import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { KVNamespace, D1Database } from '@cloudflare/workers-types'
import {
  buildLoginUrl,
  exchangeCodeForToken,
  getGitHubUser,
  createSession,
  getSession,
} from './auth'
import { fetchCommitsGraphQL, analyzeVibe, type AnalysisResult } from './analyze'
import {
  getCurrentVersion,
  getAllVersions,
  getLeaderboard,
  enrollToLeaderboard,
  getStats,
} from './leaderboard'

type Env = {
  KV: KVNamespace
  DB: D1Database
  FRONTEND_URL: string
  GH_OAUTH_CLIENT_SECRET: string
}

const app = new Hono<{ Bindings: Env }>()

// ── CORS ───────────────────────────────────────────────────────────────────────

app.use('*', async (c, next) => {
  const frontendUrl = c.env.FRONTEND_URL ?? 'http://localhost:5173'
  const corsMiddleware = cors({
    origin: [frontendUrl, 'http://localhost:5173', 'http://localhost:4173'],
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  })
  return corsMiddleware(c, next)
})

// ── Auth helpers ───────────────────────────────────────────────────────────────

type SessionData = {
  token: string
  user: { login: string; avatar_url: string; name: string }
}

async function resolveSession(c: any): Promise<SessionData | null> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const sessionId = authHeader.slice(7)
  return getSession(c.env.KV, sessionId)
}

async function requireSession(c: any): Promise<SessionData | Response> {
  const session = await resolveSession(c)
  if (!session) {
    return c.json(
      {
        error: 'auth_required',
        message: 'Login with GitHub to analyze repos.',
      },
      401
    )
  }
  return session
}

// ── Auth routes ────────────────────────────────────────────────────────────────

app.get('/auth/login', (c) => {
  const workerUrl = new URL(c.req.url).origin
  return c.redirect(buildLoginUrl(workerUrl))
})

app.get('/auth/callback', async (c) => {
  const code = c.req.query('code')
  const frontendUrl = c.env.FRONTEND_URL ?? 'http://localhost:5173'

  if (!code) return c.redirect(`${frontendUrl}/?error=missing_code`)

  try {
    const tokenData = await exchangeCodeForToken(code, c.env.GH_OAUTH_CLIENT_SECRET)
    const user = await getGitHubUser(tokenData.access_token)
    const sessionId = await createSession(c.env.KV, tokenData.access_token, user)
    return c.redirect(`${frontendUrl}/callback?token=${sessionId}`)
  } catch (err: any) {
    console.error('OAuth callback error:', err)
    return c.redirect(`${frontendUrl}/callback?error=${encodeURIComponent(err.message)}`)
  }
})

// ── User routes ────────────────────────────────────────────────────────────────

app.get('/api/me', async (c) => {
  const session = await resolveSession(c)
  return c.json({ user: session?.user ?? null })
})

app.get('/api/me/repos', async (c) => {
  const session = await resolveSession(c)
  if (!session) return c.json({ error: 'auth_required' }, 401)

  const res = await fetch(
    'https://api.github.com/user/repos?per_page=50&sort=updated&affiliation=owner,collaborator',
    {
      headers: {
        Authorization: `Bearer ${session.token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'vibecheck/1.0',
      },
    }
  )

  if (!res.ok) {
    return c.json({ error: `GitHub error: ${res.status}` }, 502)
  }

  const repos: Array<{
    full_name: string
    name: string
    owner: { login: string }
    description: string | null
    private: boolean
    stargazers_count: number
    updated_at: string
    language: string | null
  }> = await res.json()

  return c.json({
    repos: repos.map((r) => ({
      fullName: r.full_name,
      name: r.name,
      owner: r.owner.login,
      description: r.description,
      private: r.private,
      stars: r.stargazers_count,
      updatedAt: r.updated_at,
      language: r.language,
    })),
  })
})

// ── Analysis route ─────────────────────────────────────────────────────────────

app.get('/api/analyze/:owner/:repo', async (c) => {
  const owner = c.req.param('owner')
  const repo = c.req.param('repo')

  const sessionOrResp = await requireSession(c)
  if (sessionOrResp instanceof Response) return sessionOrResp
  const { token } = sessionOrResp

  // KV cache check (24h), skip with ?force=true
  const force = c.req.query('force') === 'true'
  const cacheKey = `analysis:${owner}/${repo}`
  if (!force) {
    const cachedRaw = await c.env.KV.get(cacheKey)
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as AnalysisResult
        if (Date.now() - cached.analyzedAt < 86_400_000) {
          return c.json({ success: true, data: cached, cached: true })
        }
      } catch {}
    }
  }

  try {
    const { commits, rateLimit } = await fetchCommitsGraphQL(owner, repo, token)
    const result = analyzeVibe(commits)

    await c.env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 })

    return c.json({ success: true, data: result, cached: false, rateLimit })
  } catch (err: any) {
    console.error('Analysis error:', err)

    // Rate limit
    if (err.message === 'rate_limit' && err.rateLimit) {
      const rl = err.rateLimit
      const resetInSeconds = Math.max(0, rl.resetsAt - Math.floor(Date.now() / 1000))
      const resetInMinutes = Math.ceil(resetInSeconds / 60)
      return c.json(
        {
          error: 'rate_limit',
          remaining: rl.remaining,
          resetsAt: rl.resetsAt,
          message: `Your GitHub API quota is almost exhausted. It resets in ~${resetInMinutes} minute${resetInMinutes !== 1 ? 's' : ''}. Come back then!`,
        },
        429
      )
    }

    const status = err.message?.includes('not found') ? 404 : 500
    return c.json({ success: false, error: err.message }, status)
  }
})

// ── Leaderboard enrollment (opt-in) ───────────────────────────────────────────

app.post('/api/enroll', async (c) => {
  const sessionOrResp = await requireSession(c)
  if (sessionOrResp instanceof Response) return sessionOrResp

  let body: { owner: string; repo: string; ai_provider?: string; language?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { owner, repo, ai_provider, language } = body
  if (!owner || !repo) {
    return c.json({ error: 'owner and repo are required' }, 400)
  }

  // Must have a cached analysis
  const cacheKey = `analysis:${owner}/${repo}`
  const cachedRaw = await c.env.KV.get(cacheKey)
  if (!cachedRaw) {
    return c.json({ error: 'No cached analysis found. Please analyze the repo first.' }, 404)
  }

  let result: AnalysisResult
  try {
    result = JSON.parse(cachedRaw)
  } catch {
    return c.json({ error: 'Corrupted cache. Please re-analyze the repo.' }, 500)
  }

  // Get current scoring version
  const version = await getCurrentVersion(c.env.DB)
  if (!version) {
    return c.json({ error: 'No active scoring version found.' }, 500)
  }

  try {
    await enrollToLeaderboard(
      c.env.DB,
      owner,
      repo,
      result.score,
      result.signals,
      result.commitCount,
      version.version,
      ai_provider,
      language
    )
    return c.json({ success: true, version: version.version, label: version.label })
  } catch (err: any) {
    console.error('Enroll error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// ── Leaderboard read ───────────────────────────────────────────────────────────

app.get('/api/leaderboard', async (c) => {
  // Allow specific version via ?v=
  let versionStr = c.req.query('v')

  try {
    if (!versionStr) {
      const current = await getCurrentVersion(c.env.DB)
      if (!current) return c.json({ entries: [], version: null })
      versionStr = current.version
    }

    // Fetch version metadata
    const versions = await getAllVersions(c.env.DB)
    const versionMeta = versions.find((v) => v.version === versionStr)

    const entries = await getLeaderboard(c.env.DB, versionStr, 20)
    return c.json({
      entries,
      version: versionMeta ?? null,
    })
  } catch (err: any) {
    console.error('Leaderboard error:', err)
    return c.json({ entries: [], version: null })
  }
})

app.get('/api/stats', async (c) => {
  try {
    // using top-level import
    const version = await getCurrentVersion(c.env.DB)
    if (!version) return c.json({ error: 'no version' }, 404)
    const stats = await getStats(c.env.DB, version.version)
    return c.json({ ...stats, version: version.version, label: version.label })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/api/versions', async (c) => {
  try {
    const versions = await getAllVersions(c.env.DB)
    return c.json({ versions })
  } catch (err: any) {
    return c.json({ versions: [] })
  }
})

// ── Badges (shields.io endpoint format) ────────────────────────────────────────

// Repo vibe score badge: /badge/repo/:owner/:repo
app.get('/badge/repo/:owner/:repo', async (c) => {
  const { owner, repo } = c.req.param()
  const fullRepo = `${owner}/${repo}`
  try {
    const ver = await getCurrentVersion(c.env.DB)
    const row = ver
      ? await c.env.DB.prepare(
          'SELECT score FROM leaderboard WHERE repo = ? AND version = ?'
        ).bind(fullRepo, ver.version).first<{ score: number }>()
      : null

    if (!row) {
      return c.json({ schemaVersion: 1, label: 'vibe score', message: 'not ranked', color: 'lightgrey' })
    }
    const score = row.score
    const color = score >= 2000 ? 'red' : score >= 500 ? 'orange' : score >= 100 ? 'yellow' : 'green'
    const msg = score >= 1000 ? `${(score / 1000).toFixed(1)}k pts` : `${Math.round(score)} pts`
    return c.json({ schemaVersion: 1, label: 'vibe score', message: msg, color })
  } catch (e: any) {
    return c.json({ schemaVersion: 1, label: 'vibe score', message: e.message ?? 'error', color: 'lightgrey' })
  }
})

// Repo rank badge: /badge/rank/:owner/:repo
app.get('/badge/rank/:owner/:repo', async (c) => {
  const { owner, repo } = c.req.param()
  const fullRepo = `${owner}/${repo}`
  try {
    const ver = await getCurrentVersion(c.env.DB)
    if (!ver) return c.json({ schemaVersion: 1, label: 'vibe rank', message: 'unranked', color: 'lightgrey' })

    const rows = await c.env.DB.prepare(
      'SELECT repo FROM leaderboard WHERE version = ? ORDER BY score DESC'
    ).bind(ver.version).all<{ repo: string }>()

    const rank = rows.results.findIndex(r => r.repo === fullRepo) + 1
    if (!rank) return c.json({ schemaVersion: 1, label: 'vibe rank', message: 'unranked', color: 'lightgrey' })

    const color = rank === 1 ? 'gold' : rank <= 3 ? 'orange' : rank <= 10 ? 'yellow' : 'blue'
    return c.json({ schemaVersion: 1, label: 'vibe rank', message: `#${rank} globally`, color })
  } catch (e: any) {
    return c.json({ schemaVersion: 1, label: 'vibe rank', message: e.message ?? 'error', color: 'lightgrey' })
  }
})

// User's top repo rank badge: /badge/user/:username
app.get('/badge/user/:username', async (c) => {
  const { username } = c.req.param()
  try {
    const ver = await getCurrentVersion(c.env.DB)
    if (!ver) return c.json({ schemaVersion: 1, label: 'top vibe repo', message: 'none', color: 'lightgrey' })

    const topRepo = await c.env.DB.prepare(
      'SELECT repo, score FROM leaderboard WHERE owner = ? AND version = ? ORDER BY score DESC LIMIT 1'
    ).bind(username, ver.version).first<{ repo: string; score: number }>()

    if (!topRepo) return c.json({ schemaVersion: 1, label: 'top vibe repo', message: 'none ranked', color: 'lightgrey' })

    const allRows = await c.env.DB.prepare(
      'SELECT repo FROM leaderboard WHERE version = ? ORDER BY score DESC'
    ).bind(ver.version).all<{ repo: string }>()

    const globalRank = allRows.results.findIndex(r => r.repo === topRepo.repo) + 1
    const repoName = topRepo.repo.split('/')[1]
    const color = globalRank === 1 ? 'gold' : globalRank <= 3 ? 'orange' : globalRank <= 10 ? 'yellow' : 'blue'
    return c.json({ schemaVersion: 1, label: repoName, message: `#${globalRank} globally`, color })
  } catch (e: any) {
    return c.json({ schemaVersion: 1, label: 'top vibe repo', message: e.message ?? 'error', color: 'lightgrey' })
  }
})

// ── Health ─────────────────────────────────────────────────────────────────────

app.get('/', (c) => c.json({ ok: true, service: 'vibecheck-api' }))

export default app
