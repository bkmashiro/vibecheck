import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Nav from '../components/Nav'
import { analyzeRepo, AuthRequiredError, RateLimitError, getLoginUrl, type AnalysisResult } from '../lib/api'

function formatScore(score: number): string {
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(2)}M`
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}k`
  return score.toFixed(1)
}

function scoreLabel(score: number): { emoji: string; label: string; colorClass: string } {
  if (score >= 2000) return { emoji: '🤖', label: 'Pure Vibe', colorClass: 'text-red-400' }
  if (score >= 500) return { emoji: '🤖', label: 'Heavy AI', colorClass: 'text-orange-400' }
  if (score >= 100) return { emoji: '🤝', label: 'Mixed', colorClass: 'text-yellow-400' }
  return { emoji: '👨‍💻', label: 'Mostly Human', colorClass: 'text-emerald-400' }
}

type RepoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: AnalysisResult }
  | { status: 'error'; message: string; needsAuth?: boolean }

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span>{formatScore(value)}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function RepoCard({ repo, state, onAnalyze }: {
  repo: string
  state: RepoState
  onAnalyze: () => void
}) {
  const [owner, name] = repo.includes('/') ? repo.split('/') : ['', repo]

  return (
    <div className="flex-1 min-w-0 bg-gray-800/60 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate">{repo || '—'}</h3>
          {repo && (
            <Link to={`/r/${owner}/${name}`} className="text-emerald-400 hover:underline text-xs">
              Full analysis →
            </Link>
          )}
        </div>
        {repo && state.status !== 'loading' && (
          <button
            onClick={onAnalyze}
            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-gray-300 ml-2 shrink-0"
          >
            {state.status === 'idle' ? 'Analyze' : 'Refresh'}
          </button>
        )}
      </div>

      {state.status === 'idle' && repo && (
        <div className="text-center py-8 text-gray-600 text-sm">
          Click Analyze to load
        </div>
      )}

      {state.status === 'loading' && (
        <div className="text-center py-8 text-gray-500 text-sm animate-pulse">
          Analyzing…
        </div>
      )}

      {state.status === 'error' && (
        <div className="text-center py-8">
          <p className="text-red-400 text-sm">{state.message}</p>
          {state.needsAuth && (
            <a href={getLoginUrl()} className="mt-2 inline-block text-xs text-emerald-400 hover:underline">
              Login with GitHub →
            </a>
          )}
        </div>
      )}

      {state.status === 'done' && (() => {
        const { data } = state
        const { emoji, label, colorClass } = scoreLabel(data.score)
        const bd = data.breakdown
        const maxVal = Math.max(
          bd.lineVolume, bd.burstSignals, bd.windowSpeed,
          bd.fixFix, bd.coauthored, bd.rapidCommits, bd.ciFailures, 1
        )
        return (
          <div className="space-y-5">
            <div className="text-center">
              <div className="text-5xl mb-1">{emoji}</div>
              <div className={`text-4xl font-bold tabular-nums ${colorClass}`}>
                {formatScore(data.score)}
              </div>
              <div className="text-gray-500 text-sm">{label}</div>
              <div className="text-gray-600 text-xs mt-1">{data.commitCount} commits</div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Breakdown</p>
              <ScoreBar label="Line Volume" value={bd.lineVolume} max={maxVal} color="bg-emerald-600" />
              <ScoreBar label="Burst Speed" value={bd.burstSignals} max={maxVal} color="bg-amber-500" />
              <ScoreBar label="Window Speed" value={bd.windowSpeed} max={maxVal} color="bg-orange-500" />
              <ScoreBar label="Fix→Fix" value={bd.fixFix} max={maxVal} color="bg-yellow-500" />
              <ScoreBar label="AI Co-author" value={bd.coauthored} max={maxVal} color="bg-purple-500" />
              <ScoreBar label="Rapid Commits" value={bd.rapidCommits} max={maxVal} color="bg-blue-500" />
              <ScoreBar label="CI Failures" value={bd.ciFailures} max={maxVal} color="bg-red-500" />
            </div>
          </div>
        )
      })()}

      {!repo && (
        <div className="text-center py-8 text-gray-700 text-sm">
          Enter a repo above
        </div>
      )}
    </div>
  )
}

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [inputA, setInputA] = useState(searchParams.get('a') ?? '')
  const [inputB, setInputB] = useState(searchParams.get('b') ?? '')
  const [repoA, setRepoA] = useState(searchParams.get('a') ?? '')
  const [repoB, setRepoB] = useState(searchParams.get('b') ?? '')
  const [stateA, setStateA] = useState<RepoState>({ status: 'idle' })
  const [stateB, setStateB] = useState<RepoState>({ status: 'idle' })

  useEffect(() => {
    const params: Record<string, string> = {}
    if (repoA) params.a = repoA
    if (repoB) params.b = repoB
    setSearchParams(params, { replace: true })
  }, [repoA, repoB, setSearchParams])

  // Auto-analyze when repos are set from URL on mount
  useEffect(() => {
    if (repoA) analyze(repoA, setStateA)
    if (repoB) analyze(repoB, setStateB)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function analyze(repo: string, setState: React.Dispatch<React.SetStateAction<RepoState>>) {
    const [owner, name] = repo.split('/')
    if (!owner || !name) {
      setState({ status: 'error', message: 'Invalid format (use owner/repo)' })
      return
    }
    setState({ status: 'loading' })
    try {
      const { data } = await analyzeRepo(owner, name)
      setState({ status: 'done', data })
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        setState({ status: 'error', message: 'Login required to analyze', needsAuth: true })
      } else if (err instanceof RateLimitError) {
        setState({ status: 'error', message: 'GitHub rate limit reached. Try again later.' })
      } else {
        setState({ status: 'error', message: (err as Error).message ?? 'Analysis failed' })
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const a = inputA.trim().replace(/^https?:\/\/github\.com\//, '')
    const b = inputB.trim().replace(/^https?:\/\/github\.com\//, '')
    setRepoA(a)
    setRepoB(b)
    if (a) analyze(a, setStateA)
    if (b) analyze(b, setStateB)
  }

  // Winner determination
  const scoreA = stateA.status === 'done' ? stateA.data.score : null
  const scoreB = stateB.status === 'done' ? stateB.data.score : null
  const winner = scoreA !== null && scoreB !== null
    ? (scoreA > scoreB ? 'a' : scoreB > scoreA ? 'b' : 'tie')
    : null

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Compare Repos</h1>
          <p className="text-gray-400 text-sm">See which repo has more AI vibes side by side.</p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 mb-8">
          <input
            type="text"
            value={inputA}
            onChange={e => setInputA(e.target.value)}
            placeholder="owner/repo A"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            value={inputB}
            onChange={e => setInputB(e.target.value)}
            placeholder="owner/repo B"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="col-span-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Compare
          </button>
        </form>

        {winner && (
          <div className="mb-6 text-center">
            {winner === 'tie' ? (
              <p className="text-gray-400 text-sm">🤝 It's a tie!</p>
            ) : (
              <p className="text-sm">
                <span className="text-emerald-400 font-semibold">
                  {winner === 'a' ? repoA : repoB}
                </span>
                <span className="text-gray-400"> is more vibes (+{formatScore(Math.abs((scoreA ?? 0) - (scoreB ?? 0)))} pts)</span>
              </p>
            )}
          </div>
        )}

        <div className="flex gap-4">
          <RepoCard
            repo={repoA}
            state={stateA}
            onAnalyze={() => analyze(repoA, setStateA)}
          />
          <div className="flex items-center text-gray-600 font-bold text-xl shrink-0">VS</div>
          <RepoCard
            repo={repoB}
            state={stateB}
            onAnalyze={() => analyze(repoB, setStateB)}
          />
        </div>
      </main>
    </div>
  )
}
