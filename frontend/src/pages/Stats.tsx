import Nav from '../components/Nav'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_URL } from '../lib/api'

interface StatsData {
  version: string
  label: string
  summary: { total: number; avg: number; max: number } | null
  providers: { ai_provider: string; count: number; avg_score: number }[]
  scores: number[]
}

const PROVIDER_ICONS: Record<string, string> = {
  'GitHub Copilot': '🤖',
  'ChatGPT / OpenAI': '🟢',
  'Claude': '🟠',
  'Cursor': '🔵',
  'Gemini': '💎',
  'Windsurf': '🏄',
  'Cline': '🦊',
  'Aider': '🧙',
  'Bolt.new': '⚡',
  'v0 (Vercel)': '▲',
  'Devin': '👾',
  'Other': '✨',
}

function formatScore(score: number) {
  if (score >= 1000000) return `${(score / 1000000).toFixed(1)}M`
  if (score >= 1000) return `${(score / 1000).toFixed(1)}k`
  return Math.round(score).toString()
}

function BarChart({ data, maxVal, color }: {
  data: { label: string; value: number; icon?: string }[]
  maxVal: number
  color: string
}) {
  return (
    <div className="space-y-2">
      {data.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <div className="w-32 text-xs text-gray-400 text-right truncate shrink-0">
            {item.icon} {item.label}
          </div>
          <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
            <div
              className={`h-full ${color} rounded-full transition-all duration-700 flex items-center justify-end pr-2`}
              style={{ width: `${Math.max(2, (item.value / maxVal) * 100)}%` }}
            >
              <span className="text-xs font-mono text-white/80">{formatScore(item.value)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Histogram({ scores }: { scores: number[] }) {
  if (!scores.length) return <p className="text-gray-600 text-sm">No data yet.</p>

  // Log-scale buckets — unbounded score, extend to absurdity
  const buckets = [
    { label: '0–10',   min: 0,       max: 10 },
    { label: '10–100', min: 10,      max: 100 },
    { label: '100–500',min: 100,     max: 500 },
    { label: '500–2k', min: 500,     max: 2000 },
    { label: '2k–5k',  min: 2000,    max: 5000 },
    { label: '5k–20k', min: 5000,    max: 20000 },
    { label: '20k–100k', min: 20000, max: 100000 },
    { label: '100k–1M', min: 100000, max: 1000000 },
    { label: '1M+ 🤖', min: 1000000, max: Infinity },
  ]

  const counts = buckets.map(b => ({
    label: b.label,
    count: scores.filter(s => s >= b.min && s < b.max).length,
  }))
  const maxCount = Math.max(...counts.map(b => b.count), 1)

  return (
    <div className="flex items-end gap-2">
      {counts.map(b => {
        const barH = Math.max(2, (b.count / maxCount) * 96)
        return (
          <div key={b.label} className="flex-1 flex flex-col items-center" style={{ height: '120px' }}>
            {/* fixed-height bar area */}
            <div className="w-full flex items-end justify-center" style={{ height: '96px', flexShrink: 0 }}>
              <div
                className="relative w-full bg-emerald-600/70 hover:bg-emerald-500/70 rounded-t transition-colors flex items-start justify-center"
                style={{ height: `${barH}px` }}
                title={`${b.count} repos`}
              >
                {b.count > 0 && barH > 14 && (
                  <span className="text-white/70 text-xs leading-none mt-1">{b.count}</span>
                )}
              </div>
            </div>
            {/* fixed-height label area */}
            <div className="text-gray-600 text-xs text-center leading-tight mt-1" style={{ height: '24px' }}>
              {b.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DonutChart({ data }: { data: { label: string; count: number; icon?: string }[] }) {
  if (!data.length) return <p className="text-gray-600 text-sm">No data yet.</p>

  const total = data.reduce((s, d) => s + d.count, 0)
  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#6366f1', '#14b8a6', '#a855f7']

  let cumulative = 0
  const segments = data.map((d, i) => {
    const pct = d.count / total
    const start = cumulative
    cumulative += pct
    return { ...d, pct, start, color: COLORS[i % COLORS.length] }
  })

  const r = 40
  const cx = 50
  const cy = 50

  function polarToCart(pct: number) {
    const angle = pct * 2 * Math.PI - Math.PI / 2
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-32 h-32 shrink-0">
        {segments.map((seg, i) => {
          const start = polarToCart(seg.start)
          const end = polarToCart(seg.start + seg.pct)
          const large = seg.pct > 0.5 ? 1 : 0
          return (
            <path
              key={i}
              d={`M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`}
              fill={seg.color}
              opacity={0.85}
            />
          )
        })}
        <circle cx={cx} cy={cy} r={22} fill="#030712" />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill="#9ca3af" fontSize="8">
          {total} repos
        </text>
      </svg>
      <div className="space-y-1 min-w-0">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-gray-400 truncate">{seg.icon} {seg.label}</span>
            <span className="text-gray-600 ml-auto shrink-0">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Stats() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/stats`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-10">
        {loading && <p className="text-gray-500 text-center py-20">Loading stats…</p>}
        {!loading && !data && <p className="text-gray-500 text-center py-20">No data yet.</p>}

        {data && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Global Stats</h1>
              <p className="text-gray-500 text-sm mt-1">Algorithm version: <span className="text-emerald-400">{data.label}</span></p>
            </div>

            {/* Summary cards */}
            {data.summary && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Repos Ranked', value: data.summary.total.toString(), icon: '📊' },
                  { label: 'Avg Score', value: formatScore(data.summary.avg ?? 0), icon: '📈' },
                  { label: 'All-Time High', value: formatScore(data.summary.max ?? 0), icon: '🏆' },
                ].map(card => (
                  <div key={card.label} className="card text-center">
                    <div className="text-3xl mb-1">{card.icon}</div>
                    <div className="text-2xl font-bold text-emerald-400">{card.value}</div>
                    <div className="text-gray-500 text-xs mt-1">{card.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Score distribution */}
            <div className="card">
              <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-4">Score Distribution</h2>
              <Histogram scores={data.scores} />
            </div>

            {/* AI Provider wars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-4">Provider Wars — Count</h2>
                <DonutChart
                  data={data.providers.map(p => ({
                    label: p.ai_provider,
                    count: p.count,
                    icon: PROVIDER_ICONS[p.ai_provider] ?? '🤖',
                  }))}
                />
              </div>

              <div className="card">
                <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-4">Provider Wars — Avg Score</h2>
                {data.providers.length > 0 ? (
                  <BarChart
                    data={data.providers.map(p => ({
                      label: p.ai_provider,
                      value: p.avg_score,
                      icon: PROVIDER_ICONS[p.ai_provider] ?? '🤖',
                    }))}
                    maxVal={Math.max(...data.providers.map(p => p.avg_score), 1)}
                    color="bg-amber-500"
                  />
                ) : (
                  <p className="text-gray-600 text-sm">No provider data yet.</p>
                )}
              </div>
            </div>

            {/* Who is most vibe by provider */}
            {data.providers.length > 0 && (
              <div className="card">
                <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-4">
                  Provider Leaderboard
                </h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-600 text-xs uppercase border-b border-gray-800">
                      <th className="text-left py-2">Provider</th>
                      <th className="text-right py-2">Repos</th>
                      <th className="text-right py-2">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.providers.map((p, i) => (
                      <tr key={p.ai_provider} className="border-b border-gray-900/50">
                        <td className="py-2 text-gray-300">
                          <span className="mr-2">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                          {PROVIDER_ICONS[p.ai_provider] ?? '🤖'} {p.ai_provider}
                        </td>
                        <td className="py-2 text-right text-gray-500">{p.count}</td>
                        <td className="py-2 text-right text-emerald-400 font-mono">{formatScore(p.avg_score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
