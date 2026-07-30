import type { D1Database } from '@cloudflare/workers-types'
import type { AnalysisResult, ScoreBreakdown } from './analyze'

export type RoastLocale = 'en' | 'zh' | 'ja'
export type RoastSource = 'ai' | 'template'
export type RoastReason = 'daily_cap' | 'provider_error' | null
export type RoastCategory = keyof ScoreBreakdown | 'lowSignal'

export interface RoastCopy {
  headline: string
  roast: string
  punchlines: string[]
}

export interface RoastResult extends RoastCopy {
  source: RoastSource
  reason: RoastReason
  model: string | null
  generatedAt: number
}

export const DAILY_BUDGET_MILLINEURONS = 9_000_000
export const RESERVATION_MILLINEURONS = 12_000
export const ROAST_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8'
export const ROAST_PROMPT_VERSION = 'roast-v2'

const templates: Record<RoastLocale, Record<RoastCategory, RoastCopy>> = {
  en: {
    explicitAi: { headline: 'The commit history confessed first', roast: 'You did not merely use AI; you left attribution receipts like the model has joined payroll.', punchlines: ['The README may be human. The alibi is not.'] },
    burstSpeed: { headline: 'Your keyboard has plausible deniability', roast: 'That burst arrived faster than a human could review the diff, let alone understand it.', punchlines: ['Ship first, discover causality later.'] },
    sessionDensity: { headline: 'One session, several personalities', roast: 'The commit density looks less like careful iteration and more like autocomplete speed-running version control.', punchlines: ['Git became the undo history your editor deserved.'] },
    repairChains: { headline: 'The fix needed emotional support', roast: 'Each repair spawned another repair, a beautiful dependency graph made entirely of regret.', punchlines: ['The bug tracker is just the commit log wearing glasses.'] },
    rapidCommits: { headline: 'Commit early, commit every heartbeat', roast: 'The repository records every thought before it has time to become a decision.', punchlines: ['Atomic commits, molecular planning.'] },
    lowSignal: { headline: 'Suspiciously responsible behaviour', roast: 'The history contains too little AI-shaped chaos to convict anyone. Either you wrote it carefully or hid the evidence.', punchlines: ['Acquitted for lack of vibes.'] },
  },
  zh: {
    explicitAi: { headline: '提交记录已经先招了', roast: '你不是用了 AI，你是给模型办了入职，还把工牌挂在每条提交上。', punchlines: ['README 也许是人写的，不在场证明肯定不是。'] },
    burstSpeed: { headline: '键盘拥有充分不在场证明', roast: '这批提交来得比人类审完 diff 还快，更别提理解它。', punchlines: ['先上线，因果关系以后再补。'] },
    sessionDensity: { headline: '一个 session，几种人格', roast: '提交密度不像迭代，更像自动补全拿 Git 当撤销记录速通。', punchlines: ['原子级提交，分子级规划。'] },
    repairChains: { headline: '这个修复还需要情绪支持', roast: '每个修复都生出下一个修复，最后拼成了一张纯由后悔组成的依赖图。', punchlines: ['Bug tracker 只是戴了眼镜的 commit log。'] },
    rapidCommits: { headline: '每次心跳都值得一个 commit', roast: '每个念头还没来得及变成决定，就已经进入版本历史了。', punchlines: ['提交很原子，思考很量子。'] },
    lowSignal: { headline: '负责任得十分可疑', roast: '历史里找不到足够的 AI 型混乱。要么你认真写了，要么你很会销毁证据。', punchlines: ['因 vibe 证据不足，当庭释放。'] },
  },
  ja: {
    explicitAi: { headline: 'コミット履歴が先に自白した', roast: 'AIを使ったというより、モデルを入社させて全コミットに社員証を付けている。', punchlines: ['READMEは人間作かもしれない。アリバイは違う。'] },
    burstSpeed: { headline: 'キーボードには完璧なアリバイがある', roast: '人間がdiffを読むより先にコミットが届いた。理解する時間など最初から存在しない。', punchlines: ['まず出荷、因果関係はあとで検証。'] },
    sessionDensity: { headline: '一つのsession、複数の人格', roast: '反復開発というより、補完AIがGitをUndo履歴として高速消費している。', punchlines: ['コミットはatomic、計画はsubatomic。'] },
    repairChains: { headline: 'その修正には心のケアが必要', roast: '修正が次の修正を生み、後悔だけでできた依存グラフが完成した。', punchlines: ['Issue trackerは眼鏡をかけたcommit log。'] },
    rapidCommits: { headline: '鼓動ごとにcommit', roast: '思いつきが判断になる前に、すでに履歴へ永久保存されている。', punchlines: ['細かいcommit、粗い計画。'] },
    lowSignal: { headline: '責任感がありすぎて怪しい', roast: 'AIらしい混乱が足りない。丁寧に書いたか、証拠隠滅が上手いかのどちらかだ。', punchlines: ['vibe証拠不十分で無罪。'] },
  },
}

