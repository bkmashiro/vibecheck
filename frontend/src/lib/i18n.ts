export type Lang = 'en' | 'zh' | 'ja'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中' },
  { code: 'ja', label: 'JP' },
]

function getLang(): Lang {
  const stored = localStorage.getItem('vibecheck_lang') as Lang | null
  if (stored && ['en', 'zh', 'ja'].includes(stored)) return stored
  const nav = navigator.language.toLowerCase()
  if (nav.startsWith('zh')) return 'zh'
  if (nav.startsWith('ja')) return 'ja'
  return 'en'
}

export function setLang(lang: Lang) {
  localStorage.setItem('vibecheck_lang', lang)
  window.location.reload()
}

export const lang: Lang = getLang()

// ── Roast / worship texts ─────────────────────────────────────────────────────

type RoastLevel = 'god' | 'heavy' | 'mixed' | 'human'

function getRoastLevel(score: number): RoastLevel {
  if (score >= 2000) return 'god'
  if (score >= 500)  return 'heavy'
  if (score >= 100)  return 'mixed'
  return 'human'
}

const roasts: Record<Lang, Record<RoastLevel, string[]>> = {
  en: {
    god: [
      "We are not worthy 🙇 The AI writes, you merely approve.",
      "GitHub Copilot calls YOU for help.",
      "Your commit history reads like a manifesto written by the machines.",
      "At this point, are you even IN the loop? 🤖",
    ],
    heavy: [
      "Impressive. Your AI does all the heavy lifting while you write the prompts.",
      "A strong AI collaboration. Or just vibing really hard.",
      "The diff doesn't lie. Neither does the typing speed.",
      "You didn't write code. You directed it.",
    ],
    mixed: [
      "A little AI, a little human. We respect the hustle. Barely.",
      "Half human, half robot — peak 2025 developer.",
      "You're using AI but at least you're pretending to code.",
      "The commit timestamps suggest some actual thinking happened. Suspicious.",
    ],
    human: [
      "Touching grass detected. Are you okay? 💀",
      "You actually typed all this?? In this economy??",
      "Rare specimen: human-coded repository. Almost extinct.",
      "Have you heard of ChatGPT? Just asking.",
      "This is painfully hand-crafted. Respect, but also, why?",
    ],
  },
  zh: {
    god: [
      "我等凡人不配 🙇 AI 在写代码，你只是在按 Tab。",
      "GitHub Copilot 反过来向你学习。",
      "你的 commit 记录就是机器写给未来的遗言。",
      "说实话，你还在 loop 里面吗？🤖",
    ],
    heavy: [
      "AI 干活，你出主意——这才是最优生产力配置。",
      "重度 vibe coding，不接受反驳。",
      "diff 不说谎，打字速度也不说谎。",
      "你没在写代码，你在指挥代码。",
    ],
    mixed: [
      "一半人工，一半智能，中庸之道。勉强及格。",
      "半人半机器，2025 年标准开发者形态。",
      "你有用 AI，但还在假装自己在写代码，我喜欢这种精神。",
      "commit 时间戳显示你可能真的有在思考。可疑。",
    ],
    human: [
      "检测到你在接触现实世界。你还好吗？💀",
      "这些都是你手打的？？在这个时代？？",
      "珍稀物种：纯人工仓库。已濒临灭绝。",
      "你听说过 ChatGPT 吗？随便问问。",
      "这代码写得太用心了。尊重，但是，为什么？",
    ],
  },
  ja: {
    god: [
      "我々には資格がありません 🙇 AIが書き、あなたはTabを押すだけ。",
      "GitHub CopilotがあなたにDMしてきます。",
      "このコミット履歴はAIによる遺言書です。",
      "正直、あなたはまだループの中にいますか？🤖",
    ],
    heavy: [
      "AIが重労働、あなたがプロンプト──最適な分業です。",
      "ヘビーなvibe coding、異論は認めません。",
      "diffは嘘をつかない。タイピング速度もね。",
      "コードを書いたのではなく、指揮しました。",
    ],
    mixed: [
      "半分人間、半分AI──ギリギリ合格点。",
      "2025年の標準的な開発者スタイルですね。",
      "AIを使いつつも、手で書いているふりをする精神、好きです。",
      "コミットのタイムスタンプを見ると、少し考えた形跡がある。怪しい。",
    ],
    human: [
      "現実世界との接触を検出。大丈夫ですか？💀",
      "これ全部手打ちしたんですか？？この時代に？？",
      "絶滅危惧種：手書きリポジトリ。",
      "ChatGPTをご存知ですか？ただ聞いてみただけです。",
      "丁寧すぎるコード。尊重はするけど……なぜ？",
    ],
  },
}

export function getRoast(score: number): string {
  const level = getRoastLevel(score)
  const options = roasts[lang][level]
  return options[Math.floor(Math.random() * options.length)]
}

// ── UI strings ────────────────────────────────────────────────────────────────

const ui = {
  en: {
    tagline: "Analyze any GitHub repo's commit history and detect AI-assisted \"vibe coding\" patterns.\nNo score cap — the bigger the vibe, the bigger the number.",
    placeholder: 'owner/repo or GitHub URL',
    analyze: 'Analyze →',
    loginPrompt: 'Login with GitHub to analyze repos',
    loginBtn: '🐙 Login with GitHub',
    leaderboard: '🏆 Leaderboard',
    logout: 'logout',
    yourRepos: 'Your Repos',
    searchRepos: 'Search repos…',
    noMatch: 'No repos match',
    recentAnalyses: 'Recent Analyses',
    builtWith: 'built with vibe coding 🤖',
    source: 'source',
    points: 'points',
    submitLeaderboard: '🏆 Submit to Leaderboard',
    submitting: 'Submitting…',
  },
  zh: {
    tagline: '分析任意 GitHub 仓库的 commit 历史，检测 AI 辅助的「Vibe Coding」痕迹。\n分数无上限——越 vibe，分越高。',
    placeholder: 'owner/repo 或 GitHub 链接',
    analyze: '分析 →',
    loginPrompt: '登录 GitHub 后才能分析仓库',
    loginBtn: '🐙 GitHub 登录',
    leaderboard: '🏆 排行榜',
    logout: '退出',
    yourRepos: '我的仓库',
    searchRepos: '搜索仓库…',
    noMatch: '没有匹配的仓库',
    recentAnalyses: '最近分析',
    builtWith: '用 vibe coding 构建 🤖',
    source: '源码',
    points: '分',
    submitLeaderboard: '🏆 提交到排行榜',
    submitting: '提交中…',
  },
  ja: {
    tagline: 'GitHubリポジトリのコミット履歴を分析し、AIアシストの「Vibe Coding」パターンを検出。\nスコア上限なし──vibeが大きいほど、数字も大きい。',
    placeholder: 'owner/repo または GitHub URL',
    analyze: '分析 →',
    loginPrompt: 'リポジトリを分析するにはGitHubでログインしてください',
    loginBtn: '🐙 GitHubでログイン',
    leaderboard: '🏆 ランキング',
    logout: 'ログアウト',
    yourRepos: 'マイリポジトリ',
    searchRepos: 'リポジトリを検索…',
    noMatch: '一致するリポジトリなし',
    recentAnalyses: '最近の分析',
    builtWith: 'vibe codingで構築 🤖',
    source: 'ソース',
    points: 'pts',
    submitLeaderboard: '🏆 ランキングに登録',
    submitting: '送信中…',
  },
}

export const t = ui[lang]
