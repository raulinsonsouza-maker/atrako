#!/bin/sh
set -e

echo "[entrypoint] waiting for database…"
i=1
until echo "SELECT 1;" | npx prisma db execute --stdin --schema prisma/schema.prisma >/dev/null 2>&1; do
  if [ "$i" -ge 30 ]; then
    echo "[entrypoint] FATAL: database unreachable"
    exit 1
  fi
  i=$((i + 1))
  sleep 2
done

# Migrations antes do db push: se o push criar as tabelas primeiro, o SQL da migration falha com
# "já existe" e o histórico trava (seeds das migrations também deixam de rodar).
if npx prisma migrate deploy; then
  echo "[entrypoint] prisma migrate deploy OK"
else
  echo "[entrypoint] WARNING: prisma migrate deploy FAILED — corrija com prisma migrate resolve"
fi

npx prisma db push --skip-generate
echo "[entrypoint] prisma db push OK"

if [ -f /app/prisma/social.schema.prisma ]; then
  echo "[entrypoint] prisma db push (social / symbius schema)…"
  npx prisma db push --schema prisma/social.schema.prisma --skip-generate || \
    echo "[entrypoint] social db push failed (non-fatal for boot)"
fi

exec "$@"
