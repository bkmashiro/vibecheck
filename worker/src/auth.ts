import type { KVNamespace } from '@cloudflare/workers-types'

const GH_CLIENT_ID = 'Ov23lin9cdvNmBGfZ9M7'

export function getLoginUrl(frontendUrl: string): string {
  const redirectUri = `${frontendUrl.replace('pages.dev', 'workers.dev')}/auth/callback`
  // We'll use the worker URL for callback
  return `https://github.com/login/oauth/authorize?client_id=${GH_CLIENT_ID}&scope=repo&redirect_uri=`
}

export function buildLoginUrl(workerBaseUrl: string): string {
  const redirectUri = encodeURIComponent(`${workerBaseUrl}/auth/callback`)
  return `https://github.com/login/oauth/authorize?client_id=${GH_CLIENT_ID}&scope=repo&redirect_uri=${redirectUri}`
}

export async function exchangeCodeForToken(
  code: string,
  clientSecret: string
): Promise<{ access_token: string; token_type: string; scope: string }> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: GH_CLIENT_ID,
      client_secret: clientSecret,
      code,
    }),
  })

  if (!res.ok) {
    throw new Error(`OAuth exchange failed: ${res.status}`)
  }

  const data: any = await res.json()
  if (data.error) {
    throw new Error(`OAuth error: ${data.error_description ?? data.error}`)
  }

  return data
}

export async function getGitHubUser(token: string): Promise<{ login: string; avatar_url: string; name: string }> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'vibecheck/1.0',
    },
  })
  if (!res.ok) {
    throw new Error(`Failed to get GitHub user: ${res.status}`)
  }
  return res.json()
}

export function generateSessionId(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function createSession(
  kv: KVNamespace,
  token: string,
  user: { login: string; avatar_url: string; name: string }
): Promise<string> {
  const sessionId = generateSessionId()
  await kv.put(
    `session:${sessionId}`,
    JSON.stringify({ token, user }),
    { expirationTtl: 86400 } // 24h
  )
  return sessionId
}

export async function getSession(
  kv: KVNamespace,
  sessionId: string
): Promise<{ token: string; user: { login: string; avatar_url: string; name: string } } | null> {
  const data = await kv.get(`session:${sessionId}`)
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}
