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
import { fetchCommitsGraphQL, analyzeVibe } from './analyze'
import { getLeaderboard, upsertLeaderboard } from './leaderboard'

type Env = {
  KV: KVNamespace
  DB: D1Database
  FRONTEND_URL: string
  GH_OAUTH_CLIENT_SECRET: string
}

const app = new Hono<{ Bindings: Env }>()

// ── CORS ──────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveSession(
  c: any
): Promise<{ token: string; user: { login: string; avatar_url: string; name: string } } | null> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const sessionId = authHeader.slice(7)
  return getSession(c.env.KV, sessionId)
}

// ── Auth Routes ───────────────────────────────────────────────────────────────

app.get('/auth/login', (c) => {
  const workerUrl = new URL(c.req.url).origin
  return c.redirect(buildLoginUrl(workerUrl))
})

app.get('/auth/callback', async (c) => {
  const code = c.req.query('code')
  const frontendUrl = c.env.FRONTEND_URL ?? 'http://localhost:5173'

  if (!code) {
    return c.redirect(`${frontendUrl}/?error=missing_code`)
  }

  try {
    const tokenData = await exchangeCodeForToken(code, c.env.GH_OAUTH_CLIENT_SECRET)
    const user = await getGitHubUser(tokenData.access_token)
    const sessionId = await createSession(c.env.KV, tokenData.access_token, user)
    return c.redirect(`${frontendUrl}/?token=${sessionId}`)
  } catch (err: any) {
    console.error('OAuth callback error:', err)
    return c.redirect(`${frontendUrl}/?error=${encodeURIComponent(err.message)}`)
  }
})

// ── API Routes ────────────────────────────────────────────────────────────────

app.get('/api/me', async (c) => {
  const session = await resolveSession(c)
  return c.json({ user: session?.user ?? null })
})

app.get('/api/analyze/:owner/:repo', async (c) => {
  const owner = c.req.param('owner')
  const repo = c.req.param('repo')

  // Auth required
  const session = await resolveSession(c)
  if (!session) {
    return c.json(
      { success: false, error: 'Authentication required. Please login with GitHub to analyze repos.' },
      401
    )
  }

  const { token } = session

  // KV cache key includes latest SHA for precise invalidation
  // First, do a cheap check: fetch the cached entry and see if we still have it
  const cacheKeyPrefix = `analysis:${owner}/${repo}`

  // Check if we have any cached result and whether it's still fresh (< 24h)
  const cachedRaw = await c.env.KV.get(cacheKeyPrefix)
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw)
      if (Date.now() - cached.analyzedAt < 86_400_000) {
        return c.json({ success: true, data: cached, cached: true })
      }
    } catch {}
  }

  try {
    // Fetch commits via GraphQL (single round-trip)
    const commits = await fetchCommitsGraphQL(owner, repo, token)
    const result = analyzeVibe(commits)

    // Cache with 24h TTL
    await c.env.KV.put(cacheKeyPrefix, JSON.stringify(result), { expirationTtl: 86400 })

    // Update D1 leaderboard (fire and forget — don't block the response)
    c.executionCtx.waitUntil(
      upsertLeaderboard(c.env.DB, owner, repo, result.overallScore, result.signals, result.commitCount)
        .catch((err) => console.error('Leaderboard upsert failed:', err))
    )

    return c.json({ success: true, data: result, cached: false })
  } catch (err: any) {
    console.error('Analysis error:', err)
    const status = err.message?.includes('not found') ? 404 : 500
    return c.json({ success: false, error: err.message }, status)
  }
})

app.get('/api/leaderboard', async (c) => {
  try {
    const entries = await getLeaderboard(c.env.DB, 20)
    return c.json({ entries })
  } catch (err: any) {
    console.error('Leaderboard error:', err)
    return c.json({ entries: [] })
  }
})

// Health check
app.get('/', (c) => c.json({ ok: true, service: 'vibecheck-api' }))

export default app
