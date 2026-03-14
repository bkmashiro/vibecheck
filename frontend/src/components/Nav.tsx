import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { t, lang, setLang, LANGS } from '../lib/i18n'
import { getMe, getLoginUrl } from '../lib/api'

export default function Nav() {
  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null)
  const location = useLocation()

  useEffect(() => {
    getMe().then(setUser).catch(() => {})
  }, [])

  function handleLogout() {
    localStorage.removeItem('vibecheck_session')
    setUser(null)
    window.location.reload()
  }

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <header className="border-b border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 bg-gray-950/95 backdrop-blur z-10">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
        <span className="text-xl">🔍</span>
        <span className="text-lg font-bold text-emerald-400">VibeCheck</span>
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Language switcher */}
        <div className="flex gap-0.5 mr-1">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                lang === l.code ? 'text-emerald-400 bg-gray-800' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <a
          href="https://github.com/bkmashiro/vibecheck"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 hover:text-gray-300 transition-colors text-sm"
          title="Source on GitHub"
        >
          <svg height="18" width="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
              0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
              -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
              .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
              -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27
              .68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
              .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
              0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </a>

        <Link
          to="/stats"
          className={`text-sm px-2 py-1 rounded transition-colors ${
            isActive('/stats') ? 'text-emerald-400 bg-gray-800' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {t.stats}
        </Link>

        <Link
          to="/leaderboard"
          className={`text-sm px-2 py-1 rounded transition-colors ${
            isActive('/leaderboard') ? 'text-emerald-400 bg-gray-800' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {t.leaderboard}
        </Link>

        {user ? (
          <div className="flex items-center gap-1.5 ml-1">
            <a
              href={`https://github.com/${user.login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              title={`@${user.login} on GitHub`}
            >
              <img
                src={user.avatar_url}
                alt={user.login}
                className="w-6 h-6 rounded-full ring-1 ring-gray-700 hover:ring-emerald-500 transition-all"
              />
              <span className="text-sm text-gray-300 hidden sm:inline">{user.login}</span>
            </a>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              {t.logout}
            </button>
          </div>
        ) : (
          <a href={getLoginUrl()} className="btn-secondary text-xs py-1 px-2.5 ml-1">
            {t.loginBtn}
          </a>
        )}
      </div>
    </header>
  )
}
