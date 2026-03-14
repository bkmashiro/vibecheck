import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import Nav from '../components/Nav'
import { t, getRoast, getRoastCount } from '../lib/i18n'
import {
  analyzeRepo,
  enrollRepo,
  checkEnrolled,
  AuthRequiredError,
  RateLimitError,
  getLoginUrl,
  API_URL,
  type AnalysisResult,
  type VibeSignal,
} from '../lib/api'

const BADGE_BASE = API_URL

function BadgesPanel({ owner, repo, username }: { owner: string; repo: string; username?: string }) {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const badges = [
    {
      key: 'score',
      label: 'Vibe Score',
      endpointPath: `/badge/repo/${owner}/${repo}`,
      linkUrl: `https://git-vibe.pages.dev/r/${owner}/${repo}`,
    },
    {
      key: 'rank',
      label: 'Global Rank',
      endpointPath: `/badge/rank/${owner}/${repo}`,
      linkUrl: `https://git-vibe.pages.dev/r/${owner}/${repo}`,
    },
  ]

  const userBadge = username ? {
    key: 'user',
    label: 'My Top Vibe Repo',
    endpointPath: `/badge/user/${username}`,
    linkUrl: `https://git-vibe.pages.dev`,
  } : null

  const allBadges = userBadge ? [...badges, userBadge] : badges

  return (
    <div className="space-y-3">
      {allBadges.map(b => {
        const endpoint = `${BADGE_BASE}${b.endpointPath}`
        const shieldsUrl = `https://img.shields.io/endpoint?url=${encodeURIComponent(endpoint)}`
        const markdown = `[![${b.label}](${shieldsUrl})](${b.linkUrl})`
        // user badge is grey until any repo is enrolled; repo badges grey until this repo is enrolled
        const isUserBadge = b.key === 'user'
        const greyHint = isUserBadge
          ? 'Grey until you enroll any repo in the leaderboard'
          : 'Grey until this repo is enrolled in the leaderboard — submit below ↓'
        return (
          <div key={b.key} className="bg-gray-800/60 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-gray-400 text-xs">{b.label}</span>
                <p className="text-gray-600 text-xs mt-0.5">{greyHint}</p>
              </div>
              <img
                src={shieldsUrl}
                alt={b.label}
                className="h-5 ml-3 shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-gray-500 bg-gray-900 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap block">
                {markdown}
              </code>
              <button
                onClick={() => copy(b.key, markdown)}
                className="shrink-0 text-xs px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-gray-300"
              >
                {copied === b.key ? '✅' : '📋'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Signal labels ──────────────────────────────────────────────────────────────

const SIGNAL_META: Record<VibeSignal['type'], { label: string; color: string }> = {
  burst_speed:   { label: '⚡ Burst Speed',     color: 'text-amber-400' },
  window_speed:  { label: '📈 Window Speed',    color: 'text-orange-400' },
  fix_fix:       { label: '🔄 Fix→Fix Pattern', color: 'text-yellow-400' },
  coauthored:    { label: '🤝 AI Co-author',    color: 'text-purple-400' },
  rapid_commits: { label: '💨 Rapid Commits',   color: 'text-blue-400' },
  ci_failure:    { label: '🔴 CI Failure Fix',  color: 'text-red-400' },
  line_volume:   { label: '📦 Line Volume',     color: 'text-emerald-400' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatScore(score: number): string {
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(2)}M`
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}k`
  return score.toFixed(1)
}

function scoreLabel(score: number): { emoji: string; label: string; colorClass: string } {
  if (score >= 2000) return { emoji: '🤖', label: t.labelPureVibe,   colorClass: 'text-red-400' }
  if (score >= 500)  return { emoji: '🤖', label: t.labelHeavyAI,    colorClass: 'text-orange-400' }
  if (score >= 100)  return { emoji: '🤝', label: t.labelMixed,        colorClass: 'text-yellow-400' }
  return               { emoji: '👨‍💻', label: t.labelMostlyHuman,          colorClass: 'text-emerald-400' }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreDisplay({ score }: { score: number }) {
  const { emoji, label, colorClass } = scoreLabel(score)
  const total = getRoastCount(score)
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * total))

  return (
    <div className="flex flex-col items-center py-8">
      <div className="text-8xl mb-3">{emoji}</div>
      <div className={`text-6xl font-bold tabular-nums ${colorClass}`}>
        {formatScore(score)}
      </div>
      <div className="text-gray-500 text-lg mt-1">{t.points}</div>
      <div className="text-gray-400 mt-2 text-lg">{label}</div>
      <div className="flex items-center gap-2 mt-3 max-w-sm">
        <span className="text-gray-500 text-sm italic flex-1 text-center">{getRoast(score, idx)}</span>
        <button
          onClick={() => setIdx(i => (i + 1) % total)}
          className="shrink-0 text-gray-600 hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-800"
          title="Next"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function BreakdownBar({ result }: { result: AnalysisResult }) {
  const { breakdown } = result
  const entries = [
    { label: t.barLineVol,    value: breakdown.lineVolume,    color: 'bg-emerald-600' },
    { label: t.barBurst,    value: breakdown.burstSignals,  color: 'bg-amber-500' },
    { label: t.barWindow,   value: breakdown.windowSpeed,   color: 'bg-orange-500' },
    { label: t.barFixFix,        value: breakdown.fixFix,        color: 'bg-yellow-500' },
    { label: t.barCoauthor,    value: breakdown.coauthored,    color: 'bg-purple-500' },
    { label: t.barRapid,  value: breakdown.rapidCommits,  color: 'bg-blue-500' },
    { label: t.barCI,    value: breakdown.ciFailures,    color: 'bg-red-500' },
  ].filter((e) => e.value > 0)

  const total = entries.reduce((s, e) => s + e.value, 0)
  if (total === 0) return null

  return (
    <div>
      <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-3">{t.scoreBreakdown}</h2>
      <div className="flex rounded-lg overflow-hidden h-4 mb-3">
        {entries.map((e) => (
          <div
            key={e.label}
            className={`${e.color} transition-all`}
            style={{ width: `${(e.value / total) * 100}%` }}
            title={`${e.label}: ${formatScore(e.value)} pts`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map((e) => (
          <div key={e.label} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2.5 h-2.5 rounded-sm inline-block ${e.color}`} />
            <span className="text-gray-500">{e.label}</span>
            <span className="text-gray-400 font-mono">{formatScore(e.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineChart({ timeline }: { timeline: AnalysisResult['timeline'] }) {
  if (timeline.length === 0) return null
  const maxCommits = Math.max(...timeline.map((t) => t.commits), 1)
  const shown = timeline.slice(-48)

  return (
    <div>
      <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-3">{t.commitTimeline}</h2>
      <div className="flex items-end gap-0.5 h-16">
        {shown.map((bucket) => {
          const height = Math.max(3, (bucket.commits / maxCommits) * 64)
          const hasSignal = bucket.score > 0
          // Parse: new format = Unix ms string; legacy = "YYYY-MM-DD HH:00"
          const ts = Number(bucket.hour)
          const d = !isNaN(ts) && ts > 1e10 ? new Date(ts) : null
          const localFull = d
            ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
            : bucket.hour
          const localDate = d
            ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : bucket.hour.split(' ')[0] ?? ''
          return (
            <div
              key={bucket.hour}
              className="flex-1 relative group cursor-default"
            >
              <div
                className={`w-full rounded-sm ${hasSignal ? 'bg-red-500' : 'bg-emerald-800'}`}
                style={{ height: `${height}px` }}
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 whitespace-nowrap bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded shadow-lg pointer-events-none">
                {localFull}<br />
                {bucket.commits} commit{bucket.commits !== 1 ? 's' : ''}
                {hasSignal && <><br />⚠️ {formatScore(bucket.score)} pts</>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-600 mt-1">
        <span>{(() => { const ts = Number(shown[0]?.hour); const d = !isNaN(ts) && ts > 1e10 ? new Date(ts) : null; return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : shown[0]?.hour.split(' ')[0] ?? '' })()}</span>
        <span>{(() => { const ts = Number(shown[shown.length-1]?.hour); const d = !isNaN(ts) && ts > 1e10 ? new Date(ts) : null; return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : shown[shown.length-1]?.hour.split(' ')[0] ?? '' })()}</span>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-gray-600">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-800 rounded-sm inline-block" /> Normal</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-500 rounded-sm inline-block" /> AI signals</span>
      </div>
    </div>
  )
}

const SIGNALS_PREVIEW = 5

function SignalList({ signals }: { signals: VibeSignal[] }) {
  const [expanded, setExpanded] = useState(false)
  if (signals.length === 0) return <p className="text-gray-600 text-sm">No suspicious signals detected.</p>

  const shown = expanded ? signals : signals.slice(0, SIGNALS_PREVIEW)
  const hidden = signals.length - SIGNALS_PREVIEW

  return (
    <div className="space-y-2">
      {shown.map((sig, i) => {
        const meta = SIGNAL_META[sig.type]
        return (
          <div key={i} className="flex items-start gap-3 bg-gray-800/50 rounded-lg p-3">
            <span className={`text-sm font-semibold shrink-0 min-w-[130px] ${meta.color}`}>
              {meta.label}
            </span>
            <span className="text-sm text-gray-400 flex-1 min-w-0 break-words">{sig.description}</span>
            {sig.commitSha && (
              <span className="text-xs text-gray-600 font-mono shrink-0">{sig.commitSha.slice(0, 7)}</span>
            )}
            <span className="text-xs font-bold text-amber-400 shrink-0">
              +{formatScore(sig.score)}
            </span>
          </div>
        )
      })}
      {signals.length > SIGNALS_PREVIEW && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-2 border border-gray-800 hover:border-gray-700 rounded-lg transition-colors"
        >
          {expanded
            ? '▲ Show less'
            : `▼ Show ${hidden} more signal${hidden > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  )
}

function RateLimitBanner({ error }: { error: RateLimitError }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const secondsLeft = Math.max(0, error.resetsAt * 1000 - now)
  const minutes = Math.floor(secondsLeft / 60000)
  const seconds = Math.floor((secondsLeft % 60000) / 1000)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <div className="text-6xl">⏳</div>
      <h2 className="text-2xl font-bold text-yellow-400">{t.rateLimitTitle}</h2>
      <p className="text-gray-400 text-center max-w-sm">{error.message}</p>
      {secondsLeft > 0 && (
        <div className="card text-center mt-2">
          <p className="text-gray-500 text-sm mb-1">{t.rateLimitResetsIn}</p>
          <p className="text-3xl font-bold tabular-nums text-yellow-400">
            {minutes}:{String(seconds).padStart(2, '0')}
          </p>
        </div>
      )}
      <Link to="/" className="btn-secondary mt-2">← Back</Link>
    </div>
  )
}

// ── EnrollButton ──────────────────────────────────────────────────────────────

const AI_PROVIDERS = [
  'GitHub Copilot',
  'ChatGPT / OpenAI',
  'Claude',
  'Cursor',
  'Gemini',
  'Windsurf',
  'Cline',
  'Aider',
  'Bolt.new',
  'v0 (Vercel)',
  'Devin',
  'Other',
]

const PROVIDER_ICONS: Record<string, string> = {
  'GitHub Copilot': '🤖', 'ChatGPT / OpenAI': '🟢', 'Claude': '🟠',
  'Cursor': '🔵', 'Gemini': '💎', 'Windsurf': '🏄', 'Cline': '🦊',
  'Aider': '🧙', 'Bolt.new': '⚡', 'v0 (Vercel)': '▲', 'Devin': '👾', 'Other': '✨',
}

const ENROLLED_KEY = 'vibecheck_enrolled' // localStorage: JSON array of "owner/repo"

function getEnrolledRepos(): string[] {
  try { return JSON.parse(localStorage.getItem(ENROLLED_KEY) ?? '[]') } catch { return [] }
}
function markEnrolled(fullRepo: string) {
  const list = getEnrolledRepos()
  if (!list.includes(fullRepo)) {
    localStorage.setItem(ENROLLED_KEY, JSON.stringify([...list, fullRepo]))
  }
}

function EnrollButton({ owner, repo, isPrivate, cached, tampered }: { owner: string; repo: string; isPrivate?: boolean; cached?: boolean; tampered?: boolean }) {
  const fullRepo = `${owner}/${repo}`
  const localEnrolled = getEnrolledRepos().includes(fullRepo)
  const [state, setState] = useState<'idle' | 'checking' | 'already' | 'choosing' | 'loading' | 'done' | 'error'>(
    localEnrolled ? 'already' : 'checking'
  )
  const [label, setLabel] = useState<string>('')
  const [errMsg, setErrMsg] = useState('')
  const [provider, setProvider] = useState<string>('')

  useEffect(() => {
    if (localEnrolled) return // already know from localStorage
    checkEnrolled(owner, repo).then(({ enrolled }) => {
      if (enrolled) {
        markEnrolled(fullRepo)
        setState('already')
      } else {
        setState('idle')
      }
    })
  }, [owner, repo])

  async function handleEnroll() {
    setState('loading')
    try {
      const result = await enrollRepo(owner, repo, provider || undefined)
      setLabel(result.label)
      markEnrolled(fullRepo)
      setState('done')
    } catch (err: any) {
      setErrMsg(err.message)
      setState('error')
    }
  }

  if (isPrivate) {
    return <p className="text-gray-600 text-sm text-center">{t.privateRepo}</p>
  }

  if (tampered) {
    return (
      <div className="text-center space-y-2 py-2">
        <p className="text-red-500 text-sm font-bold">⛔ 时间戳异常，禁止提交</p>
        <p className="text-gray-600 text-xs">你他妈是来捣乱的吧</p>
      </div>
    )
  }

  if (state === 'checking') {
    return <p className="text-gray-600 text-xs text-center animate-pulse">Checking enrollment…</p>
  }

  if (state === 'done') {
    return (
      <div className="text-center">
        <p className="text-emerald-400 font-semibold">✅ Submitted to {label} leaderboard!</p>
        {provider && <p className="text-gray-500 text-xs mt-1">{t.taggedAs} {PROVIDER_ICONS[provider]} {provider}</p>}
        <Link to="/leaderboard" className="text-emerald-600 hover:text-emerald-400 text-sm mt-1 block transition-colors">
          {t.viewLeaderboard}
        </Link>
      </div>
    )
  }

  if (state === 'already') {
    return (
      <div className="text-center space-y-2">
        <p className="text-emerald-600 text-sm">✅ {t.alreadySubmitted}</p>
        {cached ? (
          <p className="text-gray-600 text-xs">{t.resubmitHintCached}</p>
        ) : (
          <p className="text-gray-600 text-xs">{t.resubmitHint}</p>
        )}
        <div className="flex gap-2 justify-center">
          <Link to="/leaderboard" className="btn-secondary text-sm py-1 px-3">{t.viewLeaderboard}</Link>
          <button onClick={() => setState('choosing')} className="btn-primary text-sm py-1 px-3">
            {t.resubmit}
          </button>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="text-center">
        <p className="text-red-400 text-sm">{errMsg}</p>
        <button onClick={() => setState('idle')} className="text-gray-500 text-xs mt-1 hover:text-gray-300 transition-colors">{t.rateLimitRetry}</button>
      </div>
    )
  }

  if (state === 'choosing') {
    return (
      <div className="w-full max-w-xs mx-auto">
        <p className="text-gray-400 text-sm text-center mb-3">{t.whichAI}</p>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {AI_PROVIDERS.map(p => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`text-xs px-3 py-2 rounded-lg border transition-colors text-left ${
                provider === p
                  ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300'
                  : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
              }`}
            >
              {PROVIDER_ICONS[p]} {p}
            </button>
          ))}
        </div>
        <div className="flex gap-2 justify-center">
          <button onClick={() => setState(localEnrolled ? 'already' : 'idle')} className="text-gray-600 text-xs hover:text-gray-400">{t.cancelBtn}</button>
          <button
            onClick={handleEnroll}
            disabled={state === ('loading' as string)}
            className="btn-primary text-sm py-1.5 px-4"
          >
            {provider ? `${t.submitWithAI} ${PROVIDER_ICONS[provider]}` : t.submitNoTag}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center">
      <button
        onClick={() => setState('choosing')}
        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t.submitLeaderboard}
      </button>
      <p className="text-gray-600 text-xs mt-2">{t.publicOnly}</p>
    </div>
  )
}

// ── Main Result page ───────────────────────────────────────────────────────────

export default function Result() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [authRequired, setAuthRequired] = useState(false)
  const [rateLimitError, setRateLimitError] = useState<RateLimitError | null>(null)
  const [cached, setCached] = useState(false)
  const [copied, setCopied] = useState(false)
  const isLoggedIn = !!localStorage.getItem('vibecheck_session')
  const [username, setUsername] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (isLoggedIn) {
      import('../lib/api').then(({ getMe }) => {
        getMe().then(u => { if (u) setUsername(u.login) }).catch(() => {})
      })
    }
  }, [isLoggedIn])

  const load = useCallback((force = false) => {
    if (!owner || !repo) return

    setLoading(true)
    setError('')
    setAuthRequired(false)
    setRateLimitError(null)

    analyzeRepo(owner, repo, force)
      .then(({ data, cached: c }) => {
        setResult(data)
        setCached(c)

        // Save to recent
        const key = `${owner}/${repo}`
        const stored = localStorage.getItem('vibecheck_recent')
        let recent: Array<{ repo: string; score: number; analyzedAt: number }> = []
        try { recent = JSON.parse(stored ?? '[]') } catch {}
        recent = [
          { repo: key, score: data.score, analyzedAt: data.analyzedAt },
          ...recent.filter((r) => r.repo !== key),
        ].slice(0, 5)
        localStorage.setItem('vibecheck_recent', JSON.stringify(recent))
      })
      .catch((err) => {
        if (err instanceof AuthRequiredError) setAuthRequired(true)
        else if (err instanceof RateLimitError) setRateLimitError(err)
        else setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [owner, repo])

  useEffect(() => { load() }, [load])

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-4xl animate-spin">🔍</div>
        <p className="text-gray-400">
          {t.analyzing} <span className="text-emerald-400">{owner}/{repo}</span>…
        </p>
        <p className="text-gray-600 text-sm">{t.fetchingCommits}</p>
      </div>
    )
  }

  // ── Auth required ──────────────────────────────────────────────────────────
  if (authRequired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-6xl mb-2">🔐</div>
        <h2 className="text-2xl font-bold text-gray-100">{t.loginRequired}</h2>
        <p className="text-gray-400 text-center max-w-sm">
          {t.loginRequiredDesc}
        </p>
        <a href={getLoginUrl()} className="btn-primary mt-2">🐙 Login with GitHub</a>
        <Link to="/" className="text-gray-600 hover:text-gray-400 text-sm transition-colors">
          {t.back}
        </Link>
      </div>
    )
  }

  // ── Rate limit ─────────────────────────────────────────────────────────────
  if (rateLimitError) return <RateLimitBanner error={rateLimitError} />

  // ── Generic error ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-4xl">😬</div>
        <p className="text-red-400 font-semibold">{t.analysisFailed}</p>
        <p className="text-gray-500 text-sm text-center max-w-md">{error}</p>
        <div className="flex gap-3 mt-2">
          <button onClick={() => load(false)} className="btn-primary text-sm">Retry</button>
          <Link to="/" className="btn-secondary text-sm">← Back</Link>
        </div>
      </div>
    )
  }

  if (!result) return null

  const { emoji } = scoreLabel(result.score)

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      {/* Repo action bar */}
      <div className="border-b border-gray-800/60 px-4 sm:px-6 py-2 flex items-center justify-between bg-gray-950/80">
        <a
          href={`https://github.com/${owner}/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-300 text-xs transition-colors font-mono"
        >
          {owner}/{repo} ↗
        </a>
        <div className="flex items-center gap-1.5">
          {cached ? (
            <button
              onClick={() => load(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-yellow-600/50 bg-yellow-900/20 text-yellow-400 hover:bg-yellow-900/40 hover:border-yellow-500 transition-colors"
              title="Results are cached — click to re-analyze with latest commits"
            >
              <span>🔄</span>
              <span>{t.reanalyze}</span>
              <span className="text-yellow-600 ml-0.5">cached</span>
            </button>
          ) : (
            <button
              onClick={() => load(true)}
              className="btn-secondary text-xs py-1 px-2"
              title="Re-analyze (bypass cache)"
            >
              🔄
            </button>
          )}
          <button onClick={handleShare} className="btn-secondary text-xs py-1 px-2.5">
            {copied ? t.copied : t.share}
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 space-y-6">
        {/* Repo header */}
        <div className="text-center">
          <a
            href={`https://github.com/${owner}/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
          >
            🐙 {owner}/{repo} ↗
          </a>
          <p className="text-gray-600 text-xs mt-1">{result.commitCount} {t.commitsAnalyzed}</p>
        </div>

        {/* Tampering detection */}
        {result.oldestCommitAt && result.oldestCommitAt < new Date('2005-04-07T00:00:00Z').getTime() && (
          <div className="rounded-xl border border-red-800/60 bg-red-950/30 px-6 py-5 text-center">
            <p className="text-red-400 text-xl font-bold mb-2">⛔ 你他妈是来捣乱的吧</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              这个仓库有早于 <span className="text-gray-200 font-mono">2005-04-07</span> 的 commit 时间戳，
              比 git 本身的诞生日期还早。<br />
              Linus Torvalds 那天才写了第一个 git commit（<span className="font-mono text-gray-500">e83c5163</span>）。<br /><br />
              所以要么是时光机，要么你改了时间戳。我们选择相信不是时光机。<br />
              <span className="text-red-600 font-semibold">此仓库无法提交到排行榜。</span>
            </p>
          </div>
        )}

        {/* Score */}
        <div className="card">
          <ScoreDisplay score={result.score} />
        </div>

        {/* CTA for visitors not logged in */}
        {!isLoggedIn && (
          <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-emerald-300 font-semibold">{t.howVibeIsYours}</p>
              <p className="text-emerald-700 text-sm mt-0.5">{t.howVibeDesc}</p>
            </div>
            <a href={getLoginUrl()} className="btn-primary whitespace-nowrap shrink-0">
              🐙 Check My Repos →
            </a>
          </div>
        )}

        {/* Breakdown */}
        <div className="card">
          <BreakdownBar result={result} />
        </div>

        {/* Timeline */}
        <div className="card">
          <TimelineChart timeline={result.timeline} />
        </div>

        {/* Signals */}
        <div className="card">
          <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-4">
            {t.detectedSignals} ({result.signals.length})
          </h2>
          <SignalList signals={result.signals} />
        </div>

        {/* Badges */}
        <div className="card">
          <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-4">{t.badges}</h2>
          <BadgesPanel owner={owner!} repo={repo!} username={username} />
        </div>

        {/* Enroll */}
        <div className="card">
          <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-4">{t.leaderboardSection}</h2>
          <EnrollButton owner={owner!} repo={repo!} cached={cached} tampered={!!(result.oldestCommitAt && result.oldestCommitAt < new Date('2005-04-07T00:00:00Z').getTime())} />
        </div>

        {/* About */}
        <div className="card bg-gray-900/50">
          <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-3">{t.aboutScore}</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            {t.aboutScoreText}
          </p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { sig: t.sigCoAuthor,  pts: '+200/commit' },
              { sig: t.sigFixFix,    pts: '+50/pair' },
              { sig: t.sigCiFail,    pts: '+30/commit' },
              { sig: t.sigLineVol,   pts: '+0.05/line' },
            ].map((s) => (
              <div key={s.sig} className="bg-gray-800 rounded px-2 py-1.5 text-center">
                <div className="text-gray-300 font-semibold">{s.pts}</div>
                <div className="text-gray-500 mt-0.5">{s.sig}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <p className="text-gray-700 text-xs">
            {t.analyzedAt} {new Date(result.analyzedAt).toLocaleString()}
          </p>
        </div>
      </main>
    </div>
  )
}