export function dominantCategory(analysis: AnalysisResult): RoastCategory {
  const entries = Object.entries(analysis.breakdown) as Array<[keyof ScoreBreakdown, number]>
  const [category, value] = entries.sort((a, b) => b[1] - a[1])[0] ?? ['explicitAi', 0]
  return value > 0 ? category : 'lowSignal'
}

export async function roastAnalysisHash(analysis: AnalysisResult): Promise<string> {
  const normalized = JSON.stringify({
    algorithmVersion: analysis.algorithmVersion,
    latestSha: analysis.latestSha,
    score: analysis.score,
    confidence: analysis.confidence,
    sample: analysis.sample,
    breakdown: analysis.breakdown,
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  return [...new Uint8Array(digest)].slice(0, 8).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function selectTemplateRoast(analysis: AnalysisResult, locale: RoastLocale): RoastResult {
  return {
    ...templates[locale][dominantCategory(analysis)],
    source: 'template', reason: 'daily_cap', model: null, generatedAt: Date.now(),
  }
}

function cleanText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text.length >= min && text.length <= max ? text : null
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) return text.slice(start, i + 1)
  }
  return null
}

export function parseRoastCopy(raw: unknown): RoastCopy | null {
  let value = raw
  if (raw && typeof raw === 'object') {
    const envelope = raw as { response?: unknown; choices?: Array<{ message?: { content?: unknown } }> }
    if (envelope.response != null) value = envelope.response
    else if (envelope.choices?.[0]?.message?.content != null) value = envelope.choices[0].message.content
  }
  if (typeof value === 'string') {
    const text = value.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
    const firstObject = extractFirstJsonObject(text)
    if (!firstObject) return null
    try { value = JSON.parse(firstObject) } catch { return null }
  }
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  const headline = cleanText(candidate.headline, 4, 100)
  const roast = cleanText(candidate.roast, 10, 320)
  const rawPunchlines = Array.isArray(candidate.punchlines) ? candidate.punchlines : [candidate.punchline]
  const punchlines = rawPunchlines
    .map((line) => cleanText(line, 4, 160))
    .filter((line): line is string => Boolean(line))
    .slice(0, 3)
  return headline && roast && punchlines.length ? { headline, roast, punchlines } : null
}

export interface RoastInput {
  owner: string
  repo: string
  locale: RoastLocale
  analysis: AnalysisResult
}

function isEvidenceGrounded(copy: RoastCopy): boolean {
  const text = [copy.headline, copy.roast, ...copy.punchlines].join(' ')
  const forbidden = [
    /\b(?:code|source code|implementation)\b/i,
    /代码|源码|コード|ソースコード/,
    /\bAI[- ]generated\b/i,
    /\b(?:written|generated|coded)\s+by\s+(?:an?\s+)?AI\b/i,
    /AI\s*(?:生成|写|寫)(?:的|了)?/i,
    /AI(?:が|によって)(?:書|生成)/,
  ]
  return !forbidden.some((pattern) => pattern.test(text))
}

