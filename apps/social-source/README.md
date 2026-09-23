# Central de Clientes Inout

Hub consolidado de performance comercial. Exibe dados de clientes a partir de planilhas Google Sheets (atualizadas diariamente pelo Adveronix) e persiste no PostgreSQL para análises.

## Stack

- **Next.js 15** (App Router, TypeScript)
- **PostgreSQL** (Docker local, banco `inout_central`)
- **Prisma** (ORM)
- **Google Sheets API** (Service Account) para sincronização
- **Tailwind CSS** + tema escuro (laranja/vermelho)
- **Recharts** para gráficos
- **TanStack Query** para dados no frontend

## Pré-requisitos

- Node.js 18+
- PostgreSQL (local ou Docker)
- Conta Google Cloud com Service Account (para sync das planilhas)

## Configuração

1. **Clone e instale dependências**

   ```bash
   npm install
   ```

2. **Banco de dados**

   - **Docker**: `docker compose up -d` sobe o Postgres (usuário `postgres`, senha `admin`, banco `inout_central`).
   - Crie `.env` na raiz (ou copie de `.env.example`) com:
     ```env
     DATABASE_URL="postgresql://postgres:admin@localhost:5432/inout_central?schema=public"
     ```
   - **Importante**: a senha do banco é configurada apenas via `DATABASE_URL`; nunca hardcode no código.

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

3. **Variáveis de ambiente (opcionais)**

   - `GOOGLE_CLIENT_EMAIL` e `GOOGLE_PRIVATE_KEY`: Service Account para ler Google Sheets.
   - `SYNC_CRON_TOKEN`: token para proteger o endpoint de sync (cron ou manual). **Em produção** é obrigatório para o sync diário; na Vercel defina também `CRON_SECRET` com o mesmo valor. Ver [docs/sync-cron.md](docs/sync-cron.md).
   - `ADMIN_SECRET`: token para acessar a área `/admin/clientes`.

4. **Google Sheets**

   - Compartilhe cada planilha com o e-mail do Service Account (visualizador).
   - Formato esperado (padrão Swiss_Park): primeira aba com colunas Day, Impressions, Amount Spent, Link Clicks, On-Facebook Leads, etc. (A:I).

## Desenvolvimento

```bash
npm run dev
```

Acesse:

- **Home**: http://localhost:3000
- **Central de Clientes**: http://localhost:3000/clientes
- **Administração**: http://localhost:3000/admin/clientes

## Sync das planilhas

Os dados são lidos das planilhas Google e gravados no Postgres.

- **Manual (todos os clientes)**:
  ```bash
  curl -X POST http://localhost:3000/api/sync/google-sheets \
    -H "x-cron-token: SEU_SYNC_CRON_TOKEN"
  ```
- **Um cliente**:
  ```bash
  curl -X POST http://localhost:3000/api/sync/google-sheets \
    -H "Content-Type: application/json" \
    -H "x-cron-token: SEU_SYNC_CRON_TOKEN" \
    -d '{"clienteId": "id-do-cliente"}'
  ```

### Sync diário às 07h (Brasília)

A rotina que atualiza planilhas → base (e mantém os dashboards atualizados) está documentada em **[docs/sync-cron.md](docs/sync-cron.md)**.

- **Vercel:** o projeto já inclui `vercel.json` com cron às 07:00 BRT. Defina `SYNC_CRON_TOKEN` e `CRON_SECRET` (mesmo valor) nas variáveis de ambiente.
- **Outro host:** use crontab ou o script `scripts/run-sync.sh`; ver exemplos e detalhes em `docs/sync-cron.md`.

## Administração

Em **Administração** > **Clientes** você pode:

- Cadastrar novo cliente (nome e **link da planilha**).
- O sistema extrai o ID da planilha do link e cria a configuração padrão (range A:I, canal META).
- O dashboard padronizado fica disponível em **Ver diagnóstico** para esse cliente após o primeiro sync.

## Estrutura do projeto

- `app/` – rotas e páginas (Next.js App Router)
- `app/api/` – API Routes (clientes, sync, admin, pautas)
- `components/` – UI (layout, cards, clientes)
- `lib/` – db (Prisma), google (Sheets), sync, mappers, repositories, admin
- `config/` – env (Zod)
- `prisma/` – schema e migrações

## Scripts

- `npm run dev` – servidor de desenvolvimento (porta **5000**)
- `npm run build` – build de produção
- `npm run start` – servidor de produção (porta **5000**)
- `npm run db:migrate` – aplicar migrações
- `npm run db:generate` – gerar Prisma Client
- `npm run db:studio` – abrir Prisma Studio

## Deploy na VPS (Debian)

Guia completo: [docs/deploy-vps.md](docs/deploy-vps.md)

Repositório: [github.com/raulinsonsouza-maker/central_v2](https://github.com/raulinsonsouza-maker/central_v2)
