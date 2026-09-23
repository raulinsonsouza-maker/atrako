/**
 * Google Ads / GA4 — stubs de cliente alinhados ao Config.
 * Contas concretas ainda usam ConexaoIntegracao legado até cutover total.
 * Doc: https://developers.google.com/google-ads/api
 */

export const GOOGLE_ADS_API_VERSION = "v17";

export function googleAdsConfigured() {
  return Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID?.trim() &&
      process.env.GOOGLE_ADS_CLIENT_SECRET?.trim(),
  );
}
