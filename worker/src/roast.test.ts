import { describe, expect, it, vi } from 'vitest'
import type { AnalysisResult } from './analyze'
import * as roast from './roast'

const analysis: AnalysisResult = {
  score: 82, confidence: 90, energy: 55, algorithmVersion: 'v2',
  signals: [], timeline: [], commitCount: 50, latestSha: 'abc123',
  analyzedAt: 1, oldestCommitAt: 0,
  breakdown: { explicitAi: 45, burstSpeed: 6, sessionDensity: 4, repairChains: 0, rapidCommits: 0 },
  sample: { eligibleCommits: 48, mergeCommitsExcluded: 2, timespanDays: 3 },
}

describe('roast policy', () => {
  it('keeps a safety buffer below the free allocation', () => {
    expect(roast.DAILY_BUDGET_MILLINEURONS).toBe(9_000_000)
    expect(roast.RESERVATION_MILLINEURONS).toBeGreaterThan(0)
  })

  it('selects fallback copy from the dominant evidence category', () => {
    const result = roast.selectTemplateRoast(analysis, 'zh')
    expect(result.source).toBe('template')
    expect(result.reason).toBe('daily_cap')
    expect(result.roast).toMatch(/署名|AI/)
  })

  it('does not call AI when the daily budget cannot be reserved', async () => {
    const runAi = vi.fn()
    const result = await roast.generateRoastWithFallback(
      { owner: 'o', repo: 'r', locale: 'en', analysis },
      { reserveBudget: async () => false, runAi },
    )
    expect(result.source).toBe('template')
    expect(result.reason).toBe('daily_cap')
    expect(runAi).not.toHaveBeenCalled()
  })

  it('falls back when the provider output is malformed', async () => {
    const result = await roast.generateRoastWithFallback(
      { owner: 'o', repo: 'r', locale: 'ja', analysis },
      { reserveBudget: async () => true, runAi: async () => ({ nope: true }) },
    )
    expect(result.source).toBe('unavailable')
    expect(result.reason).toBe('provider_error')
  })

  it('rejects AI-authorship and source-code claims', async () => {
    const result = await roast.generateRoastWithFallback(
      { owner: 'o', repo: 'r', locale: 'zh', analysis },
      { reserveBudget: async () => true, runAi: async () => ({ headline: '证据已经抓到了', roast: '这些代码显然是AI生成的。', punchlines: ['代码质量像随机数。'] }) },
    )
    expect(result).toMatchObject({ source: 'unavailable', reason: 'provider_error' })
  })

  it('returns validated AI copy when budget and provider succeed', async () => {
    const result = await roast.generateRoastWithFallback(
      { owner: 'o', repo: 'r', locale: 'zh', analysis },
      { reserveBudget: async () => true, runAi: async () => ({
        headline: '提交记录已经招供', roast: '提交节奏像给自动补全做绩效考核，休息时间完全没通过审批。',
        punchlines: ['修复链比需求链完整。'],
      }) },
    )
    expect(result).toMatchObject({ source: 'ai', reason: null, headline: '提交记录已经招供' })
  })

  it('changes the analysis hash when normalized evidence changes', async () => {
    const first = await roast.roastAnalysisHash(analysis)
    const second = await roast.roastAnalysisHash({ ...analysis, score: analysis.score - 1 })
    expect(first).toMatch(/^[a-f0-9]{16}$/)
    expect(second).not.toBe(first)
  })

  it('uses the model native prompt contract', () => {
    const payload = roast.buildRoastPrompt({ owner: 'o', repo: 'r', locale: 'zh', analysis })
    expect(payload.prompt).toContain('o/r')
    expect(payload.prompt.startsWith('/no_think')).toBe(true)
    expect(payload.max_tokens).toBe(300)
    expect(payload).not.toHaveProperty('messages')
  })

  it('accepts only the first complete JSON object from noisy provider output', () => {
    const first = JSON.stringify({ headline: 'History confessed', roast: 'The diff arrived before the plan existed.', punchline: 'Git remembers.' })
    const raw = { response: `\n${first}\nModel commentary that must be ignored {"headline":"second"}` }
    expect(roast.parseRoastCopy(raw)?.punchlines).toEqual(['Git remembers.'])
  })

  it('normalizes the provider singular punchline contract', () => {
    const raw = { response: JSON.stringify({
      headline: '提交记录先招了', roast: '这个仓库把自动补全当成了联合创始人。', punchline: 'Git 比你更清楚发生了什么。',
    }) }
    expect(roast.parseRoastCopy(raw)?.punchlines).toEqual(['Git 比你更清楚发生了什么。'])
  })

  it('parses Workers AI OpenAI-compatible choices', () => {
    const raw = { response: null, choices: [{ message: { content: JSON.stringify({
      headline: 'History confessed', roast: 'The diff arrived before the plan existed.',
      punchlines: ['Git remembers everything.'],
    }) } }] }
    expect(roast.parseRoastCopy(raw)?.headline).toBe('History confessed')
  })

  it('reserves budget with one capped atomic statement', async () => {
    const first = vi.fn().mockResolvedValue({ reserved_millineurons: 12_000 })
    const bind = vi.fn((..._args: unknown[]) => ({ first }))
    const prepare = vi.fn((_sql: string) => ({ bind }))
    const ok = await roast.reserveDailyBudget({ prepare } as any, '2026-07-30', 12_000)
    expect(ok).toBe(true)
    expect(prepare.mock.calls[0][0]).toContain('ON CONFLICT')
    expect(prepare.mock.calls[0][0]).toContain('RETURNING')
    expect(bind).toHaveBeenCalledWith('2026-07-30', 12_000, expect.any(Number), 12_000, 1, expect.any(Number), 12_000, 9_000_000)
  })
})
