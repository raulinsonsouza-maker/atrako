#!/usr/bin/env bash
# Sync diário para crontab na VPS (hub.prospectads.com.br).
# Não usa HTTP nem SYNC_CRON_TOKEN — roda direto no banco.
#
# Crontab (05:00 BRT = 08:00 UTC):
#   0 8 * * * /var/www/central-inout/scripts/cron-sync-vps.sh
#
# Teste manual:
#   /var/www/central-inout/scripts/cron-sync-vps.sh

set -euo pipefail

ROOT="/var/www/central-inout"
LOG="/var/log/central-sync.log"

# Cron não carrega nvm/shell profile — garantir node/npm no PATH
export NVM_DIR="${NVM_DIR:-/root/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
fi

cd "$ROOT"

if [ ! -f .env ]; then
  echo "[$(date -Is)] ERRO: .env não encontrado em $ROOT" >> "$LOG"
  exit 1
fi

{
  echo "======== $(date -Is) sync:daily ========"
  set +e
  npm run sync:daily
  ec=$?
  set -e
  echo "[$(date -Is)] concluído (exit $ec)"
} >> "$LOG" 2>&1

exit $ec
