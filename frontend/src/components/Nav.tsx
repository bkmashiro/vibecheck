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
