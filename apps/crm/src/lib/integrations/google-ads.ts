/**
 * Google Ads API – Lead Form Extensions.
 * Integration.config: { refreshToken, customerId, ... } – OAuth/API em versão futura.
 * Por ora retorna vazio.
 */

export type GoogleLead = { name: string; email: string; phone?: string; sourceId: string };

export async function getLeads(_config: Record<string, unknown>): Promise<GoogleLead[]> {
  // TODO: OAuth + google-ads-api; Lead Form Extensions, Offline Conversion Import
  return [];
}
