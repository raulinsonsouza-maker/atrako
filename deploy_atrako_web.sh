#!/bin/bash
set -euo pipefail

# Recreate Atrako web as Swarm service so Traefik can route atrako.com.br
# Skip Prisma entrypoint; point DB at the running compose Postgres.

docker service rm atrako_web >/dev/null 2>&1 || true
sleep 2

docker service create \
  --name atrako_web \
  --network traefik_proxy \
  --with-registry-auth \
  --restart-condition on-failure \
  --limit-memory 1536M \
  --env-file /opt/apps/atrako/.env \
  -e DATABASE_URL='postgresql://atrako:atrako@5.75.172.83:5432/atrako?schema=public' \
  -e SOCIAL_DATABASE_URL='postgresql://atrako:atrako@5.75.172.83:5432/atrako?schema=symbius' \
  -e NODE_ENV=production \
  -e PORT=5000 \
  --entrypoint npx \
  --label traefik.enable=true \
  --label traefik.docker.network=traefik_proxy \
  --label 'traefik.http.routers.atrako.rule=Host(`atrako.com.br`) || Host(`www.atrako.com.br`)' \
  --label traefik.http.routers.atrako.entrypoints=websecure \
  --label traefik.http.routers.atrako.tls=true \
  --label traefik.http.routers.atrako.tls.certresolver=letsencryptresolver \
  --label traefik.http.routers.atrako.service=atrako-web \
  --label traefik.http.middlewares.atrako-https.redirectscheme.scheme=https \
  --label traefik.http.middlewares.atrako-https.redirectscheme.permanent=true \
  --label 'traefik.http.routers.atrako-http.rule=Host(`atrako.com.br`) || Host(`www.atrako.com.br`)' \
  --label traefik.http.routers.atrako-http.entrypoints=web \
  --label traefik.http.routers.atrako-http.middlewares=atrako-https \
  --label traefik.http.services.atrako-web.loadbalancer.server.port=5000 \
  --label 'traefik.http.routers.lp-regicenter.rule=Host(`lp.regicenter.com`)' \
  --label traefik.http.routers.lp-regicenter.entrypoints=websecure \
  --label traefik.http.routers.lp-regicenter.tls=true \
  --label traefik.http.routers.lp-regicenter.tls.certresolver=letsencryptresolver \
  --label traefik.http.routers.lp-regicenter.service=atrako-web \
  --label 'traefik.http.routers.lp-regicenter-http.rule=Host(`lp.regicenter.com`)' \
  --label traefik.http.routers.lp-regicenter-http.entrypoints=web \
  --label traefik.http.routers.lp-regicenter-http.middlewares=atrako-https \
  --label 'traefik.http.routers.lp-vilaris.rule=Host(`vilarisgestao.com.br`) || Host(`www.vilarisgestao.com.br`)' \
  --label traefik.http.routers.lp-vilaris.entrypoints=websecure \
  --label traefik.http.routers.lp-vilaris.tls=true \
  --label traefik.http.routers.lp-vilaris.tls.certresolver=letsencryptresolver \
  --label traefik.http.routers.lp-vilaris.service=atrako-web \
  --label 'traefik.http.routers.lp-vilaris-http.rule=Host(`vilarisgestao.com.br`) || Host(`www.vilarisgestao.com.br`)' \
  --label traefik.http.routers.lp-vilaris-http.entrypoints=web \
  --label traefik.http.routers.lp-vilaris-http.middlewares=atrako-https \
  atrako-web:latest \
  next start -p 5000 -H 0.0.0.0

echo "service created"
docker service ps atrako_web
