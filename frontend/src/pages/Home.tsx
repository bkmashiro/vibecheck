import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getMe, getMyRepos, getLoginUrl, type UserRepo } from '../lib/api'
import { t, lang, setLang, LANGS } from '../lib/i18n'

interface RecentAnalysis {
  repo: string
  score: number
  analyzedAt: number
}

function formatScore(score: number): string {
  if (score >= 1000) return `${(score / 1000).toFixed(1)}k`
  return Math.round(score).toString()
}

function scoreEmoji(score: number) {
  if (score >= 500) return '🤖'
  if (score >= 100) return '🤝'
  return '👨‍💻'
}

function RepoPicker({
  repos,
  onSelect,
}: {
  repos: UserRepo[]
  onSelect: (fullName: string) => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return repos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
    )
  }, [repos, query])

  return (
    <div className="w-full max-w-lg mt-8">
      <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-3">{t.yourRepos}</h2>
      <input
        className="input mb-3"
        placeholder={t.searchRepos}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-4">{t.noMatch}</p>
        )}
        {filtered.map((repo) => (
          <button
            key={repo.fullName}
            onClick={() => onSelect(repo.fullName)}
            className="w-full text-left flex items-center justify-between bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 rounded-lg px-4 py-2.5 transition-colors"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 text-sm font-semibold truncate">{repo.fullName}</span>
                {repo.private && (
                  <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
                    private
                  </span>
                )}
              </div>
              {repo.description && (
                <p className="text-gray-500 text-xs truncate mt-0.5">{repo.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3 ml-3 shrink-0 text-xs text-gray-500">
              {repo.language && <span>{repo.language}</span>}
              {repo.stars > 0 && <span>⭐ {repo.stars}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState('')
  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null)
  const [repos, setRepos] = useState<UserRepo[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [recent, setRecent] = useState<RecentAnalysis[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    // Load user
    getMe()
      .then((u) => {
        setUser(u)
        if (u) {
          // Load their repos
          setReposLoading(true)
          getMyRepos()
            .then(setRepos)
            .catch(console.error)
            .finally(() => setReposLoading(false))
        }
      })
      .catch(() => {})

    // Load recent from localStorage
    const stored = localStorage.getItem('vibecheck_recent')
    if (stored) {
      try { setRecent(JSON.parse(stored)) } catch {}
    }
  }, [])

  function navigateTo(fullName: string) {
    const parts = fullName.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '').split('/')
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      setInputError('Enter a repo like "owner/repo" or a GitHub URL')
      return
    }
    navigate(`/r/${parts[0]}/${parts[1]}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setInputError('')
    navigateTo(input.trim())
  }

  function handleLogout() {
    localStorage.removeItem('vibecheck_session')
    setUser(null)
    setRepos([])
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
          {/* Language switcher */}
          <div className="flex gap-1">
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`text-xs px-2 py-1 rounded transition-colors ${lang === l.code ? 'text-emerald-400 bg-gray-800' : 'text-gray-600 hover:text-gray-400'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <Link to="/leaderboard" className="text-gray-400 hover:text-gray-200 text-sm transition-colors">
            {t.leaderboard}
          </Link>
          {user ? (
            <div className="flex items-center gap-2">
              <img src={user.avatar_url} alt={user.login} className="w-7 h-7 rounded-full" />
              <span className="text-sm text-gray-300">{user.login}</span>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-1"
              >
                logout
              </button>
            </div>
          ) : (
            <a href={getLoginUrl()} className="btn-secondary text-sm py-1.5 px-3">
              {t.loginBtn}
            </a>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center px-4 py-14">
        <div className="text-center mb-10 max-w-2xl">
          <h1 className="text-5xl font-bold mb-4">
            <span className="text-emerald-400">Vibe</span>
            <span className="text-gray-100">Check</span>
          </h1>
          <p className="text-gray-400 text-lg whitespace-pre-line">
            {t.tagline}
          </p>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="w-full max-w-lg">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder={t.placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              {t.analyze}
            </button>
          </div>
          {inputError && <p className="text-red-400 text-sm mt-2">{inputError}</p>}
          {!user && (
            <p className="text-gray-600 text-xs mt-2 text-center">
              <a href={getLoginUrl()} className="text-emerald-600 hover:text-emerald-400 transition-colors">
                {t.loginBtn}
              </a>{' '}
              {t.loginPrompt.replace(t.loginBtn, '').trim()}
            </p>
          )}
        </form>

        {/* Repo picker (logged in) */}
        {user && (
          <div className="w-full max-w-lg">
            {reposLoading ? (
              <p className="text-gray-600 text-sm text-center mt-8">Loading your repos…</p>
            ) : repos.length > 0 ? (
              <RepoPicker repos={repos} onSelect={navigateTo} />
            ) : null}
          </div>
        )}

        {/* Recent analyses */}
        {recent.length > 0 && (
          <div className="mt-10 w-full max-w-lg">
            <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-3">{t.recentAnalyses}</h2>
            <div className="space-y-2">
              {recent.map((r) => (
                <Link
                  key={r.repo}
                  to={`/r/${r.repo}`}
                  className="flex items-center justify-between card hover:border-gray-600 transition-colors py-3"
                >
                  <span className="text-gray-300 text-sm">{r.repo}</span>
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    <span>{scoreEmoji(r.score)}</span>
                    <span className={r.score >= 500 ? 'text-red-400' : r.score >= 100 ? 'text-yellow-400' : 'text-emerald-400'}>
                      {formatScore(r.score)} pts
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Feature explainer */}
        {!user && (
          <div className="mt-14 max-w-2xl w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: '⚡', title: 'Burst Speed', desc: 'Commits with 500+ lines/min — impossible for humans' },
              { icon: '🔄', title: 'Rapid Fixes', desc: 'Fix-after-fix commits within minutes (+50 pts each)' },
              { icon: '🤝', title: 'Co-authorship', desc: 'Explicit AI co-author attribution (+200 pts)' },
            ].map((item) => (
              <div key={item.title} className="card text-center">
                <div className="text-3xl mb-2">{item.icon}</div>
                <h3 className="font-semibold text-gray-200 mb-1">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-gray-700 text-xs border-t border-gray-900 space-y-1">
        <div>VibeCheck — {t.builtWith}</div>
        <div className="flex items-center justify-center gap-3">
          <a
            href="https://github.com/bkmashiro"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
          >
            @bkmashiro
          </a>
          <span className="text-gray-800">·</span>
          <a
            href="https://github.com/bkmashiro/vibecheck"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
          >
            {t.source}
          </a>
        </div>
      </footer>
    </div>
  )
}
