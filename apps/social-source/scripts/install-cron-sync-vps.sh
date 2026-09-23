#!/usr/bin/env bash
# Instala o sync diário às 05:00 (BRT) na VPS.
# Uso (como root na VPS):
#   curl -sO ... ou copie este arquivo e rode:
#   bash /var/www/central-inout/scripts/install-cron-sync-vps.sh
#
# O que faz:
#   1. Cria scripts/cron-sync-vps.sh (Meta + Google Ads + GA4 + alertas)
#   2. Agenda no crontab: todo dia 05:00 horário de Brasília (08:00 UTC)
#   3. Opcional: roda um teste agora (--test)

set -euo pipefail

ROOT="${ROOT:-/var/www/central-inout}"
CRON_SCRIPT="$ROOT/scripts/cron-sync-vps.sh"
INSTALL_SCRIPT="$ROOT/scripts/install-cron-sync-vps.sh"
LOG="/var/log/central-sync.log"
CRON_LINE="0 8 * * * $CRON_SCRIPT"
RUN_TEST=false

for arg in "$@"; do
  case "$arg" in
    --test) RUN_TEST=true ;;
  esac
done

mkdir -p "$ROOT/scripts"

cat > "$CRON_SCRIPT" <<'SYNC_EOF'
#!/usr/bin/env bash
# Sync diário: Meta Ads + Google Ads + GA4 + alertas (todo o hub).
set -euo pipefail

ROOT="/var/www/central-inout"
LOG="/var/log/central-sync.log"

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

ec=0
{
  echo "======== $(date -Is) sync:daily (atualização completa) ========"
  set +e
  npm run sync:daily
  ec=$?
  set -e
  echo "[$(date -Is)] concluído (exit $ec)"
} >> "$LOG" 2>&1

exit $ec
SYNC_EOF

chmod +x "$CRON_SCRIPT"

# Crontab: adiciona linha sem apagar as existentes
EXISTING="$(crontab -l 2>/dev/null || true)"
if echo "$EXISTING" | grep -qF "$CRON_SCRIPT"; then
  echo "==> Crontab já contém o sync da Central"
else
  {
    echo "$EXISTING" | grep -v '^[[:space:]]*$' || true
    echo "$CRON_LINE"
  } | crontab -
  echo "==> Crontab atualizado: $CRON_LINE"
fi

echo ""
echo "Sync diário configurado:"
echo "  Horário: 05:00 (Brasília) — todo dia"
echo "  Script:  $CRON_SCRIPT"
echo "  Log:     $LOG"
echo ""
echo "Comandos úteis:"
echo "  crontab -l"
echo "  $CRON_SCRIPT              # rodar agora"
echo "  tail -f $LOG              # acompanhar log"
echo ""

if $RUN_TEST; then
  echo "==> Executando teste agora..."
  "$CRON_SCRIPT"
  echo "==> Últimas linhas do log:"
  tail -30 "$LOG"
fi
