#!/usr/bin/env bash
# VibeCheck — Cloudflare provisioning script
# Run this once after `wrangler login` is complete.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKER_DIR="$SCRIPT_DIR/../worker"

echo "🔐 Checking wrangler auth..."
cd "$WORKER_DIR"
npx wrangler whoami

echo ""
echo "📦 Creating KV namespace..."
KV_OUTPUT=$(npx wrangler kv:namespace create KV 2>&1)
echo "$KV_OUTPUT"
KV_ID=$(echo "$KV_OUTPUT" | grep -oE '"id": "[^"]+"' | head -1 | grep -oE '[0-9a-f]{32}')

echo ""
echo "🗄️  Creating D1 database..."
D1_OUTPUT=$(npx wrangler d1 create vibecheck 2>&1)
echo "$D1_OUTPUT"
D1_ID=$(echo "$D1_OUTPUT" | grep -oE 'database_id = "[^"]+"' | grep -oE '"[^"]+"' | tr -d '"')

if [ -z "$KV_ID" ] || [ -z "$D1_ID" ]; then
  echo ""
  echo "⚠️  Could not auto-parse IDs from wrangler output."
  echo "    Please update worker/wrangler.toml manually with the IDs shown above."
else
  echo ""
  echo "✏️  Updating wrangler.toml with IDs..."
  sed -i.bak "s/id = \"TBD\"  # KV/id = \"$KV_ID\"/" "$WORKER_DIR/wrangler.toml" 2>/dev/null || \
  sed -i.bak "s/id = \"TBD\"/id = \"$KV_ID\"/" "$WORKER_DIR/wrangler.toml"
  sed -i.bak "s/database_id = \"TBD\"/database_id = \"$D1_ID\"/" "$WORKER_DIR/wrangler.toml"
  rm -f "$WORKER_DIR/wrangler.toml.bak"
  echo "    KV  → $KV_ID"
  echo "    D1  → $D1_ID"
fi

echo ""
echo "📋 Applying D1 migrations..."
npx wrangler d1 execute vibecheck --file=migrations/0001_init.sql

echo ""
echo "🔑 Setting OAuth secret..."
echo "Enter your GitHub OAuth client secret when prompted:"
npx wrangler secret put GH_OAUTH_CLIENT_SECRET

echo ""
echo "🚀 Deploying worker..."
npx wrangler deploy

echo ""
echo "✅ Worker deployed!"
echo ""
echo "Next steps:"
echo "  1. Get your worker URL from the output above"
echo "  2. Update FRONTEND_URL in wrangler.toml with your Pages URL"
echo "  3. Add VITE_API_URL=<worker-url> to frontend/.env.production"
echo "  4. Deploy frontend: cd frontend && npm run build && npx wrangler pages deploy dist --project-name vibecheck"
echo "  5. Set your GitHub OAuth App callback URL to: <worker-url>/auth/callback"
