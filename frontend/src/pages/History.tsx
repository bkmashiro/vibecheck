import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Nav from '../components/Nav'
import { getRepoHistory, AuthRequiredError, RateLimitError, getLoginUrl, type HistoryPoint } from '../lib/api'

function formatScore(score: number): string {
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(2)}M`
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}k`
  return score.toFixed(1)
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// Simple SVG line chart
function LineChart({ points }: { points: HistoryPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
        Not enough data points to draw a chart (need at least 2 pages of commits)
      </div>
    )
  }

  const W = 600
  const H = 220
  const PAD = { top: 16, right: 16, bottom: 40, left: 52 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const minScore = 0
  const maxScore = Math.max(...points.map(p => p.score), 1)
  const minTime = points[0].periodEnd
  const maxTime = points[points.length - 1].periodEnd

  function x(ts: number) {
    return PAD.left + ((ts - minTime) / (maxTime - minTime || 1)) * chartW
  }
  function y(score: number) {
    return PAD.top + chartH - ((score - minScore) / (maxScore - minScore || 1)) * chartH
  }

  const pathD = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${x(p.periodEnd).toFixed(1)},${y(p.score).toFixed(1)}`
  ).join(' ')

  const areaD = [
    `M${x(points[0].periodEnd).toFixed(1)},${(PAD.top + chartH).toFixed(1)}`,
    ...points.map(p => `L${x(p.periodEnd).toFixed(1)},${y(p.score).toFixed(1)}`),
    `L${x(points[points.length - 1].periodEnd).toFixed(1)},${(PAD.top + chartH).toFixed(1)}`,
    'Z',
  ].join(' ')

  // Y-axis ticks (4 ticks)
  const yTicks = [0, 0.33, 0.66, 1].map(f => minScore + f * (maxScore - minScore))

  // X-axis labels: up to 4 evenly spaced
  const xLabels = points.length <= 4
    ? points
    : [0, Math.floor(points.length / 3), Math.floor((2 * points.length) / 3), points.length - 1].map(i => points[i])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 260 }}>
      {/* Grid lines */}
      {yTicks.map((val, i) => (
        <g key={i}>
          <line
            x1={PAD.left} y1={y(val)}
            x2={PAD.left + chartW} y2={y(val)}
            stroke="#1f2937" strokeWidth="1"
          />
          <text
            x={PAD.left - 6} y={y(val) + 4}
            textAnchor="end" fontSize="10" fill="#6b7280"
          >
            {formatScore(val)}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaD} fill="url(#lineGradient)" opacity="0.3" />

      {/* Line */}
      <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />

      {/* Dots */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(p.periodEnd)} cy={y(p.score)}
          r="3.5" fill="#10b981" stroke="#064e3b" strokeWidth="1.5"
        />
      ))}

      {/* X-axis labels */}
      {xLabels.map((p, i) => (
        <text
          key={i}
          x={x(p.periodEnd)} y={H - 6}
          textAnchor="middle" fontSize="10" fill="#6b7280"
        >
          {formatDate(p.periodEnd)}
        </text>
      ))}

      {/* Gradient def */}
      <defs>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

type PageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; points: HistoryPoint[] }
  | { status: 'error'; message: string; needsAuth?: boolean }

export default function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [input, setInput] = useState(searchParams.get('repo') ?? '')
  const [repo, setRepo] = useState(searchParams.get('repo') ?? '')
  const [state, setState] = useState<PageState>({ status: 'idle' })

  useEffect(() => {
    if (repo) setSearchParams({ repo }, { replace: true })
  }, [repo, setSearchParams])

  useEffect(() => {
    if (repo) load(repo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load(r: string) {
    const parts = r.split('/')
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      setState({ status: 'error', message: 'Invalid format. Use owner/repo.' })
      return
    }
    const [owner, name] = parts
    setState({ status: 'loading' })
    try {
      const data = await getRepoHistory(owner, name)
      setState({ status: 'done', points: data.points })
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        setState({ status: 'error', message: 'Login required to load history', needsAuth: true })
      } else if (err instanceof RateLimitError) {
        setState({ status: 'error', message: 'GitHub rate limit reached. Try again later.' })
      } else {
        setState({ status: 'error', message: (err as Error).message ?? 'Failed to load history' })
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const r = input.trim().replace(/^https?:\/\/github\.com\//, '')
    setRepo(r)
    load(r)
  }

  const [owner, repoName] = repo.includes('/') ? repo.split('/') : ['', '']

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Score History</h1>
          <p className="text-gray-400 text-sm">
            Vibe score broken down by batches of 100 commits, showing how AI usage has changed over time.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="owner/repo or GitHub URL"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={state.status === 'loading'}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {state.status === 'loading' ? 'Loading…' : 'Load'}
          </button>
        </form>

        {state.status === 'error' && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-sm text-red-400 mb-6">
            {state.message}
            {state.needsAuth && (
              <a href={getLoginUrl()} className="block mt-2 text-emerald-400 hover:underline">
                Login with GitHub →
              </a>
            )}
          </div>
        )}

        {state.status === 'loading' && (
          <div className="text-center py-16 text-gray-500 animate-pulse">
            <p className="text-4xl mb-3">📈</p>
            <p>Fetching up to 500 commits…</p>
          </div>
        )}

        {state.status === 'done' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{owner}/{repoName}</h2>
                <Link to={`/r/${owner}/${repoName}`} className="text-emerald-400 hover:underline text-xs">
                  Full analysis →
                </Link>
              </div>
              <span className="text-gray-500 text-xs">{state.points.length} data point{state.points.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="bg-gray-800/60 rounded-xl p-4 mb-6">
              <LineChart points={state.points} />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Per-batch breakdown</p>
              {[...state.points].reverse().map((p, i) => {
                const score = p.score
                const colorClass = score >= 2000 ? 'text-red-400'
                  : score >= 500 ? 'text-orange-400'
                  : score >= 100 ? 'text-yellow-400'
                  : 'text-emerald-400'
                return (
                  <div key={i} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-2.5">
                    <div>
                      <p className="text-white text-sm">{formatDate(p.periodEnd)}</p>
                      <p className="text-gray-500 text-xs">{p.commitCount} commits</p>
                    </div>
                    <span className={`font-bold tabular-nums ${colorClass}`}>{formatScore(score)}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {state.status === 'idle' && (
          <div className="text-center py-16 text-gray-600">
            <p className="text-4xl mb-3">📈</p>
            <p>Enter a repo to view its score history</p>
          </div>
        )}
      </main>
    </div>
  )
}
