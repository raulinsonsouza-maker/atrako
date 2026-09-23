# Central de Clientes - inout

## Overview
Dashboard de performance e planejamento para clientes de consultoria estratégica. Hub consolidado que permite analisar funil, investimento e resultados de campanhas de mídia (Meta Ads, Google Ads, Google Analytics) por cliente, além de apresentar planos estratégicos táticos para apresentação.

## Main Sections
- `/clientes` — Central de Clientes: performance de campanhas por cliente
- `/portal/[token]` — Portal exclusivo do cliente: acesso direto ao dashboard de um cliente via link com token único (sem header, sem navegação admin)
- `/planejamento` — Central de Planejamento: planos táticos/estratégicos para apresentação a clientes
  - `/planejamento/hotel-fazenda-sao-joao` — Plano "Máquina de Aquisição" (Meta Ads)

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (Replit built-in) via Prisma ORM
- **Styling**: Tailwind CSS + Radix UI
- **Charts**: Recharts
- **APIs**: Google Ads, Meta Marketing API, Google Analytics 4, Google Sheets

## Project Structure
```
app/          - Next.js App Router pages and API routes
components/   - Reusable UI components
config/       - Configuration files
lib/          - Utility functions and Prisma client
  generated/  - Prisma generated client
prisma/       - Database schema and migrations
scripts/      - Data import/sync scripts
docs/         - Project documentation
public/       - Static assets
```

## Running the App
The app runs on port 5000 with `npm run dev`.

## Database
Uses Replit's built-in PostgreSQL. Schema managed via Prisma.
- Run `npm run db:push` to sync schema changes
- Run `npm run db:generate` to regenerate Prisma client
- Run `npm run db:studio` to open Prisma Studio

## Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (auto-set by Replit)
- `META_ACCESS_TOKEN` - Meta Marketing API token
- `META_AD_ACCOUNT_ID` - Meta ad account ID
- `GOOGLE_ADS_DEVELOPER_TOKEN` - Google Ads developer token
- `GOOGLE_ADS_CLIENT_ID` - Google Ads OAuth client ID
- `GOOGLE_ADS_CLIENT_SECRET` - Google Ads OAuth client secret
- `GOOGLE_ADS_REFRESH_TOKEN` - Google Ads OAuth refresh token
- `GOOGLE_ANALYTICS_CREDENTIALS` - GA4 service account JSON string
- `GOOGLE_CLIENT_EMAIL` - Google Sheets service account email
- `GOOGLE_PRIVATE_KEY` - Google Sheets service account private key
- `SYNC_CRON_TOKEN` - Token for protecting sync endpoints
- `ADMIN_SECRET` - Token for admin area protection

## Admin Features

### Portal Exclusivo por Cliente
- `Cliente.portalToken String? @unique` — UUID único gerado automaticamente para cada cliente
- Rota pública `/portal/[token]` — renderiza o `ClienteDashboard` sem header e sem links de navegação admin
- API `GET /api/portal/[token]` — resolve token → clienteId (pública)
- API `POST /api/admin/clientes/[id]/regenerate-token` — gera novo UUID e invalida o link anterior (requer `x-admin-token` header)
- Admin clientes: botões "Link" (copia URL para clipboard com feedback "Copiado!") e "Novo link" (confirma antes de regenerar) por cliente
- `ClienteDashboard` exportado como named export em `app/clientes/[id]/page.tsx`; `portalMode` prop oculta back-link e link de administração
- `Header` oculto em todas as rotas `/portal/*`

### Segment Management
- `Segmento` Prisma model: `id`, `nome` (unique), `cor` (hex color)
- API: `GET /api/admin/segmentos` (public), `POST /api/admin/segmentos` (admin), `PATCH/DELETE /api/admin/segmentos/[id]` (admin)
- Admin form uses a custom Combobox with colored dots + "+" button to open `SegmentoManagerModal`
- `SegmentoManagerModal` has two tabs: "Novo segmento" (create with color picker) and "Editar" (list, inline edit, delete)
- Segment color is propagated to `ClienteCard` via `segmentoCor` field and used as badge background

### Logo Upload
- API: `POST /api/admin/upload-logo` (multipart), `DELETE /api/admin/upload-logo` (removes file)
- Uses `@vercel/blob` when `BLOB_READ_WRITE_TOKEN` is set (production), falls back to filesystem in dev
- `LogoUploadField` component: shows preview + "Trocar"/"Remover" buttons when logo exists; shows dashed upload button when empty

## Sincronização Automática (Sync Diário)

A atualização diária de todas as contas Meta Ads, Google Ads e GA4 roda via **Replit Scheduled Deployment** (NÃO via `vercel.json` — os crons da Vercel não funcionam no Replit e nunca disparam aqui).

- **Job:** `npm run sync:daily` → `scripts/daily-sync.ts`
- Executa Meta → Google Ads → GA4 (sequencial, evita rate limits) + `runDailyAlerts`, **direto contra o banco** (sem HTTP, sem `SYNC_CRON_TOKEN`, sem cold-start, sem limite de 300s).
- Resiliente: erro por cliente é logado e o job continua; erro fatal em uma plataforma não impede as outras; idempotente (upserts + incremental: última data − 3 dias). Exit 0 = ok (mesmo com erros pontuais); exit 1 = falha fatal.
- **Agendamento:** criar Scheduled Deployment no Replit com run `npm run sync:daily`, schedule `0 8 * * *` (05:00 BRT). Ver `docs/sync-cron.md`.
- **Credenciais** ficam no banco (`getIntegrationsConfig()`), com fallback para env. Renovar em Administração → Integrações.
- **Token Meta expira periodicamente** — quando vence, o sync da Meta falha com `Session has expired` e os dados de Meta param de atualizar. Renovar via app ou `scripts/update-meta-token.ts`.
- Endpoints HTTP (`/api/sync/*`, `/api/admin/sync-all`) seguem existindo para trigger manual/externo; em produção exigem `SYNC_CRON_TOKEN` (senão ficam sem auth).

