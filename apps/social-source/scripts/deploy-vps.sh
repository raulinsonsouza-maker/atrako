#!/usr/bin/env bash
# Deploy na VPS Symbius (Docker Swarm + Traefik).
# Reinicia APENAS o stack "symbius-central" — não mexe em radar/hub/symbius marketing.
# Uso: ./scripts/deploy-vps.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STACK_NAME="${STACK_NAME:-symbius-central}"
IMAGE_TAG="${IMAGE_TAG:-symbius-central:latest}"

echo "==> Deploy Symbius Central/Flow em $ROOT (stack=$STACK_NAME)"

if [ ! -f .env ]; then
  echo "Erro: arquivo .env não encontrado."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${DATABASE_URL:-}" ]; then
  echo "Erro: POSTGRES_PASSWORD e DATABASE_URL sao obrigatorios no .env"
  exit 1
fi

echo "==> docker build $IMAGE_TAG"
export DOCKER_BUILDKIT=1
docker build -t "$IMAGE_TAG" .

echo "==> docker stack deploy $STACK_NAME"
docker stack deploy -c deploy/stack.yml "$STACK_NAME"

# Mesma tag (:latest) não força rollout no Swarm após rebuild local.
echo "==> forcar rollout do web com a imagem recém-buildada"
docker service update --force --image "$IMAGE_TAG" "${STACK_NAME}_web"

echo "==> Aguardando servicos..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if docker service ls --format '{{.Name}} {{.Replicas}}' | grep -q "${STACK_NAME}_web 1/1"; then
    echo "==> web 1/1"
    break
  fi
  sleep 10
done

docker service ls | grep "$STACK_NAME" || true
echo "==> Deploy concluido (outros stacks intocados)"
echo "    Flow:    https://flow.symbius.com.br"
echo "    Central: https://central.symbius.com.br"
