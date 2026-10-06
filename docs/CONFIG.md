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
| `/config/modulos` | Liga/desliga módulos do workspace (ver [Módulos](#módulos)) |
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

## Módulos

Fonte única: `apps/atrako/lib/modules/registry.ts` (`MODULES`). Sidebar, Criar, Conexões, guards e telas de config leem dali.

### Duas camadas

1. **Release global** — staff Atrako em `/admin/modulos` (tabela `PlatformModule`): `AVAILABLE` (Disponível) · `BETA` · `HIDDEN` (Oculto). Sem linha no banco → `defaultRelease` do registry.
2. **Escolha do workspace** — owner/admin em `/config/modulos` (`WorkspaceSettings.modulesEnabled`, JSON só com escolhas **explícitas**, ex. `{ "agenda": false }`).

### Resolução (`resolveModuleState`)

| Situação | Resultado |
|---|---|
| `core: true` (Leads, Insights) | Sempre ligado, sem switch |
| `HIDDEN` | Desligado para todos; staff ADMIN real vê em modo **preview** (banner) |
| Escolha explícita do workspace | Vale a escolha |
| Sem escolha + `AVAILABLE` | Ligado |
| Sem escolha + `BETA` | Desligado (opt-in) |

`GET /api/atrako/config` devolve `modules` (mapa resolvido) + `canManage`. Client: `useModules()` (`hooks/useModules.ts`). PATCH passa por `sanitizeModulesPatch` (rejeita chave desconhecida, core e `HIDDEN`).

### Módulo desligado = some + bloqueia

- **UI**: some da sidebar, do Criar (`criarPlatforms` / `criarModules`) e de `/config/conexoes` (`connectionCategories` / `connectionProviders`).
- **Páginas**: `layout.tsx` com `<ModuleGate moduleKey="…">` → tela "Módulo desativado".
- **APIs autenticadas**: `requireModuleApi(workspaceId, key)` → 403 `{ error: "module_disabled" }`.
- **Rotas públicas** (booking, checkout, forms públicos): `isPublicModuleEnabled(clienteId, key)` → 404 / `PublicUnavailable`.
- **Agente**: `agentTools` (prefixos) → tool bloqueada se o módulo estiver off.
- Webhooks e links de gestão já emitidos (ex. `agenda/manage/[token]`) **não** são bloqueados.

### Checklist — novo módulo

1. Entrada em `MODULES` (`registry.ts`): `key`, `label`, `icon`, `defaultRelease` (comece em `HIDDEN`), `nav`, `routes`, `apiPrefixes`, `disableWarning`.
2. Mapear `criarPlatforms` / `criarModules`, `connectionCategories` / `connectionProviders`, `agentTools`.
3. `app/<rota>/layout.tsx` com `ModuleGate` (e nas rotas `app/criar/<modulo>` se houver).
4. `requireModuleApi` em toda rota de API autenticada do módulo; `isPublicModuleEnabled` nas públicas.
5. Liberar: `/admin/modulos` → `BETA` (opt-in) → `AVAILABLE`.

## Proibido

Credenciais, brand global ou pixel só dentro de um módulo.  
Flag de módulo fora do registry (`if (workspace.x)` solto, env por módulo, segundo catálogo).
