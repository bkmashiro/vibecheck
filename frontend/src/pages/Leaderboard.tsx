import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLeaderboard, getVersions, type LeaderboardEntry, type ScoringVersion } from '../lib/api'

function formatScore(score: number): string {
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(2)}M`
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}k`
  return score.toFixed(1)
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 2000 ? 'text-red-400' : score >= 500 ? 'text-orange-400' : score >= 100 ? 'text-yellow-400' : 'text-emerald-400'
  const emoji = score >= 500 ? '🤖' : score >= 100 ? '🤝' : '👨‍💻'
  return (
    <span className={`font-bold tabular-nums ${color}`}>
      {emoji} {formatScore(score)}
    </span>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) return <span>🥇</span>
  if (rank === 1) return <span>🥈</span>
  if (rank === 2) return <span>🥉</span>
  return <span className="text-gray-500 font-mono text-sm">#{rank + 1}</span>
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [currentVersion, setCurrentVersion] = useState<ScoringVersion | null>(null)
  const [versions, setVersions] = useState<ScoringVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getVersions().then(setVersions).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    getLeaderboard(selectedVersion)
      .then(({ entries: e, version: v }) => {
        setEntries(e)
        setCurrentVersion(v)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedVersion])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors">
          <span>←</span>
          <span className="text-emerald-400 font-bold">VibeCheck</span>
        </Link>
        <h1 className="font-bold text-gray-200">🏆 Leaderboard</h1>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        {/* Title + version selector */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">Most Vibed Repos</h2>
            {currentVersion && (
              <p className="text-gray-500 text-sm mt-1">
                Scoring: <span className="text-emerald-400">{currentVersion.label}</span>
                {currentVersion.description && (
                  <span className="text-gray-600"> — {currentVersion.description}</span>
                )}
              </p>
            )}
          </div>

          {versions.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-sm">Version:</span>
              <select
                value={selectedVersion ?? currentVersion?.version ?? ''}
                onChange={(e) => setSelectedVersion(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    {v.label} ({v.version}){v.isCurrent ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading && (
          <div className="text-center py-20">
            <div className="text-3xl animate-spin inline-block">🔍</div>
            <p className="text-gray-500 mt-3">Loading leaderboard…</p>
          </div>
        )}

        {error && (
          <div className="card text-center py-10">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="card text-center py-16">
            <div className="text-5xl mb-4">🏜️</div>
            <p className="text-gray-400 mb-2">No repos enrolled yet.</p>
            <p className="text-gray-600 text-sm mb-6">
              Analyze a repo and hit "Submit to Leaderboard" to appear here.
            </p>
            <Link to="/" className="btn-primary inline-block">
              Analyze a repo →
            </Link>
          </div>
        )}

        {entries.length > 0 && (
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 w-12">Rank</th>
                  <th className="text-left px-4 py-3">Repo</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Top Signal</th>
                  <th className="text-right px-4 py-3">Score</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Commits</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const topSig = entry.signalsSummary?.[0]
                  return (
                    <tr
                      key={entry.repo}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-center">
                        <RankBadge rank={i} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/r/${entry.owner}/${entry.name}`}
                          className="text-emerald-400 hover:text-emerald-300 transition-colors text-sm font-semibold"
                        >
                          {entry.repo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {topSig ? (
                          <span className="text-gray-500 text-xs truncate max-w-[220px] block" title={topSig.description}>
                            {topSig.type.replace(/_/g, ' ')}: {topSig.description.slice(0, 50)}
                            {topSig.description.length > 50 ? '…' : ''}
                          </span>
                        ) : (
                          <span className="text-gray-700 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ScoreBadge score={entry.score} />
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="text-gray-600 text-xs tabular-nums">
                          {entry.commitCount?.toLocaleString() ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="text-gray-600 text-xs">
                          {new Date(entry.analyzedAt).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link to="/" className="btn-primary">Analyze a Repo →</Link>
        </div>
      </main>
    </div>
  )
}
