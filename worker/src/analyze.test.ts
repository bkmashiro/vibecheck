import { describe, expect, it } from 'vitest'
import { analyzeVibe, type CommitData } from './analyze'

const minute = 60_000

function commit(
  n: number,
  overrides: Partial<CommitData> = {},
): CommitData {
  return {
    sha: `sha-${n}`,
    timestamp: Date.UTC(2026, 0, 1, 12, n),
    message: `change ${n}`,
    insertions: 12,
    deletions: 2,
    author: 'human',
    parentCount: 1,
    ...overrides,
  }
}

describe('Vibe Index v2', () => {
  it('returns a bounded empty result', () => {
    const result = analyzeVibe([])
    expect(result.score).toBe(0)
    expect(result.confidence).toBe(0)
    expect(result.energy).toBe(0)
    expect(result.algorithmVersion).toBe('v2')
  })

  it('does not reward repository size by itself', () => {
    const result = analyzeVibe([
      commit(0, { insertions: 50_000 }),
      commit(1, { timestamp: Date.UTC(2026, 0, 5), insertions: 10 }),
    ])
    expect(result.score).toBeLessThan(10)
    expect(result.breakdown.explicitAi).toBe(0)
  })

  it('treats known AI attribution as strong evidence', () => {
    const result = analyzeVibe([
      commit(0),
      commit(1, {
        message: 'feat: add parser\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
      }),
      commit(2, {
        message: 'fix: parser\n\nGenerated with Claude Code',
      }),
    ])
    expect(result.score).toBeGreaterThanOrEqual(50)
    expect(result.breakdown.explicitAi).toBeGreaterThan(0)
    expect(result.signals.some((signal) => signal.type === 'explicit_ai')).toBe(true)
  })

  it('does not mistake a human co-author trailer for AI attribution', () => {
    const result = analyzeVibe([
      commit(0),
      commit(1, {
        timestamp: Date.UTC(2026, 0, 2),
        message: 'feat: pair implementation\n\nCo-Authored-By: Ada Lovelace <ada@example.com>',
      }),
    ])
    expect(result.breakdown.explicitAi).toBe(0)
  })

  it('only forms repair chains for the same author', () => {
    const crossAuthor = analyzeVibe([
      commit(0, { message: 'fix: first', author: 'alice' }),
      commit(1, { message: 'fix: second', author: 'bob' }),
    ])
    const sameAuthor = analyzeVibe([
      commit(0, { message: 'fix: first', author: 'alice' }),
      commit(1, { message: 'fix: second', author: 'alice' }),
    ])
    expect(crossAuthor.breakdown.repairChains).toBe(0)
    expect(sameAuthor.breakdown.repairChains).toBeGreaterThan(0)
  })

  it('excludes merge commits from behavioral evidence', () => {
    const result = analyzeVibe([
      commit(0),
      commit(1, {
        parentCount: 2,
        insertions: 20_000,
        message: 'fix: merge generated branch\n\nGenerated with Claude Code',
      }),
    ])
    expect(result.sample.mergeCommitsExcluded).toBe(1)
    expect(result.breakdown.explicitAi).toBe(0)
    expect(result.score).toBe(0)
  })

  it('detects sustained same-author generation bursts without exceeding 100', () => {
    const commits = Array.from({ length: 8 }, (_, index) =>
      commit(index, {
        timestamp: Date.UTC(2026, 0, 1, 12, 0) + index * minute,
        insertions: index === 0 ? 10 : 900,
        author: 'alice',
      }),
    )
    const result = analyzeVibe(commits)
    expect(result.score).toBeGreaterThan(40)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.breakdown.burstSpeed).toBeGreaterThan(0)
    expect(result.breakdown.sessionDensity).toBeGreaterThan(0)
  })

  it('reports sample confidence separately from likelihood', () => {
    const small = analyzeVibe([commit(0)])
    const large = analyzeVibe(
      Array.from({ length: 40 }, (_, index) =>
        commit(index, {
          timestamp: Date.UTC(2026, 0, 1) + index * 24 * 60 * minute,
        }),
      ),
    )
    expect(small.score).toBe(0)
    expect(large.score).toBe(0)
    expect(large.confidence).toBeGreaterThan(small.confidence)
  })
})
