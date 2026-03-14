import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getMe, getLoginUrl } from '../lib/api'

interface RecentAnalysis {
  repo: string
  score: number
  analyzedAt: number
}

export default function Home() {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null)
  const [recent, setRecent] = useState<RecentAnalysis[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    getMe().then(setUser).catch(() => {})
    const stored = localStorage.getItem('vibecheck_recent')
    if (stored) {
      try {
        setRecent(JSON.parse(stored))
      } catch {}
    }
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Parse "owner/repo" or full GitHub URL
    let repo = input.trim()
    repo = repo.replace(/^https?:\/\/github\.com\//, '')
    repo = repo.replace(/\.git$/, '').replace(/\/$/, '')

    const parts = repo.split('/')
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      setError('Enter a repo like "owner/repo" or a GitHub URL')
      return
    }

    navigate(`/r/${parts[0]}/${parts[1]}`)
  }

  function handleLogout() {
    localStorage.removeItem('vibecheck_session')
    setUser(null)
  }

  function getScoreEmoji(score: number) {
    if (score >= 70) return '🤖'
    if (score >= 40) return '🤝'
    return '👨‍💻'
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔍</span>
          <span className="text-xl font-bold text-emerald-400">VibeCheck</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/leaderboard" className="text-gray-400 hover:text-gray-200 text-sm transition-colors">
            🏆 Leaderboard
          </Link>
          {user ? (
            <div className="flex items-center gap-2">
              <img src={user.avatar_url} alt={user.login} className="w-7 h-7 rounded-full" />
              <span className="text-sm text-gray-300">{user.login}</span>
              <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-1">
                logout
              </button>
            </div>
          ) : (
            <a href={getLoginUrl()} className="btn-secondary text-sm py-1.5 px-3">
              <span>🐙 Login with GitHub</span>
            </a>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center mb-10 max-w-2xl">
          <h1 className="text-5xl font-bold mb-4">
            <span className="text-emerald-400">Vibe</span>
            <span className="text-gray-100">Check</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Analyze any GitHub repo's commit history and detect AI-assisted "vibe coding" patterns.
            Get a <span className="text-emerald-400">Vibe Score</span> from 0–100%.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-lg">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="owner/repo or GitHub URL"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              Analyze →
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <p className="text-gray-600 text-xs mt-2 text-center">
            GitHub login required to analyze repos — your token is never stored on our end
          </p>
        </form>

        {/* Recent */}
        {recent.length > 0 && (
          <div className="mt-12 w-full max-w-lg">
            <h2 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Recent Analyses</h2>
            <div className="space-y-2">
              {recent.map((r) => (
                <Link
                  key={r.repo}
                  to={`/r/${r.repo}`}
                  className="flex items-center justify-between card hover:border-gray-600 transition-colors py-3"
                >
                  <span className="text-gray-300 text-sm">{r.repo}</span>
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    <span>{getScoreEmoji(r.score)}</span>
                    <span className={r.score >= 70 ? 'text-red-400' : r.score >= 40 ? 'text-yellow-400' : 'text-emerald-400'}>
                      {r.score}%
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Explainer */}
        <div className="mt-16 max-w-2xl w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: '⚡', title: 'Burst Speed', desc: 'Commits with 500+ lines/min — impossible for humans' },
            { icon: '🔄', title: 'Rapid Fixes', desc: 'Fix-after-fix commits within minutes' },
            { icon: '🤝', title: 'Co-authorship', desc: 'Explicit AI co-author attributions in commits' },
          ].map((item) => (
            <div key={item.title} className="card text-center">
              <div className="text-3xl mb-2">{item.icon}</div>
              <h3 className="font-semibold text-gray-200 mb-1">{item.title}</h3>
              <p className="text-gray-500 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-6 text-gray-700 text-xs border-t border-gray-900">
        VibeCheck — built with vibe coding 🤖
      </footer>
    </div>
  )
}
