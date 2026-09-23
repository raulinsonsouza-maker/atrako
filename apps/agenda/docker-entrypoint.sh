#!/bin/sh
set -e

mkdir -p /data /app/public/uploads/covers /app/uploads/intake
chown -R nextjs:nodejs /data /app/public/uploads /app/uploads

# SQLite + Swarm: migrate pode falhar se outro task ainda segura o arquivo
# (ou com URL inválida). Não derrubar o app por isso — retry e segue.
if [ -f /app/prisma/schema.prisma ]; then
  i=1
  while [ "$i" -le 5 ]; do
    if gosu nextjs npx prisma migrate deploy; then
      break
    fi
    echo "[entrypoint] prisma migrate deploy falhou (tentativa $i/5) — aguardando…"
    i=$((i + 1))
    sleep 2
  done
fi

exec gosu nextjs "$@"
