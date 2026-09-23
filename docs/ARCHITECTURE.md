# Arquitetura técnica do Atrako

## Produto

O **Atrako** é a plataforma SaaS de inteligência comercial: **uma URL, um login, um banco, um deploy**.  
Objetivo: aumentar faturamento conectando aquisição, jornada e receita por **empresa (workspace)**.

## Decisão (destino)

- **1 Next.js** — `apps/atrako` (porta 5000 / 443)
- **1 PostgreSQL** — multi-tenant por `workspaceId` (`Cliente.id` ≡ workspace)
- **1 Auth** — sessão Atrako + Membership por workspace
- **Config central** (`/config`) — única fonte de marca, conexões, módulos, tracking
- **Sem iframe** entre módulos — CRM, Agenda, Commerce, Social, Financeiro, Forms nativos
- Apps legados (`apps/crm`, `agenda`, `commerce`, `social-source`) são **fonte de migração** até remoção

## Layout

```
Atrako/
  apps/atrako/          # Único app web
  packages/
    events/             # Contratos de jornada
    db/                 # Schema canônico (evolução)
    agent/              # Tools do agente
  docs/
    ARCHITECTURE.md
    ROUTES.md
    CONFIG.md
    INTEGRATIONS.md
    ENGINEERING.md
```

## Camadas

1. **Config** — settings + connections do workspace  
2. **Data** — leads, bookings, orders, ledger, ads  
3. **Operação** — CRM, Agenda, Commerce, Social, Forms  
4. **Inteligência** — insights, atribuição, agente  
5. **Interface** — rotas nativas + sidebar única  

## Tenant

`Cliente.id` = `workspaceId` em eventos e FKs.  
Ver `CONFIG.md` e `packages/db/WORKSPACE_MAPPING.md`.

## Jornada

`tracking.*` → `lead.*` → `conversation.*` → `booking.*` → `checkout.*` / `payment.*` → `revenue.recorded`  
Bridge: `POST /api/atrako/events` (+ bus in-process).

## Deploy

```bash
npm run dev -w @atrako/shell   # único processo web local
# produção: docker compose up  (web + postgres [+ worker WA opcional])
```

## Docs relacionadas

- [ROUTES.md](./ROUTES.md) — mapa de páginas  
- [CONFIG.md](./CONFIG.md) — fonte única de configuração  
- [INTEGRATIONS.md](./INTEGRATIONS.md) — Meta, IG, MP, Google  
- [ENGINEERING.md](./ENGINEERING.md) — padrões de código e segurança  
