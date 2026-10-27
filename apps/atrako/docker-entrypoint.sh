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

# Nunca use db push --accept-data-loss no boot de produção.
# As migrações precisam ser revisadas e aplicadas de forma explícita e auditável.
echo "[entrypoint] prisma migrate deploy (schema principal)…"
npx prisma migrate deploy
echo "[entrypoint] prisma migrate deploy OK"

if [ -f /app/prisma/social.schema.prisma ]; then
  echo "[entrypoint] prisma db push (social / symbius schema)…"
  npx prisma db push --schema prisma/social.schema.prisma --skip-generate || \
    echo "[entrypoint] social db push failed (non-fatal for boot)"
fi

exec "$@"
