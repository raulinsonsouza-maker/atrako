#!/usr/bin/env bash
# Deploy rápido (Git Bash / WSL / macOS): build local → .next na VPS → pm2 restart
# Uso: ./scripts/deploy-to-vps.sh [--skip-build] [--git-pull] [--migrate]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_BUILD=false
GIT_PULL=false
MIGRATE=false

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --git-pull) GIT_PULL=true ;;
    --migrate) MIGRATE=true ;;
  esac
done

load_env() {
  local file="$1"
  [ -f "$file" ] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$file"
  set +a
}

if [ -f deploy/vps.local.env ]; then
  load_env deploy/vps.local.env
elif [ -f deploy/vps.env.example ]; then
  load_env deploy/vps.env.example
fi

VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-root}"
VPS_PATH="${VPS_PATH:-/var/www/central-inout}"
PM2_APP="${PM2_APP:-central-inout}"

if [ -z "$VPS_HOST" ]; then
  echo "Configure deploy/vps.local.env (copie de deploy/vps.env.example)"
  exit 1
fi

REMOTE="${VPS_USER}@${VPS_HOST}"
echo "==> Deploy para $REMOTE:$VPS_PATH"

if $GIT_PULL; then
  echo "==> git pull na VPS"
  ssh "$REMOTE" "cd '$VPS_PATH' && git pull"
fi

if ! $SKIP_BUILD; then
  echo "==> npm run build (local)"
  npm run build
fi

echo "==> Enviando .next para a VPS"
ssh "$REMOTE" "rm -rf '$VPS_PATH/.next'"
scp -r .next "$REMOTE:$VPS_PATH/"

if $MIGRATE; then
  echo "==> prisma migrate deploy na VPS"
  ssh "$REMOTE" "cd '$VPS_PATH' && npx prisma migrate deploy"
fi

echo "==> pm2 restart $PM2_APP"
ssh "$REMOTE" "pm2 restart '$PM2_APP' --update-env && pm2 save"

echo "==> Deploy concluído"
