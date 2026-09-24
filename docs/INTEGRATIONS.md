# Integrações Atrako

## Lei (fonte única)

| Camada | Onde | O quê |
|--------|------|--------|
| **App da plataforma** | `/admin/apps` → model `PlatformApp` | client id/secret, Login Config, developer token, HMAC webhooks, GA4 SA |
| **Conta do dealer** | `/config/conexoes` → `WorkspaceConnection` | Tokens OAuth / keys da loja por `clienteId` |
| **IDs de mídia** | `Conta.accountIdPlataforma` | act_, CID, etc. (espelho do hub) — **sem** access token |

Resolve: `resolvePlatformApp(provider)` + `getWorkspaceConnection` / `resolveMetaCredentials` / `resolveGoogleAdsCredentials` (hub-first, dual-read legado).

**Proibido:** segunda central em commerce/agenda/CRM; colar token de dealer no admin; `process.env.*_CLIENT_*` direto nas rotas após seed.

Código: `apps/atrako/lib/integrations/`, `lib/config/platformApps.ts`, `lib/atrako/workspace-connections.ts`.

**Hub único:** `/config/conexoes`. Staff apps: `/admin/apps`.

## OAuth no hub (popup)

Conectar OAuth **não** navega a tab do hub. Padrão obrigatório para providers atuais e futuros:

1. UI: `useOAuthPopup` / `openOAuthPopup` → `window.open(startUrl)` + overlay “aguardando”.
2. Start: `/api/atrako/oauth/<provider>/start?workspaceId=`.
3. Callback API: após trocar o code, redirect para `/config/conexoes/oauth-complete?...` (não direto ao hub).
4. Bridge: se `window.opener` → `postMessage({ type: "atrako-oauth", ... })` + `close`; senão → `/config/conexoes` (same-tab / popup bloqueado).
5. Hub: invalida `workspace-connections` (+ Meta status) e mostra banner.

Helpers: `lib/oauth/openOAuthPopup.ts`, `lib/oauth/oauthCompleteRedirect.ts`, `hooks/useOAuthPopup.ts`.  
Forms manuais só onde a plataforma exige chave (ex.: WooCommerce). WhatsApp e Ads: só OAuth oficial (popup). WhatsApp usa Embedded Signup (`/config/conexoes/whatsapp-auth` + Login Config ID WhatsApp em Meta). Shopify: OAuth popup com domínio da loja (`/api/atrako/oauth/shopify/start?workspaceId=&shop=`). Tray: OAuth popup com domínio da loja (`/api/atrako/oauth/tray/start?workspaceId=&store=`) — callback `https://atrako.com.br/api/atrako/oauth/tray/callback`; webhook app-level `https://atrako.com.br/api/webhooks/tray` (cadastrar via chamado Tray Desenvolvedores). Nuvemshop: OAuth popup (`/api/atrako/oauth/nuvemshop/start?workspaceId=`) — callback `https://atrako.com.br/api/atrako/oauth/nuvemshop/callback`; webhooks registrados na loja (`order/created|updated|paid|cancelled`). Shopee: OAuth popup (`/api/atrako/oauth/shopee/start?workspaceId=`) com Partner ID/Key em `/admin/apps`.

## Providers

| Provider | Uso | Doc oficial |
|----------|-----|-------------|
| Meta Graph API | Ads insights, Pixel/CAPI | https://developers.facebook.com/docs/graph-api |
| Instagram Graph | Conta IG, inbox, comment→DM | https://developers.facebook.com/docs/instagram-api |
| WhatsApp Cloud API | Inbox, templates, CRM→checkout/agenda | https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform |
| Mercado Pago | OAuth vendedor, pagamentos, webhooks | https://www.mercadopago.com.br/developers/pt/docs |
| Mercado Livre | OAuth vendedor, pedidos → CRM + aba Marketplaces | https://developers.mercadolivre.com.br/pt_br/guia-para-produtos |
| WooCommerce | REST keys, pedidos → CRM + aba E-commerce + atribuição | https://woocommerce.github.io/woocommerce-rest-api-docs/ |
| Shopify | OAuth Admin API, pedidos/clientes/produtos → CRM + E-commerce + financeiro | https://shopify.dev/docs/api/admin-graphql/latest |
| Tray | OAuth Tray Commerce, pedidos → CRM + E-commerce + financeiro; webhook app-level | https://developers.tray.com.br/#tray-api-plugin |
| Nuvemshop | OAuth Tiendanube, pedidos → CRM + E-commerce + financeiro | https://dev.nuvemshop.com.br/docs/erp-guide/authentication |
| Shopee | OAuth Open Platform V2, pedidos → CRM + Marketplaces + financeiro | https://open.shopee.com/developer-guide/4 |
| Google Ads / GA4 | Contas e sync | https://developers.google.com/google-ads/api |
| LinkedIn Ads | Sync campanhas | LinkedIn Marketing API |
| Google Calendar | Agenda | Google Calendar API |

## Env (seed → PlatformApp)

No boot/migrate, env popula `PlatformApp` se ainda vazio:

```
MP_CLIENT_ID=
MP_CLIENT_SECRET=
ML_CLIENT_ID=
ML_CLIENT_SECRET=
META_APP_ID=
META_APP_SECRET=
META_LOGIN_CONFIG_ID=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_REDIRECT_URI=
SHOPIFY_SCOPES=
SHOPEE_PARTNER_ID=
SHOPEE_PARTNER_KEY=
SHOPEE_REDIRECT_URI=
SHOPEE_API_BASE_URL=
TRAY_CONSUMER_KEY=
TRAY_CONSUMER_SECRET=
TRAY_REDIRECT_URI=
NUVEMSHOP_CLIENT_ID=
NUVEMSHOP_CLIENT_SECRET=
NUVEMSHOP_REDIRECT_URI=
NUVEMSHOP_SCOPES=
ATRAKO_CONNECTIONS_SECRET=
ATRAKO_DEV_OPEN_ACCESS=   # só local; default off = login obrigatório
```

Depois do seed, edite em `/admin/apps` — não espalhe secrets em módulos.

## WorkspaceConnection.provider

`MERCADO_PAGO` | `MERCADO_LIVRE` | `INSTAGRAM` | `META_ADS` | `GOOGLE_ADS` | `LINKEDIN_ADS` | `WHATSAPP` | `WOOCOMMERCE` | `SHOPIFY` | `SHOPEE` | `TRAY` | `NUVEMSHOP` | `GOOGLE_CALENDAR`

## Fluxo

1. Staff configura app em `/admin/apps`.
2. Cria cliente + convite OWNER em `/admin/clientes`.
3. Dealer aceita convite (`/invite`) e conecta contas em `/config/conexoes`.
4. Sync/dashboard/CRM consomem resolves canônicos.
