/**
 * Meta Ads insights — usa Graph version única.
 * Contas: WorkspaceConnection META_ADS (via Config).
 * Doc: https://developers.facebook.com/docs/marketing-api/insights
 */

import { metaGraphGet } from "./graph";

export async function fetchMetaAdsInsights(
  accessToken: string,
  adAccountId: string,
  params?: Record<string, string>,
) {
  const account = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  return metaGraphGet(`/${account}/insights`, accessToken, {
    fields: "spend,impressions,clicks,ctr",
    ...params,
  });
}
