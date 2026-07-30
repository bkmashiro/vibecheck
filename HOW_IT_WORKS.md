# How Vibe Index v2 works

VibeCheck reads the latest 100 commits on a repository's default branch through GitHub GraphQL. It does not read source files, prompts, local agent logs, or provider token usage.

The output is a **0–100 heuristic index**, not a claim that a particular person or model authored the code.

## Input normalization

Before scoring, VibeCheck:

- sorts commits chronologically;
- excludes merge commits (`parents.totalCount > 1`);
- compares timing signals only between commits by the same author;
- treats ordinary human `Co-Authored-By:` trailers as neutral;
- reports sample confidence separately from the score.

## Evidence categories

Each category has a cap so one large repository or repeated pattern cannot dominate indefinitely.

| Category | Rule | Evidence points | Cap |
|---|---|---:|---:|
| Explicit AI attribution | Known AI identity in `Co-Authored-By`, `Generated with/by`, or `AI-generated` | 18 per commit | 45 |
| Burst speed | Same-author commit interval implies >100, >200, or >500 inserted lines/minute | 3 / 5 / 8 | 25 |
| Rapid commits | Same author, under 2 minutes, at least 30 inserted lines | 4 | 10 |
| Repair chain | Same author, two repair commits within 15 minutes | 5 | 10 |
| Session density | 3+ same-author commits separated by at most 30 minutes, with sustained >80 or >200 lines/minute | 4 / 8 | 20 |

Raw category points form `energy`. The public index is bounded with a saturating curve:

```text
score = round(100 × (1 − exp(−energy / 32)), 1)
```

This prevents raw line count from determining the leaderboard while preserving stronger evidence combinations.

## Confidence

Confidence estimates whether the sample is large and broad enough to interpret. It depends on:

- eligible commit count;
- timespan covered by those commits.

It does **not** increase just because the score is high. A single explicitly attributed commit can produce a meaningful signal with low confidence; dozens of commits across several weeks produce higher confidence.

## Cache and privacy

- Public repositories use a versioned public cache key.
- Private repository results use a per-GitHub-user cache key.
- Cache keys include `v2`, so v1 payloads cannot be mistaken for v2 results.
- Leaderboard enrollment requires GitHub push/admin/maintain permission for the repository.

## Known limitations

Git metadata cannot prove authorship. In particular:

- squashed commits hide session structure;
- copied or generated commit messages can create false positives;
- commit timestamps measure intervals between commits, not actual typing duration;
- generated code and vendored files are not distinguished because file contents are not fetched;
- repositories with fewer than 100 recent commits have lower sample depth;
- high AI assistance says nothing by itself about correctness, maintainability, or security.

VibeCheck is designed as an auditable comparison signal and conversation starter—not a forensic detector or quality score.
