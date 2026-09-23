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