### Sync sob demanda (ao abrir o cliente)
Mecanismo principal hoje (substitui o cron diário, que não roda no Replit sem Scheduled Deployment).
- Ao abrir um cliente (admin **ou** portal), o `ClienteDashboard` dispara em segundo plano `POST /api/clientes/[id]/sync?background=1` (fire-and-forget, não trava a página).
- **Throttle/trava no servidor:** `Cliente.ultimoSyncAt` + claim atômico (`prisma.cliente.updateMany` condicional, janela de 3h). Só sincroniza se os dados estiverem velhos; evita syncs duplicados/concorrentes entre instâncias (autoscale) e não martela as APIs. Toda atualização automática (mount + check de `lastFatoDate`) passa por esse caminho com `background: true` — nunca força.
- O `ultimoSyncAt` é marcado **no claim** (antes do sync). Tradeoff deliberado: se o sync falhar, não retenta por 3h (prioriza não martelar API que está falhando). O botão manual contorna isso.
- **Botão "Atualizar agora"** (chip de refresh, só admin / `!portalMode`): `POST /api/clientes/[id]/sync` sem `background` → força o sync ignorando o throttle.
- Limitações conhecidas: o sync por-cliente só atualiza o cliente aberto. A cobertura de "todos + alertas" é feita pelo disparo global abaixo. Endpoint de sync por cliente é público (sem auth) — hardening não aplicado por opção do usuário.

### Sync global "1x por dia ao abrir o painel" (todos + alertas)
Complementa o sync por-cliente: garante que **todas** as contas e os **alertas diários** rodem mesmo sem Scheduled Deployment, desde que alguém abra o painel admin no dia.
- Gatilho: no mount do `ClienteDashboard` **apenas em admin** (`!portalMode`), fire-and-forget `POST /api/sync/daily-global`. Guard de módulo (`dailyGlobalSyncFired`) → uma chamada por sessão; o portal do cliente **nunca** dispara isso.
- Endpoint `app/api/sync/daily-global/route.ts`: claim atômico global via modelo `SyncState` (singleton `id="global"`, campos `attemptAt`/`successAt`), depois `runDailySync()` e marca `successAt` só se `fatalCount === 0`.
  - `successAt` → janela de **20h** ("já rodou hoje", evita repetir).
  - `attemptAt` → trava curta de **30min** (evita disparos concorrentes; se falhar no meio, retenta após 30min em vez de prender o dia todo).
  - A requisição fica aberta enquanto o sync roda (mantém a instância autoscale viva). `maxDuration = 300`; se estourar, o desenho incremental/idempotente se completa nos disparos seguintes.
- Lógica compartilhada: `lib/sync/runDailySync.ts` (`runDailySync()`) é a **fonte única** da orquestração Meta→Google→GA4 + `runDailyAlerts`, usada tanto pelo endpoint quanto pelo `scripts/daily-sync.ts` (CLI / Scheduled Deployment).
- Limitação aceita: se ninguém abrir o painel admin no dia, não roda; em dias de pouco acesso o "todos" pode se completar ao longo de 2–3 acessos. Para garantia absoluta independente de acesso, só Scheduled Deployment / servidor sempre-ligado.

## Metrics / Data Layer

### `outcomeCountForFato` (`lib/metrics/fatoMidiaOutcome.ts`)
Core function used everywhere to compute "leads" (primary result metric).
- Uses `Math.max(leads, conversoes)` for all canals — captures e-commerce purchases (conversoes) for META and primary conversions for GOOGLE that previously showed zero because only `leads` was used
- Optional `conversas` param (messagingConversationsStarted) available as fallback but NOT passed at home page or summary level to avoid mixing messaging metrics with lead/purchase counts
- Messaging-only clients (Clinica e Spa, Dr. Fernando, etc.) show "SEM DADOS" on the home overview intentionally — their metric is `custoPorConversa`, shown in their individual dashboards

### Google Ads Mapper (`lib/mappers/googleAdsToDomain.ts`)
- Uses `metrics.conversions` only (NOT `metrics.all_conversions`) — PMax was inflating with view-through events
- `fetchPurchaseConversions` targets only PURCHASE category conversion actions

## Design System (InOut Standard)

### Section Headers
Orange accent bar before section titles:
```tsx
<div className="flex items-start gap-3">
  <div className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[var(--primary)]" />
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Sublabel</p>
    <h2 className="text-xl font-extrabold tracking-tight text-[var(--foreground)]">Title</h2>
  </div>
</div>
```

### KPI Cards
Cards with orange hover glow effect:
```tsx
<div className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all hover:border-[color-mix(in_srgb,var(--primary)_20%,var(--border))]">
  <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--primary)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.05]" />
  ...
</div>
```

### Primary Color
`#ff6a00` (Inout Orange) accessed via `var(--primary)`.

### Responsive Patterns
- Tables: always `overflow-x-auto` wrapper + `min-w-[NNNpx]` on the table
- Modals: `flex-col md:flex-row` for stacking on mobile
- Channel tabs: `px-3 py-2 sm:px-4` for smaller touch targets on mobile
- Decision strip: `grid-cols-2 sm:grid-cols-4` with `divide-x divide-y divide-[var(--border)] sm:divide-y-0`
