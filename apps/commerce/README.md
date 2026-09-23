# Signal Commerce — Plataforma de vendas digitais

MVP single-seller com checkout transparente Mercado Pago, Pixel Meta, upsell e área de membros.

## Stack

- Next.js (App Router) + TypeScript
- Prisma + SQLite (dev) — troque `DATABASE_URL` para PostgreSQL em produção
- Auth.js (credentials)
- Design system **Claude Amber** (creme `#F5F4EF`, accent `#C96442`, Inter + Geist Mono)

## Setup rápido

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Login admin (seed)

- E-mail: `admin@loja.com`
- Senha: `admin123`

### Produtos demo

- Sales page: `/p/ebook-demo`
- Curso: `/p/curso-demo`
- Cupom: `SINAL10`

## Fluxos principais

| Área | Rota |
|------|------|
| Admin | `/admin` |
| Conectar Mercado Pago (OAuth) | `/admin/integracoes/mercado-pago` |
| Checkout | `/checkout/[productId]` |
| Membros | `/membros` |

Sem conta MP conectada, o checkout roda em **modo demo** (aprova localmente) — útil para testar funil, upsell e membros.

## Variáveis de ambiente

Copie `.env.example` → `.env` e preencha:

- `MP_CLIENT_ID` / `MP_CLIENT_SECRET` / `MP_REDIRECT_URI` — app no Mercado Pago
- `MP_TOKEN_ENCRYPTION_KEY` — 64 chars hex (AES-GCM)
- `META_PIXEL_ID` / `META_CAPI_TOKEN`
- `R2_*` — uploads (opcional; fallback local)
- `BUNNY_*` — vídeos
- `RESEND_API_KEY` — e-mails (loga no console se vazio)

## Produção (Postgres)

1. Suba Postgres (ex.: Neon ou `docker compose up -d` com Docker Desktop ligado)
2. Em `prisma/schema.prisma`, mude `provider` para `postgresql`
3. Ajuste `DATABASE_URL`
4. `npm run db:push && npm run db:seed`
