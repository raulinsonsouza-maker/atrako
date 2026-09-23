# Production image for Symbius Central + Flow (Next.js)
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5010
ENV HOSTNAME=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p public

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib/generated ./lib/generated
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY --from=builder /app/next.config.* ./

RUN chmod +x ./scripts/docker-entrypoint.sh

EXPOSE 5010
HEALTHCHECK --interval=20s --timeout=5s --retries=5 --start-period=60s \
  CMD curl -fsS "http://127.0.0.1:5010/api/health" || exit 1

CMD ["./scripts/docker-entrypoint.sh"]
