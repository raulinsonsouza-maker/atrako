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
Forms manuais só onde a plataforma exige chave (ex.: WooCommerce). WhatsApp e Ads: só OAuth oficial (popup). WhatsApp usa Embedded Signup (`/config/conexoes/whatsapp-auth` + Login Config ID WhatsApp em Meta). Shopify: OAuth popup com domínio da loja (`/api/atrako/oauth/shopify/start?workspaceId=&shop=`). Tray: OAuth popup com domínio da loja (`/api/atrako/oauth/tray/start?workspaceId=&store=`) — callback `https://atrako.com.br/api/atrako/oauth/tray/callback`; webhook app-level `https://atrako.com.br/api/webhooks/tray` (cadastrar via chamado Tray Desenvolvedores). Nuvemshop: OAuth popup (`/api/atrako/oauth/nuvemshop/start?workspaceId=`) — callback `https://atrako.com.br/api/atrako/oauth/nuvemshop/callback`; webhooks registrados na loja (`order/created|updated|paid|cancelled`). Shopee: OAuth popup (`/api/atrako/oauth/shopee/start?workspaceId=`) com Partner ID/Key em `/admin/apps`. TikTok Shop: OAuth popup (`/api/atrako/oauth/tiktok-shop/start?workspaceId=`) com App Key/Secret + Service ID em `/admin/apps` (`TIKTOK_SHOP`, separado do `TIKTOK` de Ads) — redirect `https://atrako.com.br/api/atrako/oauth/tiktok-shop/callback`; webhook `https://atrako.com.br/api/webhooks/tiktok-shop` (assinar `ORDER_STATUS_CHANGE` no Partner Center; HMAC no header `Authorization`).

### TikTok Shop

- App: Partner Center → Aplicativos e serviços (serviço personalizado, mercado Brasil). Authorize em `https://services.tiktokshop.com/open/authorize?service_id=…&state=…` (US: `services.us.tiktokshop.com`).
- Token: `auth.tiktok-shops.com/api/v2/token/get|refresh`; APIs em `open-api.tiktokglobalshop.com` (versão 202309) com `app_key`, `timestamp`, `sign`, `shop_cipher` + header `x-tts-access-token`.
- Escopos no app: Authorization (lojas / `shop_cipher`), Order, Product.
- Lista de IPs permitidos (se ativada): incluir o IP de saída do servidor.
- Código: `lib/integrations/tiktok-shop/*`; conexão `WorkspaceConnection.provider = TIKTOK_SHOP` (tokens + `shopCipher` em credentials; `shopId` em metadata para casar webhooks).

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
| TikTok Shop | OAuth Partner Center, pedidos/produtos → CRM + Marketplaces + financeiro; webhook ORDER_STATUS_CHANGE | https://partner.tiktokshop.com/docv2/page/about-partner-center-console |
| Google Ads / GA4 | Contas e sync | https://developers.google.com/google-ads/api |
| LinkedIn Ads | Sync campanhas | LinkedIn Marketing API |
| Google Calendar | Agenda | Google Calendar API |
| Resend | E-mail dos fluxos de relacionamento e campanhas (API key por loja) | https://resend.com/docs/api-reference |

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
TIKTOK_SHOP_APP_KEY=
TIKTOK_SHOP_APP_SECRET=
TIKTOK_SHOP_SERVICE_ID=
TIKTOK_SHOP_REDIRECT_URI=
TIKTOK_SHOP_AUTH_BASE_URL=   # default https://services.tiktokshop.com
TRAY_CONSUMER_KEY=
TRAY_CONSUMER_SECRET=
TRAY_REDIRECT_URI=
NUVEMSHOP_CLIENT_ID=
NUVEMSHOP_CLIENT_SECRET=
NUVEMSHOP_REDIRECT_URI=
NUVEMSHOP_SCOPES=
RESEND_API_KEY=           # só avisos internos/testes; lojas usam a própria key
RESEND_FROM=
ATRAKO_CONNECTIONS_SECRET=
ATRAKO_DEV_OPEN_ACCESS=   # só local; default off = login obrigatório
```

Depois do seed, edite em `/admin/apps` — não espalhe secrets em módulos.

## WorkspaceConnection.provider

`MERCADO_PAGO` | `MERCADO_LIVRE` | `INSTAGRAM` | `META_ADS` | `GOOGLE_ADS` | `LINKEDIN_ADS` | `WHATSAPP` | `WOOCOMMERCE` | `SHOPIFY` | `SHOPEE` | `TIKTOK_SHOP` | `TRAY` | `NUVEMSHOP` | `GOOGLE_CALENDAR` | `RESEND`

## Resend (e-mail de relacionamento)

- **PlatformApp `RESEND`** (`/admin/apps`): só fallback interno — avisos da equipe e envios de teste. Nunca usado para e-mail de cliente final.
- **WorkspaceConnection `RESEND`** (`/config/conexoes`): cada loja cola a própria API key (`re_…`, criptografada). O card lista os domínios da conta, escolhe remetente (`from`, `reply-to`) e cria o webhook.
- Ao escolher o domínio: `PATCH /domains/{id}` com `click_tracking: false` (o clique passa pelo nosso `/r/{token}`, com UTMs e atribuição) e `open_tracking: true`.
- **Webhook**: `POST /api/webhooks/resend/{workspaceId}`, assinatura svix com o `signing_secret` devolvido na criação (guardado na conexão). Eventos: `email.sent|delivered|delivery_delayed|opened|clicked|bounced|complained|failed` → `MessageDelivery` + `MessageEvent`; bounce permanente e spam viram supressão.
- **Backup do webhook**: o job `hourly` de `/api/atrako/flows/cron` reconcilia com `GET /emails`.
- **Limites**: throttle de ~2 req/s por API key e retry com backoff em 429/5xx (`Retry-After`) em `lib/integrations/resend/client.ts`; `Idempotency-Key` por envio.
- **Aquecimento**: campanhas respeitam o teto diário pela idade da verificação do domínio (200 → 500 → 1.000 → 2.500 → 5.000 → 10.000 → sem teto após ~6 semanas), em `warmupDailyCap`.
- Fluxos só enviam e-mail quando a loja tem Resend ativo com domínio verificado.

## Mídia (fechar o ciclo)

Em `/config/rastreamento` (`WorkspaceSettings.tracking`): `pixelId` + `capiToken` (Meta CAPI) e `ga4MeasurementId` + `ga4ApiSecret` (GA4 Measurement Protocol). Venda atribuída a fluxo/campanha envia `RecoveredPurchase` (CAPI) e `recovered_purchase` (GA4) — nomes próprios para não duplicar o `Purchase` do pixel da loja. Públicos (Perdidos, carrinhos, inativos, clientes para exclusão, VIP) saem em CSV com hash SHA-256 na aba Públicos de `/relacionamento`.

## WhatsApp: templates por loja

Templates vivem em `WaTemplateRef` por workspace (sync com a WABA, criação dos recomendados no estúdio de `/relacionamento`). Não existe mais `WHATSAPP_TEMPLATE_*` no env do shell: o envio legado de carrinho/boas-vindas/agenda só usa `templateName` vindo do evento ou texto/CTA dentro da janela de 24h.

## Fluxo

1. Staff configura app em `/admin/apps`.
2. Cria cliente + convite OWNER em `/admin/clientes`.
3. Dealer aceita convite (`/invite`) e conecta contas em `/config/conexoes`.
4. Sync/dashboard/CRM consomem resolves canônicos.
