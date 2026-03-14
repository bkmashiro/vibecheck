<div align="center">

# 🔍 VibeCheck

**Does your commit history pass the vibe check?**

*Analyze any GitHub repo and find out how much of it was actually written by a human.*

**[中文](./README.zh.md) | [日本語](./README.ja.md)**

[![Vibe Score](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/repo/bkmashiro/vibecheck)](https://git-vibe.pages.dev/r/bkmashiro/vibecheck)
[![Vibe Rank](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/rank/bkmashiro/vibecheck)](https://git-vibe.pages.dev/r/bkmashiro/vibecheck)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

### **[→ git-vibe.pages.dev](https://git-vibe.pages.dev)**

</div>

---

## What is this?

You know how some repos have 47 commits, each one adding 800 lines in under 2 minutes, with commit messages like `feat: implement complete authentication system with JWT, refresh tokens, rate limiting, and comprehensive error handling`?

VibeCheck detects that.

It analyzes commit history for signals that no human programmer can produce — burst speeds that exceed physical typing limits, suspicious fix-fix-fix chains, co-authorship tags, and more. Then it gives you a score. The higher the score, the more AI was involved.

**No score cap.** A truly vibed-out monorepo can hit 10,000+. This is intentional. It's a leaderboard, not a pass/fail.

---

## Signals

| Signal | Points | Why |
|--------|--------|-----|
| 🚀 Burst > 500 lines/min | +40 / commit | Physically impossible for humans |
| ⚡ Burst > 200 lines/min | +20 / commit | Extremely fast for any human |
| 🌊 30-min window > 300 lines/min | +30 / window | Sustained AI-speed output |
| ⏩ Large commit in < 2 min | +15 | No time to think |
| 🔁 Fix → Fix in < 10 min | +50 / pair | Classic AI debugging loop |
| 🤝 `Co-Authored-By:` in message | +200 / commit | You forgot to scrub it |
| 💥 CI failure keywords | +30 / commit | `fix:`, `hotfix:`, `revert:` etc. |
| 📏 Line volume | × 0.05 / line | Raw size matters |

---

## Leaderboard

Who's the most vibed? Find out at **[git-vibe.pages.dev/leaderboard](https://git-vibe.pages.dev/leaderboard)**.

Submit your repo after analysis and see where you rank globally. Tag which AI you used most — the **Provider Wars** chart shows which tools produce the most vibe per commit.

---

## Put a badge in your README

After analyzing your repo at VibeCheck, you get ready-to-copy badge markdown.

Or grab it directly:

```markdown
[![Vibe Score](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/repo/OWNER/REPO)](https://git-vibe.pages.dev/r/OWNER/REPO)
[![Vibe Rank](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/rank/OWNER/REPO)](https://git-vibe.pages.dev/r/OWNER/REPO)
```

Personal badge (your highest-ranked repo):

```markdown
[![Top Vibe Repo](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/user/YOUR_GITHUB_USERNAME)](https://git-vibe.pages.dev)
```

---

## How it works

Single GitHub GraphQL request fetches 100 most recent commits with timestamps and line counts. No server-side GitHub token — all analysis runs with **your** OAuth token. Your token never leaves Cloudflare's edge.

Full algorithm breakdown → [HOW_IT_WORKS.md](./HOW_IT_WORKS.md)

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + Tailwind → Cloudflare Pages |
| Backend | Hono on Cloudflare Workers |
| Cache | Cloudflare KV (24h TTL) |
| Leaderboard | Cloudflare D1 (SQLite) |
| Auth | GitHub OAuth App |
| Data | GitHub GraphQL API |

---

## Contributing

The scoring algorithm is intentionally simple — and almost certainly wrong in interesting ways.

**Signals we haven't implemented yet:**
- Commit message AI-pattern detection (too-perfect grammar, over-structured bullet points)
- Commit message length distribution (AI tends to write longer messages)
- Author consistency tracking (does the human and AI alternate?)
- Per-file-type signal weighting
- Detection of squash commits hiding vibe sessions

**Open questions:**
- Should deletions count? Refactoring 10k lines into 100 lines might be *more* human than AI
- Should merge commits be excluded?
- How to handle repos where AI wrote the scaffold but humans maintain it?

PRs welcome. The algorithm lives in [`worker/src/analyze.ts`](./worker/src/analyze.ts).

---

## Wait — is vibing actually bad?

**Short answer:** It depends on the *understand* : *generate* ratio.

VibeCheck measures *process*, not quality. A 5,000-point repo might be a masterpiece where the author deeply understood every AI-generated line. It might also be an undebuggable pile of plausible-sounding nonsense.

We can't tell the difference. That's intentional.

The badge is a conversation starter, not a verdict. The real question isn't *"did you use AI?"* — it's *"do you know what's in your codebase?"*

---

## Other Languages

- [中文](./README.zh.md)
- [日本語](./README.ja.md)

---

## License

MIT

---

<div align="center">

*Built with vibe coding 🤖 — yes, the irony is intentional.*

*[Try it](https://git-vibe.pages.dev) · [Leaderboard](https://git-vibe.pages.dev/leaderboard) · [Stats](https://git-vibe.pages.dev/stats)*

</div>
