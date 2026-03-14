import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLeaderboard, type LeaderboardEntry } from '../lib/api'

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-red-400' : score >= 40 ? 'text-yellow-400' : 'text-emerald-400'
  const emoji = score >= 70 ? '🤖' : score >= 40 ? '🤝' : '👨‍💻'
  return (
    <span className={`font-bold ${color}`}>
      {emoji} {score}%
    </span>
  )
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getLeaderboard()
      .then(setEntries)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

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
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-100">Most Vibed Repos</h2>
          <p className="text-gray-500 text-sm mt-1">Top 20 repos ranked by AI-assist score</p>
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
            <p className="text-gray-400">No repos analyzed yet.</p>
            <Link to="/" className="btn-primary mt-4 inline-block">Analyze a repo →</Link>
          </div>
        )}

        {entries.length > 0 && (
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Rank</th>
                  <th className="text-left px-4 py-3">Repo</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Top Signal</th>
                  <th className="text-right px-4 py-3">Score</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  return (
                    <tr key={entry.repo} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-mono text-sm">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/r/${entry.owner}/${entry.name}`}
                          className="text-emerald-400 hover:text-emerald-300 transition-colors text-sm font-semibold"
                        >
                          {entry.repo}
                        </Link>
                        {entry.commitCount != null && (
                          <span className="text-gray-600 text-xs ml-2">{entry.commitCount} commits</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-gray-500 text-xs truncate max-w-[200px] block">
                          {entry.topSignal ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ScoreBadge score={entry.score} />
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

        <div className="mt-6 text-center">
          <Link to="/" className="btn-primary">
            Analyze a Repo →
          </Link>
        </div>
      </main>
    </div>
  )
}
