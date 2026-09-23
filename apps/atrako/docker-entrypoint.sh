#!/bin/sh
set -e

echo "[entrypoint] waiting for database…"
i=1
while [ "$i" -le 30 ]; do
  if npx prisma db push --skip-generate; then
    echo "[entrypoint] prisma db push OK"
    break
  fi
  echo "[entrypoint] db push failed (attempt $i/30) — retrying…"
  i=$((i + 1))
  sleep 2
done

if [ "$i" -gt 30 ]; then
  echo "[entrypoint] FATAL: could not sync schema"
  exit 1
fi

# Melhor esforço: marca migrations como applied quando o histórico estiver incompleto
npx prisma migrate deploy 2>/dev/null || \
  echo "[entrypoint] migrate deploy skipped/failed (schema already via db push)"

if [ -f /app/prisma/social.schema.prisma ]; then
  echo "[entrypoint] prisma db push (social / symbius schema)…"
  npx prisma db push --schema prisma/social.schema.prisma --skip-generate || \
    echo "[entrypoint] social db push failed (non-fatal for boot)"
fi

exec "$@"
