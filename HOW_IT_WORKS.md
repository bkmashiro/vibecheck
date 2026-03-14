# How VibeCheck Works

## The Core Insight

Humans have a physical typing speed limit. Even the fastest programmers, when accounting for reading, thinking, and context-switching, realistically produce around **20–50 lines of code per minute** during a focused coding session.

AI language models have no such limit. They output **500–2000+ lines per minute**, bounded only by network latency and token budgets.

When you commit 400 lines of code 3 minutes after your last commit, the math doesn't add up for a human typist. That's the core signal VibeCheck looks for.

---

## Data Collection

VibeCheck uses the GitHub **GraphQL API** to fetch commit history in a single request:

```graphql
query($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 100, after: $cursor) {
            nodes {
              oid
              committedDate
              message
              additions
              deletions
              author { name email }
            }
            pageInfo { endCursor hasNextPage }
          }
        }
      }
    }
  }
}
```

This returns up to 100 commits with their timestamps and line counts in **one API call**, avoiding the N+1 problem of the REST API (which requires a separate request per commit for diff stats).

Results are cached in Cloudflare KV with a 24-hour TTL, keyed by `{owner}/{repo}:{latest_sha}`. Repeated analyses of the same commit SHA are free.

---

## Signal Detection

Each commit is compared against the previous commit in chronological order. The time delta Δt and line additions are the primary inputs.

### Signal 1: Instant Burst Speed

```
speed = commit.additions / Δt (lines per minute)
```

| Speed | Score | Rationale |
|-------|-------|-----------|
| > 500 lines/min | +40 pts | Physically impossible for humans |
| > 200 lines/min | +20 pts | Highly improbable sustained rate |
| > 100 lines/min | +10 pts | Suspicious, even for fast typists |

A human typing at 100 WPM (elite typist) produces roughly 500 characters per minute. A line of code averages ~30–50 characters. That's about 10–17 lines/minute of raw typing — and real coding involves far more reading than typing.

### Signal 2: Rapid Small Commits

```
if Δt < 2 min AND additions > 30 lines → +15 pts
```

A < 2 minute turnaround with 30+ new lines suggests a prompt → generate → commit loop rather than a human writing and reviewing.

### Signal 3: Fix-Fix Pattern

```
if prev.message contains "fix" AND curr.message contains "fix" AND Δt < 10 min → +50 pts
```

A fix immediately followed by another fix within 10 minutes is a classic AI debugging pattern: the AI generates a fix, it doesn't work, you prompt again, it generates another fix. Humans tend to investigate more before committing a second fix attempt.

### Signal 4: Co-Authored-By

```
if message contains "co-authored-by" → +200 pts
```

Explicit AI attribution in the commit message. Some tools (GitHub Copilot, various Claude integrations) automatically add this. Some developers add it manually for transparency. Either way, it's a direct signal.

### Signal 5: CI Failure Keywords

```
if message matches /fix ci|fix build|fix test|fix workflow/i → +30 pts
```

Repeated CI failures repaired via commit suggest the code was generated without running locally — a common pattern when you're prompting an AI that can't execute your test suite.

### Signal 6: 30-Minute Sliding Window

```
window_lines = sum of additions for all commits in [t-30min, t]
window_speed = window_lines / 30 (lines per minute)

if window_speed > 300 AND window has ≥ 3 commits → +30 pts
```

Sustained high output over a 30-minute window. A single burst commit might be a large file addition; sustained bursts across multiple commits suggest an ongoing AI session.

### Signal 7: Line Volume

```
score += total_additions * 0.05
```

A flat multiplier on total lines added. This rewards repos with large amounts of AI-generated content, even if the per-commit signals are individually moderate. It means a 10,000-line vibe session scores higher than a 200-line one, even if the per-minute speed was identical.

---

## Score Formula

```
score = Σ(burst_signals)
      + Σ(window_signals)
      + Σ(rapid_commit_signals)
      + fix_fix_count × 50
      + coauthored_count × 200
      + ci_failure_count × 30
      + total_additions × 0.05
```

The score is **unbounded** — there is no maximum. The leaderboard is a competition.

---

## Versioning

The scoring algorithm is expected to change as we calibrate thresholds and add new signals. Each version of the algorithm has a label (e.g., `v1 Alpha`) stored in the D1 `scoring_versions` table.

When a new algorithm version is released:
- Old leaderboard entries are preserved under their version
- New analyses write scores under the current version
- Historical leaderboards remain browsable

This ensures competitive fairness: scores are compared within the same algorithm version.

---

## Caveats and Known Limitations

**False positives:**
- Large initial commits (uploading a pre-existing project) score high
- Generated files (lock files, build artifacts) inflate line counts
- Squash merges can hide or distort the actual development timeline

**False negatives:**
- Vibe coding sessions committed as a single large commit may not trigger the sliding window signal
- AI assistance with small, frequent commits (e.g., AI-assisted refactoring) may score lower than it "deserves"
- Private repos with few commits may not have enough signal

**Things VibeCheck cannot detect:**
- Quality or correctness of the code
- Whether the developer understood what the AI generated
- Offline AI assistance (AI used locally, committed normally)
- Copy-paste from AI without git evidence

---

## Contributing New Signals

The algorithm lives in [`worker/src/analyze.ts`](./worker/src/analyze.ts). The scoring function is modular — adding a new signal is as simple as pushing to the `signals` array.

See the [README Contributing section](./README.md#contributing) for ideas and open questions.
