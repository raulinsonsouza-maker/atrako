# Sync diário — Meta Ads, Google Ads e GA4

Este documento descreve a rotina de sincronização diária que busca os dados de Meta Ads, Google Ads e GA4 na API de cada plataforma e persiste no banco, mantendo os dashboards atualizados todos os dias.

## VPS Debian (produção recomendada)

Na VPS (`hub.prospectads.com.br`), use **crontab** + script [`scripts/cron-sync-vps.sh`](../scripts/cron-sync-vps.sh).

### Configurar (uma vez)

```bash
cd /var/www/central-inout
chmod +x scripts/cron-sync-vps.sh

# Teste manual (ver log em tempo real)
./scripts/cron-sync-vps.sh
tail -50 /var/log/central-sync.log

# Agendar 05:00 BRT (08:00 UTC) — adiciona linha, não apaga as existentes
crontab -e
```

Linha para colar no crontab:

```cron
0 8 * * * /var/www/central-inout/scripts/cron-sync-vps.sh
```

Conferir:

```bash
crontab -l | grep central-inout
```

### Pré-requisitos

- `.env` com `DATABASE_URL` válido em `/var/www/central-inout`
- Credenciais Meta / Google Ads / GA4 no banco (**Admin → Integrações**) ou no `.env`
- **Token Meta:** renovar quando expirar (sync da Meta para de atualizar)

### Logs

```bash
tail -f /var/log/central-sync.log
```

O job imprime resumo `📊 RESUMO` no fim quando conclui. Exit 0 = ok (mesmo com erros pontuais por cliente).

### Execução manual (sem cron)

```bash
cd /var/www/central-inout
npm run sync:daily

# Re-sync de um período (YYYY-MM-DD)
npm run sync:daily 2026-01-01 2026-06-24
```

Deploy completo: [deploy-vps.md](./deploy-vps.md).

---

## ⚠️ Legado Replit

A aplicação está publicada no **Replit** (deployment autoscale em `https://central-inout.replit.app`).
Os Cron Jobs definidos em `vercel.json` **só funcionam quando o deploy é na Vercel** — no Replit eles são ignorados e **nunca disparam**. Por isso a atualização automática precisa ser feita por um **Scheduled Deployment** do Replit (cron nativo da plataforma).

O `vercel.json` é mantido apenas como referência/fallback caso o projeto seja migrado para a Vercel no futuro.

---

## ✅ Caminho recomendado — Scheduled Deployment no Replit

A forma robusta e oficial de agendar a sincronização no Replit é um **Scheduled Deployment** que executa o script `scripts/daily-sync.ts`.

### Por que o script direto (e não chamar os endpoints HTTP)?

O script `npm run sync:daily` roda a lógica de sync **direto contra o banco**, e isso é muito mais confiável do que disparar os endpoints HTTP:

- **Sem token** — não depende de `SYNC_CRON_TOKEN` configurado corretamente.
- **Sem cold-start** — não acorda o autoscale nem sofre com o tempo de inicialização.
- **Sem limite de 300s** — não esbarra no `maxDuration` das funções serverless; o job pode levar quantos minutos forem necessários.
- **Resiliente** — Meta, Google Ads e GA4 rodam em sequência (evita estourar rate limits); erro em um cliente é logado e o job continua nos demais; erro fatal em uma plataforma não impede as outras.
- **Idempotente** — usa upserts e sync incremental (última data registrada − 3 dias), então rodar de novo é seguro.

### Como configurar (uma vez)

1. No painel do Replit, abra **Deployments** → **Create Deployment** → escolha o tipo **Scheduled**.
2. Configure:
   - **Build command:** `npm install`
   - **Run command:** `npm run sync:daily`
   - **Schedule:** todos os dias às **08:00 UTC** (= **05:00 horário de Brasília**). Em cron: `0 8 * * *`.
   - **Timeout:** algo folgado (ex.: 30 minutos) — o job sincroniza todas as contas em sequência.
3. Publique. A partir daí o Replit executa o script automaticamente todo dia no horário definido.

### Execução manual

```bash
# Sync incremental de todas as plataformas + alertas (o mesmo que o cron roda)
npm run sync:daily

# Forçar re-sync de um período específico (YYYY-MM-DD)
npm run sync:daily 2026-01-01 2026-06-05
```

O script imprime um resumo por plataforma e retorna exit code 0 (sucesso, mesmo com erros pontuais por cliente) ou 1 (falha fatal — aparece como deployment "failed" no Replit).

---

## 🔑 Credenciais (tokens das APIs)

As credenciais das integrações ficam **no banco** (tabela de configuração de integrações, lida por `getIntegrationsConfig()`), com fallback para variáveis de ambiente. Renove-as pela área de **Administração → Integrações** do app.

> **Atenção — tokens da Meta expiram.** O `META_ACCESS_TOKEN` é de vida curta/limitada e precisa ser renovado periodicamente. Quando ele expira, o sync da Meta passa a falhar com `Error validating access token: Session has expired` (os dashboards param de atualizar os dados de Meta). Gere um novo token de longa duração no Meta e atualize-o pelo app (ou via `META_ACCESS_TOKEN=<token> npx tsx scripts/update-meta-token.ts`).

---

## Horário e timezone

| Sync | Horário recomendado | Cron (UTC) |
|------|---------------------|------------|
| Job diário (Meta + Google + GA4 + alertas) | 05:00 BRT | `0 8 * * *` |

> O script faz tudo em uma única execução sequencial, então basta **um** agendamento.

---

## Operação

### Onde ver os logs

- **Replit:** Deployments → selecione o Scheduled Deployment → aba de logs de cada execução. Procure pelo resumo `📊 RESUMO` no fim do log.

### Como reexecutar o sync manualmente

1. **Pela aplicação:** em **Administração → Clientes**, use o botão **Sincronizar** do cliente desejado.
2. **Pelo terminal:** `npm run sync:daily` (todos) — ver exemplos acima.

### Resumo para a equipe

- **O quê:** Sync diário das APIs de Meta Ads, Google Ads e GA4 para o Postgres + alertas de gestão; os dashboards leem do banco, então ficam atualizados após cada sync.
- **Quando:** Todos os dias às **05:00 horário de Brasília** (08:00 UTC), via Scheduled Deployment do Replit.
- **Onde configurar:** Deployments do Replit (tipo Scheduled, comando `npm run sync:daily`).
- **Se os dados pararem de atualizar:** verifique (1) se o Scheduled Deployment está ativo e sem erro, e (2) se o token da Meta não expirou.

---

## Caminho alternativo — endpoints HTTP (Vercel ou cron externo)

Caso o app seja migrado para a Vercel ou você prefira um agendador externo (crontab, GitHub Actions), cada rota aceita **GET** e **POST**, autenticadas por `SYNC_CRON_TOKEN`:

| Sync | URL |
|------|-----|
| Meta Ads | `/api/sync/meta` |
| Google Ads | `/api/sync/google-ads` |
| GA4 | `/api/sync/analytics` |
| Tudo de uma vez (admin) | `POST /api/admin/sync-all` (header `x-admin-token: <ADMIN_SECRET>`) |

**Autenticação** (um dos formatos): header `x-cron-token: <token>`, header `Authorization: Bearer <token>`, ou query `?token=<token>` — todos validados contra `SYNC_CRON_TOKEN`.

> Defina `SYNC_CRON_TOKEN` em produção antes de expor esses endpoints; sem ele, as rotas de sync ficam **sem autenticação**.
