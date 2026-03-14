// Cloudflare Pages Function — dynamic OG meta tags for /r/:owner/:repo
// Injects score-aware Open Graph tags before serving the SPA shell.

interface Env {
  ASSETS: Fetcher
}

function formatScore(score: number): string {
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}k`
  return Math.round(score).toString()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { owner, repo } = ctx.params as { owner: string; repo: string }
  const fullRepo = `${owner}/${repo}`
  const pageUrl = `https://git-vibe.pages.dev/r/${owner}/${repo}`

  // Try to get enrollment data (score) — no auth needed
  let score: number | null = null
  let aiProvider: string | null = null
  try {
    const res = await fetch(`https://vibecheck-api.dylan-233.workers.dev/api/enrolled/${owner}/${repo}`)
    if (res.ok) {
      const data = await res.json() as { enrolled: boolean; score?: number; aiProvider?: string | null }
      if (data.enrolled && data.score != null) {
        score = data.score
        aiProvider = data.aiProvider ?? null
      }
    }
  } catch {}

  const scoreStr = score != null ? formatScore(score) : null
  const providerStr = aiProvider ? ` (${aiProvider})` : ''

  const title = scoreStr
    ? `${fullRepo} — ${scoreStr} vibe pts${providerStr} | VibeCheck`
    : `${fullRepo} | VibeCheck — AI Coding Detector`

  const description = scoreStr
    ? `${fullRepo} scored ${scoreStr} pts on VibeCheck${providerStr}. See the breakdown: burst speed, fix chains, co-authorship tags, and more.`
    : `Analyze ${fullRepo}'s commit history and see how much of it was AI-assisted. No install needed.`

  const ogImage = `https://git-vibe.pages.dev/og-default.png`

  // Serve the SPA index with injected meta tags
  const indexRes = await ctx.env.ASSETS.fetch(new URL('/', ctx.request.url).toString())
  let html = await indexRes.text()

  const meta = `
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="VibeCheck" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@bkmashiro" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${ogImage}" />
    <title>${escapeHtml(title)}</title>`

  // Replace existing <title> and inject before </head>
  html = html.replace(/<title>.*?<\/title>/, '')
  html = html.replace('</head>', `${meta}\n  </head>`)

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  })
}
