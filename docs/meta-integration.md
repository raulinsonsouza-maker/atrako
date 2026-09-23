# Meta Ads — Facebook Login for Business

Integração self-service estilo Tray: cada workspace conecta o próprio Business Portfolio sem colar token ou ID manualmente.

## Fluxo do usuário

1. `/config/conexoes` → escolher empresa → **Conectar Meta**
2. Meta abre Facebook Login for Business (`config_id`) → seleção de portfólio empresarial
3. Callback no Atrako troca o `code` por token (só no backend)
4. Se houver **1** conta de anúncio → seleciona e dispara sync automaticamente  
   Se houver **N** → `PillSelect` + Continuar
5. Dashboard do cliente usa `resolveMetaCredentials` → sync + live ads/saldo

## Variáveis de ambiente

```
META_APP_ID=
META_APP_SECRET=
META_LOGIN_CONFIG_ID=          # App Dashboard → Facebook Login for Business → Configuration
META_GRAPH_API_VERSION=v26.0
META_OAUTH_REDIRECT_URI=https://SEU_DOMINIO/api/atrako/oauth/meta/callback
ATRAKO_CONNECTIONS_SECRET=     # AES credentialsEnc
```

Nunca expor `META_APP_SECRET` no frontend. Nunca logar access token / appsecret_proof / code.

## Meta App Dashboard (checklist)

1. App tipo **Business**
2. Produto **Facebook Login for Business**
3. Configuration (variation General) com token **System User / Business Integration (SUAT)**
4. Assets: Ad accounts (+ Pages se Lead Ads)
5. Permissions sugeridas na config: `business_management`, `ads_read`, **`ads_management`** (obrigatório para criar campanhas), `leads_retrieval`, pages (`pages_show_list`, `pages_read_engagement` / `pages_manage_ads`)
6. Valid OAuth Redirect URIs = `META_OAUTH_REDIRECT_URI`
7. Antes de clientes reais: App **Live**, Business Verification, **Advanced Access**, **Tech Provider Access Verification**, Marketing API Access Tier (Limited → Full)

## Campaign Builder (`/criar/campanha-meta`)

Wizard no hub **Criar** (card “Campanha Meta”) para publicar Campaign → AdSet → Creative → Ad **sempre PAUSED**.

### Fluxo

1. Escolher empresa + conta de anúncio (Meta `ready` em `/config/conexoes`)
2. Objetivo UI → `OUTCOME_*` (`lib/integrations/meta/campaign-builder/objective-config.ts`)
3. Conjuntos (orçamento em centavos via `toMetaBudget`), público, destino, criativos (imagem 1:1 + 9:16 / vídeo / carrossel / post existente)
4. Validar → criar na Meta → IDs em `MetaCampaignBuilder` / `MetaBuilderAdSet` / …
5. Ativar ou pausar com ação explícita (`POST .../campaigns/:id/status`)

### Posicionamentos (fixos)

Só **Facebook** e **Instagram**:

- Feeds: Feed do Facebook, Feed do Instagram  
- Stories e Reels: Instagram Stories, Facebook Stories, Instagram Reels, Facebook Reels  

Nunca Audience Network, Messenger ou outros. Payload Graph sempre `publisher_platforms` + positions manuais (`placements-config.ts`).

### Criativos

| Tipo | Entrada | Graph |
|------|---------|-------|
| Imagem | upload **1:1** (Feed) + **9:16** (Stories/Reels), crop centro | `asset_feed_spec` + customization rules |
| Vídeo | URL pública → `advideos` + poll → `video_id` | `object_story_spec.video_data` |
| Carrossel | ≥2 cards com `image_hash` | `link_data.child_attachments` |
| Post existente | `object_story_id` (`pageId_postId`) | creative com `object_story_id` |

### APIs

| Método | Path |
|--------|------|
| GET | `/api/atrako/meta/builder/bootstrap?workspaceId=` |
| GET | `/api/atrako/meta/builder/targeting-search?workspaceId=&q=` |
| POST | `/api/atrako/meta/builder/upload-image` |
| POST | `/api/atrako/meta/builder/upload-video` |
| POST | `/api/atrako/meta/campaign-builder` (`validate` \| `save` \| `create` \| `retry`) |
| GET | `/api/atrako/meta/campaign-builder?workspaceId=` |
| POST | `/api/atrako/meta/campaigns/:id/status` (`activate` \| `pause`) |

Idempotência: `creationRequestId`. Retry não duplica Campaign/AdSet já criados. Logs em `MetaApiLog` (sem tokens).

## Endpoints Atrako (conexão)

| Método | Path | Função |
|--------|------|--------|
| GET | `/api/atrako/oauth/meta/start?workspaceId=` | State CSRF + redirect Meta |
| GET | `/api/atrako/oauth/meta/callback` | Exchange code + discover assets |
| GET | `/api/atrako/meta/connection?workspaceId=` | Status sem token |
| POST | `/api/atrako/meta/select-ad-account` | Valida ID + upsert `Conta` META |
| POST | `/api/atrako/meta/sync` | Re-descobre assets |

## Persistência

- Token: `WorkspaceConnection` provider `META_ADS` (`credentialsEnc` AES)
- Conta ativa: `Conta` (`plataforma=META`, `accountIdPlataforma`)
- Metadata: business, adAccounts, pages, `selectedAdAccountId`, `health`

`resolveMetaCredentials(clienteId)` ordem:

1. WorkspaceConnection META_ADS  
2. ConexaoIntegracao (legado)  
3. SystemConfig / env (legado global)

## Código

- OAuth / Graph: `apps/atrako/lib/integrations/meta/`
- Bridge Conta: `lib/integrations/meta/connection.ts`
- Sync: `lib/sync/metaApiSync.ts` (falhas isoladas por cliente; `needs_reauth`)

## Troubleshooting

| Sintoma | Causa provável |
|---------|----------------|
| 503 META_LOGIN_CONFIG_ID | Env ausente |
| Tela Meta não lista BM | User sem acesso / config assets |
| Dash vazio após conectar | Conta não selecionada / sync ainda rodando |
| `needs_reauth` | Token revogado em Business Settings → Connected apps |
| Erro 270 | Marketing API Access Tier insuficiente |
| 429 | Rate limit da **app** (compartilhado entre tenants) |
| Create falha sem write | App sem `ads_management` no Login for Business config |

### Campaign Builder — permissões

No config Login for Business (SUAT / `META_LOGIN_CONFIG_ID`), confirmar:

- `ads_management` (write — criar Campaign/AdSet/Creative/Ad)
- `business_management`
- Pages / Instagram assets
- `leads_retrieval` se objetivo LEADS

Sem `ads_management` o wizard valida no Atrako mas o POST Graph falha em produção.

## Produção

- HTTPS obrigatório no redirect
- Data deletion callback / política de privacidade no App Dashboard
- Monitorar erros 190 / 270 / 429 nos logs estruturados (`meta_oauth_*`, `meta_api_error`)
