#!/usr/bin/env bash
# Dispara o sync diário (Meta + Google Ads + GA4 + alertas) de todos os clientes,
# rodando a lógica direto contra o banco (mesmo job usado pelo Scheduled Deployment).
#
# Uso:
#   ./scripts/run-sync.sh                       # sync incremental
#   ./scripts/run-sync.sh 2026-01-01 2026-06-05 # força re-sync de um período (YYYY-MM-DD)
#
# Veja docs/sync-cron.md para configurar o agendamento automático no Replit.

set -e
cd "$(dirname "$0")/.."
exec npm run sync:daily -- "$@"
