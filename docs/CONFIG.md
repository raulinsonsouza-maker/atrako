# Config central — fonte única

## Regra

Não existe config do CRM, integrações da Agenda ou MP do Commerce.  
Existe **`/config`**. Todo módulo **consome** via `getWorkspaceConfig(workspaceId)`.

## Rotas

| Path | Conteúdo |
|------|----------|
| `/config` | Home + checklist |
| `/config/empresa` | Nome, slug, timezone, moeda, logo, cores |
| `/config/membros` | Membership / convites |
| `/config/conexoes` | OAuth MP, Instagram, Ads, WhatsApp Cloud API |
| `/config/modulos` | `modulesEnabled` |
| `/config/financeiro` | Prefs do ledger |
| `/config/rastreamento` | Pixel Meta, CAPI |
| `/config/forms` | Defaults → CRM |
| `/config/notificacoes` | E-mail / WhatsApp notify |

## Dados

- `WorkspaceSettings` (1:1 com workspace/`Cliente`)
- `WorkspaceConnection` (N providers, `credentialsEnc`)

## API

- `GET/PATCH /api/atrako/config?workspaceId=`
- `GET/POST /api/atrako/connections`

## Resolve helpers

```ts
getWorkspaceConfig(workspaceId)
resolveMercadoPago(workspaceId)
resolveInstagram(workspaceId)
resolveWhatsApp(workspaceId)
resolveBrand(workspaceId)
resolveTracking(workspaceId)
```

## Quem bebe da fonte

| Módulo | Lê |
|--------|-----|
| Insights | Ads connections, timezone |
| Financeiro | moeda, prefs |
| LPs / Checkout | brand, MP, pixel |
| Forms | brand, destino CRM |
| Agenda | brand, MP, timezone |
| Social | Instagram connection |
| WhatsApp | WABA / phone_number_id (Cloud API) |
| CRM | membros; sem tela de integração própria |

## Proibido

Credenciais, brand global ou pixel só dentro de um módulo.
