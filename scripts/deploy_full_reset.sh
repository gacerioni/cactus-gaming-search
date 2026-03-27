#!/bin/bash
set -e

echo "🚀 FULL RESET & DEPLOY - Cactus Gaming Search (Edge Architecture)"
echo "=================================================================="
echo "Architecture: CF Worker → Redis Cloud (no EC2)"
echo ""

# ─── Step 1: Clean Redis ──────────────────────────────────
echo "🗑️  Step 1: Clean Redis"
cd seed
python3 clean_redis.py
cd ..

# ─── Step 2: Seed Redis with game data + embeddings ───────
echo ""
echo "🌱 Step 2: Seed Redis with new data"
cd seed
python3 seed_production_vectors.py
cd ..

# ─── Step 3: Push to GitHub ───────────────────────────────
echo ""
echo "📤 Step 3: Push latest code to GitHub"
git add -A
git commit -m "feat: edge architecture - CF Worker direct to Redis Cloud" || echo "No changes to commit"
git push origin main

# ─── Step 4: Deploy Worker to Cloudflare ──────────────────
echo ""
echo "☁️  Step 4: Deploy CF Worker"
cd worker
npx wrangler deploy
cd ..

# ─── Step 5: Deploy Frontend to Cloudflare Pages ─────────
echo ""
echo "🌐 Step 5: Deploy Frontend to Cloudflare Pages"
npx wrangler pages deploy frontend --project-name=cactus-demo

echo ""
echo "✅ DEPLOY COMPLETE!"
echo ""
echo "🧪 Test the search:"
echo "curl -X POST https://cactus-worker.platformengineer.workers.dev/api/search -H 'Content-Type: application/json' -d '{\"query\": \"mengao\"}'"
echo ""
echo "🌐 Frontend: https://cactus-demo.pages.dev"
echo "⚡ Worker API: https://cactus-worker.platformengineer.workers.dev"