export async function reserveDailyBudget(
  db: D1Database,
  usageDate: string,
  millineurons = RESERVATION_MILLINEURONS,
): Promise<boolean> {
  if (millineurons <= 0 || millineurons > DAILY_BUDGET_MILLINEURONS) return false
  const now = Date.now()
  const row = await db.prepare(`
    INSERT INTO llm_daily_budget (usage_date, reserved_millineurons, request_count, updated_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(usage_date) DO UPDATE SET
      reserved_millineurons = llm_daily_budget.reserved_millineurons + ?,
      request_count = llm_daily_budget.request_count + ?,
      updated_at = ?
    WHERE llm_daily_budget.reserved_millineurons + ? <= ?
    RETURNING reserved_millineurons
  `).bind(usageDate, millineurons, now, millineurons, 1, now, millineurons, DAILY_BUDGET_MILLINEURONS)
    .first<{ reserved_millineurons: number }>()
  return Boolean(row)
}

export function utcUsageDate(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export async function generateRoastWithFallback(
  input: RoastInput,
  deps: {
    reserveBudget: (millineurons: number) => Promise<boolean>
    runAi: (input: RoastInput) => Promise<unknown>
  },
): Promise<RoastResult> {
  const fallback = selectTemplateRoast(input.analysis, input.locale)
  if (!await deps.reserveBudget(RESERVATION_MILLINEURONS)) return fallback
  try {
    const raw = await deps.runAi(input)
    const copy = parseRoastCopy(raw)
    if (copy && !isEvidenceGrounded(copy)) {
      console.error('Workers AI roast rejected by evidence-grounding gate.')
      return { ...fallback, reason: 'provider_error' }
    }
    if (!copy) {
      const envelope = raw as { response?: unknown; choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown; reasoning_content?: unknown } }> }
      const choice = envelope?.choices?.[0]
      const response = typeof envelope?.response === 'string' ? envelope.response : ''
      console.error('Workers AI roast invalid output metadata:', JSON.stringify({
        responseType: typeof envelope?.response,
        responseLength: response.length || null,
        startsWithBrace: response.trimStart().startsWith('{'),
        endsWithBrace: response.trimEnd().endsWith('}'),
        containsThink: response.includes('<think>'),
        containsHeadline: response.includes('headline'),
        contentType: typeof choice?.message?.content,
        contentLength: typeof choice?.message?.content === 'string' ? choice.message.content.length : null,
        reasoningLength: typeof choice?.message?.reasoning_content === 'string' ? choice.message.reasoning_content.length : null,
        finishReason: choice?.finish_reason ?? null,
      }))
      return { ...fallback, reason: 'provider_error' }
    }
    return { ...copy, source: 'ai', reason: null, model: ROAST_MODEL, generatedAt: Date.now() }
  } catch (error) {
    console.error('Workers AI roast failed:', error instanceof Error ? error.message : String(error))
    return { ...fallback, reason: 'provider_error' }
  }
}

export function buildRoastPrompt(input: RoastInput) {
  const language = input.locale === 'zh' ? 'Simplified Chinese' : input.locale === 'ja' ? 'Japanese' : 'English'
  const facts = {
    repository: `${input.owner}/${input.repo}`,
    vibeIndex: input.analysis.score,
    confidence: input.analysis.confidence,
    sample: input.analysis.sample,
    breakdown: input.analysis.breakdown,
    dominantEvidence: dominantCategory(input.analysis),
  }
  const instruction = `Write a sharp, funny repository-history review in ${language}. Attack only commit cadence and repository engineering behaviour, never identity or protected traits. Never discuss source code or code quality. Do not claim the score proves AI authorship. Use only supplied facts. Return a short headline, one concise roast sentence, and exactly one string field named punchline. Output only JSON matching the supplied schema.`
  return {
    prompt: `/no_think\n${instruction}\nFACTS: ${JSON.stringify(facts)}`,
    max_tokens: 300,
    temperature: 0.9,
    response_format: {
      type: 'json_schema',
      json_schema: {
        type: 'object', additionalProperties: false,
        properties: {
          headline: { type: 'string', minLength: 4, maxLength: 50 },
          roast: { type: 'string', minLength: 10, maxLength: 140 },
          punchline: { type: 'string', minLength: 4, maxLength: 80 },
        },
        required: ['headline', 'roast', 'punchline'],
      },
    },
  }
}
