#!/bin/bash
# Build local + sync para VPS (evita build na VPS com pouca RAM)
# Uso: ./deploy/sync-to-vps.sh [user@host]
# Ex:  ./deploy/sync-to-vps.sh root@191.252.178.138

set -e
VPS="${1:-root@191.252.178.138}"
REMOTE_DIR="/var/www/crm"

echo "=== 1. Build local (no seu PC) ==="
cd "$(dirname "$0")/.."
npm run build

echo ""
echo "=== 2. Sync para VPS ($VPS) ==="
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.next/cache' \
  --exclude '*.log' \
  . "$VPS:$REMOTE_DIR/"

echo ""
echo "=== 3. Instruções para a VPS ==="
echo "Conecte na VPS e execute:"
echo "  cd $REMOTE_DIR"
echo "  npm ci --omit=dev"
echo "  npx prisma generate"
echo "  pm2 restart all   # ou: pm2 start ecosystem.config.js"
echo ""
echo "Pronto! O .next já foi enviado; não precisa rodar build na VPS."
