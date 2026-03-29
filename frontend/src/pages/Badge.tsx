import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Nav from '../components/Nav'
import { API_URL } from '../lib/api'

type BadgeInfo = {
  key: string
  label: string
  endpointPath: string
  linkUrl: string
  description: string
}

function BadgeCard({ badge, copied, onCopy }: {
  badge: BadgeInfo
  copied: string | null
  onCopy: (key: string, text: string) => void
}) {
  const endpoint = `${API_URL}${badge.endpointPath}`
  const shieldsUrl = `https://img.shields.io/endpoint?url=${encodeURIComponent(endpoint)}`
  const markdown = `[![${badge.label}](${shieldsUrl})](${badge.linkUrl})`
  const html = `<a href="${badge.linkUrl}"><img src="${shieldsUrl}" alt="${badge.label}" /></a>`

  return (
    <div className="bg-gray-800/60 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium">{badge.label}</h3>
          <p className="text-gray-500 text-sm mt-0.5">{badge.description}</p>
        </div>
        <img
          src={shieldsUrl}
          alt={badge.label}
          className="h-6 ml-4 shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
        />
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-gray-500 text-xs mb-1 uppercase tracking-wide">Markdown</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-gray-400 bg-gray-900 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap block">
              {markdown}
            </code>
            <button
              onClick={() => onCopy(`${badge.key}_md`, markdown)}
              className="shrink-0 text-xs px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-gray-300"
            >
              {copied === `${badge.key}_md` ? '✅' : '📋'}
            </button>
          </div>
        </div>

        <div>
          <p className="text-gray-500 text-xs mb-1 uppercase tracking-wide">HTML</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-gray-400 bg-gray-900 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap block">
              {html}
            </code>
            <button
              onClick={() => onCopy(`${badge.key}_html`, html)}
              className="shrink-0 text-xs px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-gray-300"
            >
              {copied === `${badge.key}_html` ? '✅' : '📋'}
            </button>
          </div>
        </div>

        <div>
          <p className="text-gray-500 text-xs mb-1 uppercase tracking-wide">Direct URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-gray-400 bg-gray-900 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap block">
              {shieldsUrl}
            </code>
            <button
              onClick={() => onCopy(`${badge.key}_url`, shieldsUrl)}
              className="shrink-0 text-xs px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-gray-300"
            >
              {copied === `${badge.key}_url` ? '✅' : '📋'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BadgePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [input, setInput] = useState(searchParams.get('repo') ?? '')
  const [repo, setRepo] = useState(searchParams.get('repo') ?? '')
  const [copied, setCopied] = useState<string | null>(null)

  const owner = repo.includes('/') ? repo.split('/')[0] : ''
  const repoName = repo.includes('/') ? repo.split('/').slice(1).join('/') : ''
  const valid = Boolean(owner && repoName)

  useEffect(() => {
    if (repo) setSearchParams({ repo }, { replace: true })
  }, [repo, setSearchParams])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim().replace(/^https?:\/\/github\.com\//, '')
    setRepo(trimmed)
  }

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const siteBase = 'https://git-vibe.pages.dev'

  const badges: BadgeInfo[] = valid ? [
    {
      key: 'score',
      label: 'Vibe Score',
      endpointPath: `/badge/repo/${owner}/${repoName}`,
      linkUrl: `${siteBase}/r/${owner}/${repoName}`,
      description: 'Shows the repo\'s vibe score (grey if not enrolled)',
    },
    {
      key: 'rank',
      label: 'Global Rank',
      endpointPath: `/badge/rank/${owner}/${repoName}`,
      linkUrl: `${siteBase}/r/${owner}/${repoName}`,
      description: 'Shows the repo\'s rank on the global leaderboard',
    },
  ] : []

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Badge Generator</h1>
          <p className="text-gray-400 text-sm">
            Generate shields.io badges to embed in your README.
            The repo must be{' '}
            <Link to="/leaderboard" className="text-emerald-400 hover:underline">enrolled in the leaderboard</Link>
            {' '}for badges to show a score.
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
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Generate
          </button>
        </form>

        {valid && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{owner}/{repoName}</h2>
                <Link
                  to={`/r/${owner}/${repoName}`}
                  className="text-emerald-400 hover:underline text-sm"
                >
                  View analysis →
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              {badges.map(b => (
                <BadgeCard key={b.key} badge={b} copied={copied} onCopy={copy} />
              ))}
            </div>

            <div className="mt-6 bg-gray-800/40 rounded-xl p-4 text-sm text-gray-400">
              <p className="font-medium text-gray-300 mb-1">How to use</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Analyze your repo on the <Link to="/" className="text-emerald-400 hover:underline">home page</Link></li>
                <li>Enroll it in the leaderboard</li>
                <li>Copy a badge above and paste into your README</li>
              </ol>
            </div>
          </>
        )}

        {!valid && (
          <div className="text-center py-16 text-gray-600">
            <p className="text-4xl mb-3">🏷️</p>
            <p>Enter a repo to generate badges</p>
          </div>
        )}
      </main>
    </div>
  )
}
