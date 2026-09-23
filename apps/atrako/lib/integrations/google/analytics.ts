/**
 * GA4 Data API — flag de plataforma.
 * Contas/propriedades por workspace vêm do Config (WorkspaceConnection / tracking).
 * Doc: https://developers.google.com/analytics/devguides/reporting/data/v1
 */

export function ga4Configured() {
  return Boolean(process.env.GA4_PROPERTY_ID?.trim() || process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
}
