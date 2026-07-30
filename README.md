<div align="center">

# 🔍 VibeCheck

**Does your commit history pass the vibe check?**

*Compare repositories using auditable AI-assistance signals from Git history.*

**[中文](./README.zh.md) | [日本語](./README.ja.md)**

[![Vibe Score](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/repo/bkmashiro/vibecheck)](https://git-vibe.pages.dev/r/bkmashiro/vibecheck)
[![Vibe Rank](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/rank/bkmashiro/vibecheck)](https://git-vibe.pages.dev/r/bkmashiro/vibecheck)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

### **[🚀 Get Started — git-vibe.pages.dev](https://git-vibe.pages.dev)**

> No install. No API key. Just paste a repo URL and go.

</div>

---

## What is this?

VibeCheck compares repositories using **auditable Git commit metadata**. Vibe Index v2 is normalized to **0–100**, so a large monorepo no longer wins simply by adding more lines.

It separates explicit evidence—such as a known AI identity in a commit trailer—from weaker same-author timing patterns. Merge commits are excluded, evidence categories are capped, and sample confidence is reported separately.

This is a heuristic and conversation starter, not proof of authorship or a code-quality score.

---

## Signals

| Signal | Evidence points | Category cap |
|---|---:|---:|
| Explicit AI attribution | +18 / commit | 45 |
| Same-author burst speed | +3 / +5 / +8 | 25 |
| Rapid commit after previous same-author commit | +4 | 10 |
| Same-author repair chain | +5 | 10 |
| Sustained dense session | +4 / +8 | 20 |

Raw evidence is transformed through a saturating curve into the 0–100 index. Full details: [HOW_IT_WORKS.md](./HOW_IT_WORKS.md).

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

VibeCheck measures *process signals*, not quality. An 85-point repository might be a masterpiece whose author understood every AI-generated line, or an undebuggable pile of plausible-sounding nonsense.

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
