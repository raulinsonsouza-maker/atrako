# Rotas do Atrako (app único)

## Público

| Rota | Função |
|------|--------|
| `/sign-in`, `/sign-up` | Auth |
| `/b/[workspaceSlug]` | Booking público |
| `/b/[workspaceSlug]/[pageSlug]` | Página de agenda |
| `/p/[pageSlug]` | Landing / oferta |
| `/checkout/[productId]` | Checkout |
| `/m/[token]` | Magic link |

## App autenticado

| Rota | Função |
|------|--------|
| `/` | Agente |
| `/onboarding` | Wizard (= Config guiado) |
| `/crm`, `/crm/leads`, `/crm/leads/[id]` | CRM |
| `/agenda`, `/agenda/calendario`, `/agenda/servicos` | Agenda |
| `/commerce`, `/commerce/produtos`, `/commerce/pedidos` | Commerce |
| `/social`, `/social/inbox`, `/social/flows` | Social |
| `/forms` | Formulários |
| `/finance` | Ledger |
| `/insights` | Mídia / atribuição |
| `/config` | Config central (home) |
| `/config/empresa` | Marca, slug, timezone |
| `/config/membros` | Convites / papéis |
| `/config/conexoes` | MP, IG, Ads |
| `/config/modulos` | Liga/desliga módulos |
| `/config/financeiro` | Prefs ledger |
| `/config/rastreamento` | Pixel / CAPI |
| `/config/forms` | Defaults forms → CRM |
| `/config/notificacoes` | Notificações |

## Plataforma (staff)

| Rota | Função |
|------|--------|
| `/admin` | Painel interno |
| `/admin/clientes` | Workspaces |
| `/admin/users` | Usuários plataforma |

## Legado (redirect)

`/modules/crm|agenda|commerce|social|finance|forms` → rotas nativas acima.  
`/admin/conexoes` → `/config/conexoes`.
