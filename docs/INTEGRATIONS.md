# Integrações Atrako

Tokens de **cliente** vivem em `WorkspaceConnection` (criptografados), conectados em `/config/conexoes`.  
Credenciais de **app** (client id/secret) ficam no `.env` da plataforma.

Código: `apps/atrako/lib/integrations/`.

**Hub único:** todas as conexões (ads, WhatsApp, ML, e-commerces) ficam em `/config/conexoes`.

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

## Env de plataforma

```
MP_CLIENT_ID=
MP_CLIENT_SECRET=
ML_CLIENT_ID=
ML_CLIENT_SECRET=
ML_REDIRECT_URI=          # opcional; default /api/atrako/oauth/mercadolivre/callback
META_APP_ID=          # ou SYMBIUS_IG_APP_ID
META_APP_SECRET=      # assinatura webhooks IG + WhatsApp
META_LOGIN_CONFIG_ID= # Facebook Login for Business (obrigatório p/ Meta Ads hub)
META_GRAPH_API_VERSION=v26.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=  # opcional (fallback; preferir token por workspace)
ATRAKO_CONNECTIONS_SECRET=   # AES para credentialsEnc
```

## WorkspaceConnection.provider

`MERCADO_PAGO` | `MERCADO_LIVRE` | `INSTAGRAM` | `META_ADS` | `GOOGLE_ADS` | `LINKEDIN_ADS` | `WHATSAPP` | `WOOCOMMERCE`

### WHATSAPP credentialsEnc

- `accessToken` — token permanente da Cloud API  
- `phoneNumberId` — ID do número de negócio  
- `wabaId` — WhatsApp Business Account (templates)  
- `webhookVerifyToken` — token do challenge GET  

Metadata: `phoneNumberId`, `displayPhoneNumber` (roteamento do webhook).

Webhook: `GET/POST /api/webhooks/whatsapp` (`object: whatsapp_business_account`).

### MERCADO_LIVRE credentialsEnc

- `accessToken` / `refreshToken` — OAuth (refresh one-time; client persiste o novo)  
- `userId` — seller id ML  
- `expiresAt` — ISO do access token (~6h)

Metadata: `meliUserId` (roteamento do webhook de notificações).

Fluxo: `/config/conexoes` → Conectar → OAuth ML (igual Mercado Pago) → callback.

Webhook: `POST /api/webhooks/mercadolivre` (tópico `orders_v2`) → `MarketplaceOrder` + `upsertPersonAndLead` (`source: mercadolivre`).

Dashboard: aba **Marketplaces** no cliente (`/clientes/[id]`) com sub-aba Mercado Livre (Shopee/Magalu em breve).

KPIs: pedidos, GMV, ticket, taxas ML, frete, margem líquida (GMV − fees − frete), top produtos, status, modalidade de envio (Full/Flex/ME).

Seller snapshot: reputação + visitas 30d (`MarketplaceSellerSnapshot`, refresh a cada ~6h).

Comprador no CRM: cada pedido cria/atualiza `NativeContact` + `NativeLead` (`source: mercadolivre`). Pedido `paid`/`confirmed` → **Ganho** + `marketingEligible`.

Webhooks: `orders_v2` + `shipments`.

**Fora do MVP:** perguntas/Q&A e Ads no ML.

### WOOCOMMERCE credentialsEnc

- `storeUrl` — URL da loja (`https://loja.com`)  
- `consumerKey` / `consumerSecret` — REST API keys (Read/Write)  
- `webhookSecret` — secret HMAC do webhook Woo  

Metadata: `storeUrl`, `storeName`.

Fluxo: `/config/conexoes` → seção E-commerce → WooCommerce → valida `GET /wp-json/wc/v3/orders?per_page=1`.

Webhook: `POST /api/webhooks/woocommerce/{workspaceId}` (topics `order.created` / `order.updated`) → `MarketplaceOrder` provider `WOOCOMMERCE` + lead (`source: woocommerce`) + atribuição Symbius se existir `Organization.centralClienteId = workspaceId`.

Dashboard: aba **E-commerce** (`/clientes/[id]`) — KPIs + pedidos. API: `GET /api/clientes/{id}/ecommerce`.

### Shopify / Tray / Nuvemshop (atribuição)

Secrets em `IgOrgSettings.ecommerceConnectors`, configurados no mesmo hub `/config/conexoes` (seção E-commerce).  
Requer org Symbius com `centralClienteId` = workspace.  
Endpoints: `/api/v1/connectors/{shopify|tray|nuvemshop}/[organizationId]`.

## Versão Graph

Constante única: `META_GRAPH_VERSION` em `lib/integrations/meta/graph.ts` (default `v26.0`).

## Meta Ads (Login for Business)

Ver guia completo: [meta-integration.md](./meta-integration.md).

Fluxo: `/config/conexoes` → OAuth com `META_LOGIN_CONFIG_ID` → seleção de ad account → `Conta` + `resolveMetaCredentials`.

## Fluxo

1. Admin conecta em `/config/conexoes` (OAuth ou formulário).  
2. Token salvo em `credentialsEnc` (ou `ecommerceConnectors` para Shopify/Tray/Nuvemshop).  
3. Módulo chama `resolveMercadoPago` / `resolveMercadoLivre` / `resolveInstagram` / `resolveWhatsApp` / `resolveMetaCredentials` / `wcFetch`.  
4. Nunca duplicar client HTTP fora de `lib/integrations/`.
