# VibeCheck 🔍

> **How AI is your codebase, really?**
>
> You say you wrote it. Your commits say otherwise.

VibeCheck analyzes your git commit history and detects the unmistakable fingerprints of AI-assisted coding — superhuman typing speeds, suspiciously perfect commit bursts, fix-fix-fix chains that no human debugs that fast, and the telltale `Co-Authored-By: Claude` you forgot to scrub.

**[→ Try it at git-vibe.pages.dev](https://git-vibe.pages.dev)**

---

## Badges

Show off your vibe score (or shame) in your repo's README:

### Repo Vibe Score
```markdown
[![Vibe Score](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/repo/OWNER/REPO)](https://git-vibe.pages.dev/r/OWNER/REPO)
```

### Repo Global Rank
```markdown
[![Vibe Rank](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/rank/OWNER/REPO)](https://git-vibe.pages.dev/r/OWNER/REPO)
```

### Your Most Vibe Repo (User Badge)
```markdown
[![Top Vibe Repo](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/user/YOUR_GITHUB_USERNAME)](https://git-vibe.pages.dev)
```

**Example** (this very repo):

[![Vibe Score](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/repo/bkmashiro/vibecheck)](https://git-vibe.pages.dev/r/bkmashiro/vibecheck)
[![Vibe Rank](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/rank/bkmashiro/vibecheck)](https://git-vibe.pages.dev/r/bkmashiro/vibecheck)

---

## How It Works

See [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) for the full algorithm breakdown.

**TL;DR:** Humans type at most ~50 lines/minute when coding (including thinking time). AI outputs 500–2000 lines/minute. VibeCheck measures your commit history against this physical limit.

Signals detected:
| Signal | Points |
|--------|--------|
| Burst speed > 500 lines/min | +40 per commit |
| Burst speed > 200 lines/min | +20 per commit |
| 30-minute window > 300 lines/min | +30 per window |
| Rapid commit < 2 min with 30+ lines | +15 per commit |
| fix→fix pattern within 10 min | +50 per pair |
| `Co-Authored-By:` in message | +200 per commit |
| CI failure keywords in message | +30 per commit |
| Total lines added | ×0.05 each |

Score is **unbounded** — there is no maximum. The leaderboard is a competition.

---

## Stack

- **Frontend**: React + Vite + Tailwind CSS → Cloudflare Pages
- **Backend**: Hono on Cloudflare Workers
- **Storage**: Cloudflare KV (analysis cache) + D1 SQLite (leaderboard)
- **Auth**: GitHub OAuth App
- **Data**: GitHub GraphQL API (100 commits in 1 request)

---

## Contributing

The scoring algorithm is deliberately simple — and almost certainly wrong in interesting ways. Some ideas to improve it:

**Better signal detection:**
- Detect commit message AI patterns (suspiciously perfect grammar, over-formatted bullet points)
- Measure commit message length distribution (AI tends to write longer messages)
- Track author consistency (did a human and AI alternate?)
- Weight signals differently by file type (generated code vs. handwritten)
- Detect squash commits that hide vibe sessions

**Algorithm improvements:**
- Train a small classifier on labeled repos (known AI vs. known human)
- Use commit message embeddings to cluster vibe vs. non-vibe sessions
- Factor in time-of-day patterns (3am commits are suspicious)
- Cross-reference CI pass rate with commit velocity

**Calibration:**
- The current thresholds (500 lines/min = AI) are rough estimates
- Collect ground truth data and tune them properly
- Different languages have different natural commit sizes (Rust vs Python vs generated JSON)

**Open questions:**
- Should deletions count? Refactoring 10,000 lines to 100 is arguably more human than AI
- Should merge commits be excluded?
- How to handle repos where AI generated the initial scaffold but humans maintained it?

PRs welcome. If you have a better scoring idea, open an issue or just implement it — the algorithm lives in [`worker/src/analyze.ts`](./worker/src/analyze.ts).

---

## Wait, Is All This Vibe Actually Good?

No. And yes. But mostly: it depends, and that's the point.

**The case against vibe coding:**

AI-generated code is fast to produce and slow to understand. When you vibe a 500-line module into existence in 4 minutes, you often don't fully grasp what you shipped. This creates:

- **Maintenance debt**: Code you didn't write is code you have to re-learn every time you touch it
- **Bug blindness**: LLMs confidently generate plausible-but-wrong implementations, and fast output makes it easy to miss them before they're in production
- **Skill atrophy**: Delegation is fine; permanent dependency is not. There's evidence that heavy AI assistance impairs the development of debugging intuition and system design judgment
- **Security risk**: AI models don't know your threat model. They'll generate functional code that's insecure by default if you didn't ask about security

**The case for vibe coding:**

Speed is a real competitive advantage. A small team that ships 10× faster than a well-staffed competitor wins — if the code works well enough. AI coding tools have genuinely compressed the gap between "I have an idea" and "it runs in production."

Used well, they handle boilerplate, scaffold structure, suggest patterns you hadn't considered, and catch trivial bugs. The developer is still the architect.

**The actual concern:**

The problem isn't using AI — it's the ratio of *generation* to *comprehension*. VibeCheck's high scores correlate with speed, not understanding. A repo that scores 5000 pts might be a technical marvel built by someone who deeply understood every line the AI produced. It might also be a pile of AI output that its author can't debug.

VibeCheck can't tell the difference. That's intentional — we're measuring the *process*, not the quality. The badge is a conversation starter, not a verdict.

The real question isn't "did you use AI?" It's "do you know what's in your codebase?"

---

## License

MIT

---

*Built with vibe coding 🤖 — yes, the irony is intentional.*
