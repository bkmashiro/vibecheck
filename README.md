# VibeCheck 🔍🤖

> Detect AI-assisted "vibe coding" from GitHub commit history.

Analyze any GitHub repo and get a **Vibe Score** (0–100%) indicating how much of the code was AI-assisted, based on temporal patterns that are impossible for humans.

## How It Works

The algorithm looks for these signals in commit history:

| Signal | Description | Points |
|--------|-------------|--------|
| ⚡ Burst Speed | >500 lines/min added (impossible for humans) | +40 |
| 🤝 AI Co-author | `Co-authored-by` in commit message | +30 |
| 📈 Window Speed | >300 lines/min over any 30-min window | +30 |
| 💨 Rapid Commits | Large commit <2 min after previous | +15 |
| 🔄 Fix-Fix Pattern | Fix → Fix commits within 10 min | +10 |

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS → Cloudflare Pages
- **Backend**: Hono on Cloudflare Workers
- **Storage**: Cloudflare KV (cache + leaderboard)
- **Auth**: GitHub OAuth App

## Setup

### Prerequisites

- Node.js 18+
- Cloudflare account with Wrangler authenticated
- GitHub OAuth App with client ID `Ov23lin9cdvNmBGfZ9M7`

### Install

```bash
cd worker && npm install
cd ../frontend && npm install
```

### Create KV Namespace

```bash
cd worker
npx wrangler kv:namespace create KV
# Update wrangler.toml with the returned ID
```

### Configure Secrets

```bash
cd worker
npx wrangler secret put GH_OAUTH_CLIENT_SECRET
# Enter your GitHub OAuth client secret
```

### Development

```bash
# Terminal 1 - Worker
cd worker && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### Deploy

```bash
# Deploy worker
cd worker && npm run deploy

# Deploy frontend (update VITE_API_URL first)
cd frontend && npm run build
npx wrangler pages deploy dist --project-name vibecheck
```

## Environment Variables

### Worker (wrangler.toml + secrets)
- `FRONTEND_URL` — Your Cloudflare Pages URL
- `GH_OAUTH_CLIENT_SECRET` — GitHub OAuth client secret (via `wrangler secret`)

### Frontend (.env.production)
- `VITE_API_URL` — Your worker URL (e.g., `https://vibecheck-api.your-subdomain.workers.dev`)

## License

MIT
