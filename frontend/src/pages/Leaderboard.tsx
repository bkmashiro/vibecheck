import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'
import Nav from '../components/Nav'
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
      <Nav />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        {/* Title + version selector */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">{t.mostVibed}</h2>
            {currentVersion && (
              <p className="text-gray-500 text-sm mt-1">
                {t.scoringLabel} <span className="text-emerald-400">{currentVersion.label}</span>
                {currentVersion.description && (
                  <span className="text-gray-600"> — {currentVersion.description}</span>
                )}
              </p>
            )}
          </div>

          {versions.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-sm">{t.versionLabel}</span>
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
            <p className="text-gray-500 mt-3">{t.loadingLeaderboard}</p>
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
            <p className="text-gray-400 mb-2">{t.noEnrolled}</p>
            <p className="text-gray-600 text-sm mb-6">
              {t.noEnrolledDesc}
            </p>
            <Link to="/" className="btn-primary inline-block">
              {t.analyzeRepo}
            </Link>
          </div>
        )}

        {entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const topSig = entry.signalsSummary?.[0]
              return (
                <Link
                  key={entry.repo}
                  to={`/r/${entry.owner}/${entry.name}`}
                  className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl px-4 py-3.5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <div className="w-8 text-center shrink-0">
                      <RankBadge rank={i} />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-emerald-400 font-semibold text-sm">{entry.repo}</span>
                        {(entry as any).aiProvider && (
                          <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                            {(entry as any).aiProvider}
                          </span>
                        )}
                      </div>
                      {topSig && (
                        <p className="text-gray-600 text-xs mt-0.5 truncate" title={topSig.description}>
                          {topSig.type.replace(/_/g, ' ')}: {topSig.description}
                        </p>
                      )}
                    </div>

                    {/* Right side stats */}
                    <div className="text-right shrink-0 space-y-0.5">
                      <div><ScoreBadge score={entry.score} /></div>
                      <div className="flex gap-3 justify-end">
                        {entry.commitCount != null && (
                          <span className="text-gray-600 text-xs">{entry.commitCount.toLocaleString()} {t.commits}</span>
                        )}
                        <span className="text-gray-700 text-xs">
                          {new Date(entry.analyzedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link to="/" className="btn-primary">{t.analyzeRepo}</Link>
        </div>
      </main>
    </div>
  )
}
