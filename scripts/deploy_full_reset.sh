#!/bin/bash
set -e

echo "🚀 FULL RESET & DEPLOY - Cactus Gaming Search"
echo "=============================================="
echo ""

# Configurações
SSH_KEY="/Users/gabriel.cerioni/.ssh/gabs-se-sales-ssh-keypair.pem"
SERVER="ubuntu@18.212.93.54"
PROJECT_DIR="/root/cactus-gaming-search"
API_URL="https://api-backend.platformengineer.io"

echo "📦 Step 1: Build backend locally"
cd backend
npm run build
cd ..

echo ""
echo "📤 Step 2: Push latest code to GitHub"
git add -A
git commit -m "feat: update schema with BO fields (description, categoria, tags)" || echo "No changes to commit"
git push origin main

echo ""
echo "🔄 Step 3: Pull latest code on server"
ssh -i "$SSH_KEY" "$SERVER" "sudo -i bash -c 'cd $PROJECT_DIR && git pull origin main'"

echo ""
echo "🗑️  Step 4: Clean Redis (drop index + flush games)"
ssh -i "$SSH_KEY" "$SERVER" "sudo -i bash -c 'cd $PROJECT_DIR/seed && python3 clean_redis.py'"

echo ""
echo "🌱 Step 5: Seed Redis with new data"
ssh -i "$SSH_KEY" "$SERVER" "sudo -i bash -c 'cd $PROJECT_DIR/seed && python3 seed_production_vectors.py'"

echo ""
echo "🔨 Step 6: Rebuild backend on server"
ssh -i "$SSH_KEY" "$SERVER" "sudo -i bash -c 'cd $PROJECT_DIR/backend && npm install && npm run build'"

echo ""
echo "🔄 Step 7: Restart PM2"
ssh -i "$SSH_KEY" "$SERVER" "sudo -i bash -c 'pm2 restart cactus-backend || pm2 start $PROJECT_DIR/backend/dist/index.js --name cactus-backend -i 2'"

echo ""
echo "📊 Step 8: Check PM2 status"
ssh -i "$SSH_KEY" "$SERVER" "sudo -i bash -c 'pm2 list && pm2 logs cactus-backend --lines 20 --nostream'"

echo ""
echo "🌐 Step 9: Deploy Frontend to Cloudflare Pages"
ssh -i "$SSH_KEY" "$SERVER" "sudo -i bash -c 'export CLOUDFLARE_API_TOKEN=\"lvV3rlj0HWTYyQUZ2cNZTrueGmutwX_72uft7zkR\" && cd $PROJECT_DIR && npx wrangler pages deploy frontend --project-name=cactus-demo'"

echo ""
echo "✅ DEPLOY COMPLETE!"
echo ""
echo "✅ DEPLOY COMPLETE!"
echo ""
echo "🧪 Test the search:"
echo "curl -X POST https://api-backend.platformengineer.io/api/search -H 'Content-Type: application/json' -d '{\"query\": \"mengao\"}'"
echo ""
echo "🌐 Frontend: https://128b1c88.cactus-demo.pages.dev"
echo "🔧 Backend API: https://api-backend.platformengineer.io"

