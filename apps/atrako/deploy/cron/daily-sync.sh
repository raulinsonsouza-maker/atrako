#!/bin/bash
# Sync diário de mídia (Meta, Google, LinkedIn, GA4) + alertas.
# Chama o app por dentro do container, sem passar pelo proxy.
# Crontab (VPS em UTC = 05:00 BRT):
#   0 8 * * * /opt/apps/atrako/cron/daily-sync.sh
set -euo pipefail

LOG=/var/log/atrako-daily-sync.log
LOCK=/var/lock/atrako-daily-sync.lock
ENV_FILE=/opt/apps/atrako/.env

mkdir -p /var/lock
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) sync já em execução" >> "$LOG"
  exit 0
fi

read_env() {
  grep "^$1=" "$ENV_FILE" | head -n 1 | cut -d= -f2- | tr -d '"\r'"'"
}

TOKEN=$(read_env SYNC_CRON_TOKEN)
if [ -z "$TOKEN" ]; then
  TOKEN=$(read_env CRON_SECRET)
fi
if [ -z "$TOKEN" ]; then
  echo "$(date -Is) SYNC_CRON_TOKEN ausente" >> "$LOG"
  exit 1
fi

WEB=$(docker ps -q -f name=atrako_web | awk 'NR==1')
if [ -z "$WEB" ]; then
  echo "$(date -Is) container web ausente" >> "$LOG"
  exit 1
fi

echo "$(date -Is) iniciando sync diário" >> "$LOG"
set +e
docker exec -e ATRAKO_SYNC_TOKEN="$TOKEN" "$WEB" \
  sh -c 'curl -sS -m 14400 -X POST -H "Authorization: Bearer $ATRAKO_SYNC_TOKEN" -H "Content-Type: application/json" http://127.0.0.1:5000/api/sync/daily-global' \
  >> "$LOG" 2>&1
CODE=$?
set -e
echo >> "$LOG"
echo "$(date -Is) sync diário curl exit=$CODE" >> "$LOG"
exit "$CODE"
