#!/bin/sh
set -e

echo "==> waiting for database..."
i=0
until npx prisma migrate deploy; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "Database not ready after retries"
    exit 1
  fi
  echo "retry $i/30 in 3s..."
  sleep 3
done

echo "==> starting next on :${PORT:-5010}"
exec npx next start -H 0.0.0.0 -p "${PORT:-5010}"
