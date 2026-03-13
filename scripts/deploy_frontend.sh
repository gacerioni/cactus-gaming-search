#!/bin/bash
set -e

echo "🌐 FRONTEND DEPLOY - Cloudflare Pages"
echo "======================================"
echo ""

# Configurações
SSH_KEY="/Users/gabriel.cerioni/.ssh/gabs-se-sales-ssh-keypair.pem"
SERVER="ubuntu@18.212.93.54"
PROJECT_DIR="/root/cactus-gaming-search"

echo "📤 Step 1: Push latest frontend to GitHub"
git add frontend/
git commit -m "feat: update frontend UI" || echo "No changes to commit"
git push origin main

echo ""
echo "🔄 Step 2: Pull latest code on server"
ssh -i "$SSH_KEY" "$SERVER" "sudo -i bash -c 'cd $PROJECT_DIR && git pull origin main'"

echo ""
echo "🚀 Step 3: Deploy to Cloudflare Pages"
ssh -i "$SSH_KEY" "$SERVER" "sudo -i bash -c 'export CLOUDFLARE_API_TOKEN=\"lvV3rlj0HWTYyQUZ2cNZTrueGmutwX_72uft7zkR\" && cd $PROJECT_DIR && npx wrangler pages deploy frontend --project-name=cactus-demo'"

echo ""
echo "✅ FRONTEND DEPLOY COMPLETE!"
echo ""
echo "🌐 URL: https://128b1c88.cactus-demo.pages.dev"
echo ""
echo "💡 Aguarde ~30 segundos e faça hard refresh (Cmd+Shift+R)"

