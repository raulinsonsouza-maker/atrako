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

## Providers

| Provider | Uso | Doc oficial |
|----------|-----|-------------|
| Meta Graph API | Ads insights, Pixel/CAPI | https://developers.facebook.com/docs/graph-api |
| Instagram Graph | Conta IG, inbox, comment→DM | https://developers.facebook.com/docs/instagram-api |
| WhatsApp Cloud API | Inbox, templates, CRM→checkout/agenda | https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform |
| Mercado Pago | OAuth vendedor, pagamentos, webhooks | https://www.mercadopago.com.br/developers/pt/docs |
| Mercado Livre | OAuth vendedor, pedidos → CRM + aba Marketplaces | https://developers.mercadolivre.com.br/pt_br/guia-para-produtos |
| WooCommerce | REST keys, pedidos → CRM + aba E-commerce + atribuição | https://woocommerce.github.io/woocommerce-rest-api-docs/ |
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
ATRAKO_CONNECTIONS_SECRET=
ATRAKO_DEV_OPEN_ACCESS=   # só local; default off = login obrigatório
```

Depois do seed, edite em `/admin/apps` — não espalhe secrets em módulos.

## WorkspaceConnection.provider

`MERCADO_PAGO` | `MERCADO_LIVRE` | `INSTAGRAM` | `META_ADS` | `GOOGLE_ADS` | `LINKEDIN_ADS` | `WHATSAPP` | `WOOCOMMERCE` | `GOOGLE_CALENDAR`

## Fluxo

1. Staff configura app em `/admin/apps`.
2. Cria cliente + convite OWNER em `/admin/clientes`.
3. Dealer aceita convite (`/invite`) e conecta contas em `/config/conexoes`.
4. Sync/dashboard/CRM consomem resolves canônicos.
