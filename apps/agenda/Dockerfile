# docker build -t book-web:latest .

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXTAUTH_SECRET=build-time-placeholder
ENV NEXTAUTH_URL=https://book.symbius.com.br
ARG NEXT_PUBLIC_APP_URL=https://book.symbius.com.br
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV DATABASE_URL=file:./build.db
RUN npx prisma generate \
  && npx prisma db push --skip-generate \
  && npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/data/book.db

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl gosu \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /data \
  && chown nextjs:nodejs /data

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

RUN npm install --omit=dev prisma@6.19.3 @prisma/client@6.19.3 \
  && npx prisma generate \
  && chmod +x /app/docker-entrypoint.sh \
  && chown -R nextjs:nodejs /app/prisma /app/node_modules || true

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=8 \
  CMD curl -fsS -o /dev/null --max-time 4 http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
