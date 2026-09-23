# Imagem de produção do Atrako.
# Build (na raiz do monorepo):
#   docker build --platform linux/amd64 -f apps/atrako/Dockerfile -t atrako-web:latest .
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
COPY apps/atrako/package.json apps/atrako/
COPY packages/events/package.json packages/events/
COPY packages/agent/package.json packages/agent/
COPY packages/forms/package.json packages/forms/
COPY packages/social/package.json packages/social/
COPY packages/db/package.json packages/db/
# Lock do monorepo referencia apps/agenda/crm/commerce e optional win32 sem version.
# No Docker instalamos só os workspaces presentes.
RUN node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.workspaces=['apps/atrako','packages/events','packages/agent','packages/forms','packages/social','packages/db']; fs.writeFileSync('package.json', JSON.stringify(p,null,2));" \
  && npm install --workspace=@atrako/shell --include-workspace-root --legacy-peer-deps

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/atrako
ENV NODE_OPTIONS=--max-old-space-size=6144
# Evita prerender tocar DB real (sem .env no contexto)
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
ENV SOCIAL_DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=symbius"
RUN npx prisma generate \
  && npx prisma generate --schema prisma/social.schema.prisma \
  && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/apps/atrako/.next ./.next
COPY --from=builder /app/apps/atrako/public ./public
COPY --from=builder /app/apps/atrako/package.json ./
COPY --from=builder /app/apps/atrako/next.config.* ./
COPY --from=builder /app/apps/atrako/lib/generated ./lib/generated
COPY --from=builder /app/apps/atrako/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY apps/atrako/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

EXPOSE 5000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npx", "next", "start", "-p", "5000", "-H", "0.0.0.0"]
