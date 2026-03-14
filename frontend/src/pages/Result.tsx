import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { analyzeRepo, AuthRequiredError, getLoginUrl, type AnalysisResult, type VibeSignal } from '../lib/api'

const SIGNAL_LABELS: Record<VibeSignal['type'], string> = {
  burst_speed: '⚡ Burst Speed',
  window_speed: '📈 Window Speed',
  fix_fix: '🔄 Fix-Fix Pattern',
  coauthored: '🤝 AI Co-author',
  rapid_commits: '💨 Rapid Commits',
}

function ScoreRing({ score }: { score: number }) {
  const emoji = score >= 70 ? '🤖' : score >= 40 ? '🤝' : '👨‍💻'
  const color = score >= 70 ? 'text-red-400' : score >= 40 ? 'text-yellow-400' : 'text-emerald-400'
  const label = score >= 70 ? 'Heavy AI Assist' : score >= 40 ? 'Some AI Assist' : 'Mostly Human'

  return (
    <div className="flex flex-col items-center">
      <div className="text-8xl mb-2">{emoji}</div>
      <div className={`text-7xl font-bold ${color}`}>{score}%</div>
      <div className="text-gray-400 mt-2 text-lg">{label}</div>
    </div>
  )
}

function TimelineChart({ timeline }: { timeline: AnalysisResult['timeline'] }) {
  if (timeline.length === 0) return null

  const maxCommits = Math.max(...timeline.map((t) => t.commits), 1)

  // Show last 24 buckets max
  const shown = timeline.slice(-24)

  return (
    <div>
      <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-3">Commit Timeline</h2>
      <div className="flex items-end gap-1 h-20">
        {shown.map((bucket) => {
          const height = Math.max(4, (bucket.commits / maxCommits) * 80)
          const hasSignal = bucket.score > 0
          return (
            <div
              key={bucket.hour}
              className="flex-1 relative group cursor-default"
              title={`${bucket.hour}\n${bucket.commits} commits${hasSignal ? '\n⚠️ signals detected' : ''}`}
            >
              <div
                className={`w-full rounded-sm transition-all ${
                  hasSignal ? 'bg-red-500' : 'bg-emerald-700'
                }`}
                style={{ height: `${height}px` }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 whitespace-nowrap bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded shadow-lg">
                {bucket.hour.split(' ')[1] ?? bucket.hour}
                <br />
                {bucket.commits} commit{bucket.commits !== 1 ? 's' : ''}
                {hasSignal && <><br />⚠️ signals</>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-600 mt-1">
        <span>{shown[0]?.hour.split(' ')[0] ?? ''}</span>
        <span>{shown[shown.length - 1]?.hour.split(' ')[0] ?? ''}</span>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-gray-600">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-700 rounded-sm inline-block" /> Normal</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm inline-block" /> AI signals</span>
      </div>
    </div>
  )
}

function SignalList({ signals }: { signals: VibeSignal[] }) {
  if (signals.length === 0) return <p className="text-gray-600 text-sm">No suspicious signals detected.</p>

  return (
    <div className="space-y-2">
      {signals.map((sig, i) => (
        <div key={i} className="flex items-start gap-3 bg-gray-800/50 rounded-lg p-3">
          <span className="text-sm font-semibold text-gray-300 min-w-[140px]">
            {SIGNAL_LABELS[sig.type]}
          </span>
          <span className="text-sm text-gray-400 flex-1">{sig.description}</span>
          {sig.commitSha && (
            <span className="text-xs text-gray-600 font-mono">{sig.commitSha.slice(0, 7)}</span>
          )}
          <span className="text-xs font-bold text-amber-400">+{sig.score}</span>
        </div>
      ))}
    </div>
  )
}

export default function Result() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [authRequired, setAuthRequired] = useState(false)
  const [cached, setCached] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!owner || !repo) return

    setLoading(true)
    setError('')

    analyzeRepo(owner, repo)
      .then(({ data, cached: c }) => {
        setResult(data)
        setCached(c)

        // Save to recent
        const key = `${owner}/${repo}`
        const stored = localStorage.getItem('vibecheck_recent')
        let recent: Array<{ repo: string; score: number; analyzedAt: number }> = []
        try { recent = JSON.parse(stored ?? '[]') } catch {}
        recent = [{ repo: key, score: data.overallScore, analyzedAt: data.analyzedAt }, ...recent.filter((r) => r.repo !== key)].slice(0, 5)
        localStorage.setItem('vibecheck_recent', JSON.stringify(recent))
      })
      .catch((err) => {
        if (err instanceof AuthRequiredError) {
          setAuthRequired(true)
        } else {
          setError(err.message)
        }
      })
      .finally(() => setLoading(false))
  }, [owner, repo])

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-4xl animate-spin">🔍</div>
        <p className="text-gray-400">Analyzing <span className="text-emerald-400">{owner}/{repo}</span>…</p>
        <p className="text-gray-600 text-sm">Fetching up to 100 commits + diffs</p>
      </div>
    )
  }

  if (authRequired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-6xl mb-2">🔐</div>
        <h2 className="text-2xl font-bold text-gray-100">Login Required</h2>
        <p className="text-gray-400 text-center max-w-sm">
          You need to login with GitHub to analyze repos.
          This lets us fetch commit data on your behalf.
        </p>
        <a href={getLoginUrl()} className="btn-primary mt-2">
          🐙 Login with GitHub
        </a>
        <Link to="/" className="text-gray-600 hover:text-gray-400 text-sm transition-colors">
          ← Back to home
        </Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-4xl">😬</div>
        <p className="text-red-400 font-semibold">Analysis failed</p>
        <p className="text-gray-500 text-sm text-center max-w-md">{error}</p>
        <Link to="/" className="btn-secondary mt-2">← Back</Link>
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors">
          <span>←</span>
          <span className="text-emerald-400 font-bold">VibeCheck</span>
        </Link>
        <div className="flex items-center gap-2">
          {cached && <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded">cached</span>}
          <button onClick={handleShare} className="btn-secondary text-sm py-1.5">
            {copied ? '✅ Copied!' : '🔗 Share'}
          </button>
          <Link to="/leaderboard" className="btn-secondary text-sm py-1.5">🏆</Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 space-y-8">
        {/* Repo name */}
        <div className="text-center">
          <a
            href={`https://github.com/${owner}/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
          >
            🐙 {owner}/{repo} ↗
          </a>
          <p className="text-gray-600 text-xs mt-1">{result.commitCount} commits analyzed</p>
        </div>

        {/* Score */}
        <div className="card text-center py-10">
          <ScoreRing score={result.overallScore} />
        </div>

        {/* Timeline */}
        <div className="card">
          <TimelineChart timeline={result.timeline} />
        </div>

        {/* Signals */}
        <div className="card">
          <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-4">
            Detected Signals ({result.signals.length})
          </h2>
          <SignalList signals={result.signals} />
        </div>

        {/* What this means */}
        <div className="card bg-gray-900/50">
          <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-3">About the Score</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            The Vibe Score measures how much of the code was likely AI-assisted based on temporal patterns:
            commit speed, lines-per-minute, rapid fix cycles, and explicit AI co-author tags.
            A high score doesn't mean the code is bad — just that it was probably vibed into existence. 🤖
          </p>
        </div>

        <div className="text-center">
          <p className="text-gray-600 text-xs">
            Analyzed {new Date(result.analyzedAt).toLocaleString()}
          </p>
        </div>
      </main>
    </div>
  )
}
