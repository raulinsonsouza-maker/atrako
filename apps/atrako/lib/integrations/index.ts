/**
 * Índice das integrações Atrako.
 *
 * Tokens de cliente: WorkspaceConnection via Config (`/config/conexoes`).
 * Nunca duplicar fetch HTTP de MP/Meta/IG/Google/ML fora desta pasta.
 *
 * Doc completa: docs/INTEGRATIONS.md
 *
 * Links oficiais:
 * - Meta Graph: https://developers.facebook.com/docs/graph-api
 * - Instagram: https://developers.facebook.com/docs/instagram-api
 * - Mercado Pago: https://www.mercadopago.com.br/developers/pt/docs
 * - Mercado Livre: https://developers.mercadolivre.com.br/pt_br/guia-para-produtos
 * - Google Ads: https://developers.google.com/google-ads/api
 * - WooCommerce: https://woocommerce.github.io/woocommerce-rest-api-docs/
 * - Shopify: https://shopify.dev/docs/api/admin-graphql/latest
 * - Shopee: https://open.shopee.com/developer-guide/4
 */

export { META_GRAPH_VERSION, metaGraphGet, metaGraphUrl } from "./meta/graph";
export { fetchMetaAdsInsights } from "./meta/ads";
export { buildMetaPixelSnippet } from "./meta/pixel";
export { fetchIgProfile } from "./instagram/graph";
export { mpFetch, getMpPublicKey } from "./mercadopago/payments";
export { verifyMpWebhookSignature } from "./mercadopago/webhooks";
export { GOOGLE_ADS_API_VERSION, googleAdsConfigured } from "./google/ads";
export { ga4Configured } from "./google/analytics";
export { mlFetch, mlGetMe } from "./mercadolivre/client";
export { getMlOrder } from "./mercadolivre/orders";
export { ingestMercadoLivreOrder } from "./mercadolivre/ingest-order";
export { ingestMercadoLivreShipment } from "./mercadolivre/ingest-shipment";
export { refreshMarketplaceSellerSnapshot } from "./mercadolivre/insights";
export { wcFetch, validateWooCredentials } from "./woocommerce/client";
export { getWooOrder } from "./woocommerce/orders";
export { ingestWooCommerceOrder } from "./woocommerce/ingest-order";
export {
  normalizeShopifyShop,
  buildShopifyAuthorizeUrl,
  exchangeShopifyAccessToken,
} from "./shopify/oauth";
export { shopifyGraphql, resolveShopifyConnection } from "./shopify/client";
export { ingestShopifyHubOrder } from "./shopify/ingest-order";
export { syncShopifyWorkspace } from "./shopify/sync";
export { verifyShopifyWebhookHmac } from "./shopify/webhooks";
export { buildShopeeAuthPartnerUrl, exchangeShopeeCode } from "./shopee/oauth";
export { shopeeFetch } from "./shopee/client";
export { ingestShopeeOrder } from "./shopee/ingest-order";
export { syncShopeeWorkspace } from "./shopee/sync";
export {
  extractShopeePushOrderSn,
  isShopeeOrderPush,
} from "./shopee/webhooks";
export {
  buildTrayAuthorizeUrl,
  exchangeTrayCode,
  normalizeTrayStoreHost,
} from "./tray/oauth";
export { trayFetch } from "./tray/client";
export { ingestTrayHubOrder } from "./tray/ingest-order";
export { syncTrayWorkspace } from "./tray/sync";
export { parseTrayNotification, isTrayOrderNotification } from "./tray/webhooks";
export {
  buildNuvemshopAuthorizeUrl,
  exchangeNuvemshopCode,
} from "./nuvemshop/oauth";
export { nuvemshopFetch } from "./nuvemshop/client";
export { ingestNuvemshopHubOrder } from "./nuvemshop/ingest-order";
export { syncNuvemshopWorkspace } from "./nuvemshop/sync";
export { registerNuvemshopWebhooks, isNuvemshopOrderEvent } from "./nuvemshop/webhooks";

