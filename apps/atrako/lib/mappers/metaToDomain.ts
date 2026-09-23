import type { MetaInsightRow } from "@/lib/meta/metaClient";

function parseNum(val: string | undefined | null): number {
  if (val === undefined || val === null || val === "") return 0;
  const n = parseFloat(String(val).trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Exact match on action_type */
function getActionExact(
  actions: Array<{ action_type: string; value: string }> | undefined,
  type: string
): number {
  if (!actions?.length) return 0;
  return actions
    .filter((a) => a.action_type === type)
    .reduce((sum, a) => sum + parseNum(a.value), 0);
}

/** Exact match on action_values */
function getActionValueExact(
  actionValues: Array<{ action_type: string; value: string }> | undefined,
  type: string
): number {
  if (!actionValues?.length) return 0;
  return actionValues
    .filter((a) => a.action_type === type)
    .reduce((sum, a) => sum + parseNum(a.value), 0);
}

export interface MetaInsightPayload {
  data: Date;
  impressoes: number;
  cliques: number;
  leads: number;
  conversoes: number;
  onFacebookLeads: number;
  websiteLeads: number;
  messagingConversationsStarted: number;
  contacts: number;
  purchases: number;
  investimento: number;
  cpl: number | null;
  costPerPurchase: number | null;
  websitePurchaseRoas: number | null;
  websitePurchasesConversionValue: number;
  alcance: number;
  checkoutIniciado: number;
  profileVisits: number;
  addToCart: number;
  landingPageViews: number;
  campaignName: string;
  campaignId: string;
}

/**
 * Map a single Meta insight row (daily) to the payload expected by upsertFatoMidia.
 *
 * Action type reference:
 *  - cliques        → inline_link_clicks field (link clicks only)
 *  - leads (total)  → "lead" action type (Meta's aggregate)
 *  - onFacebookLeads → "onsite_conversion.lead_grouped"
 *  - websiteLeads   → "offsite_conversion.fb_pixel_lead" | "website_lead"
 *  - messaging      → "onsite_conversion.messaging_conversation_started_7d"
 *  - contacts       → "onsite_conversion.messaging_conversation_started_7d" (same as messaging for now)
 *  - purchases      → "purchase" | "omni_purchase"
 */
export function mapMetaInsightToFatoPayload(row: MetaInsightRow): MetaInsightPayload {
  const spend = parseNum(row.spend);
  const impressions = parseNum(row.impressions);
  const inlineLinkClicks = parseNum(row.inline_link_clicks);
  const actions = row.actions ?? [];
  const actionValues = row.action_values ?? [];

  const onFacebookLeads = getActionExact(actions, "onsite_conversion.lead_grouped");
  const websiteLeads =
    getActionExact(actions, "offsite_conversion.fb_pixel_lead") ||
    getActionExact(actions, "website_lead");
  const messagingConversationsStarted = getActionExact(
    actions,
    "onsite_conversion.messaging_conversation_started_7d"
  );
  const contacts = getActionExact(actions, "onsite_conversion.messaging_conversation_started_7d");
  const checkoutIniciado = getActionExact(actions, "initiate_checkout");
  const addToCart = getActionExact(actions, "add_to_cart") || getActionExact(actions, "offsite_conversion.fb_pixel_add_to_cart");
  const landingPageViews = getActionExact(actions, "landing_page_view");
  const uniqueActions = row.unique_actions ?? [];
  const getUniqueAction = (type: string) => getActionExact(uniqueActions, type);

  // Campaign-level "results" field has structure: [{indicator: "profile_visit_view", values: [{value: "45"}]}]
  // Indicators for profile visits: "profile_visit_view", "total_profile_visits"
  const PROFILE_VISIT_INDICATORS = ["profile_visit_view", "total_profile_visits"];
  const campaignResultVisits = (row.results ?? [])
    .filter((r) => PROFILE_VISIT_INDICATORS.includes(r.indicator))
    .reduce((sum, r) => sum + (parseFloat(r.values?.[0]?.value ?? "0") || 0), 0);

  const profileVisits =
    getActionExact(actions, "ig_profile_visit") ||
    getActionExact(actions, "onsite_conversion.ig_profile_visit") ||
    getActionExact(actions, "ig_profile_visits") ||
    getUniqueAction("ig_profile_visit") ||
    getUniqueAction("ig_profile_visits") ||
    getUniqueAction("onsite_conversion.ig_profile_visit") ||
    campaignResultVisits;

  const purchaseCount =
    getActionExact(actions, "purchase") ||
    getActionExact(actions, "omni_purchase") ||
    getActionExact(actions, "offsite_conversion.fb_pixel_purchase") ||
    getActionExact(actions, "website_purchase");
  const purchaseValue =
    getActionValueExact(actionValues, "purchase") ||
    getActionValueExact(actionValues, "omni_purchase") ||
    getActionValueExact(actionValues, "offsite_conversion.fb_pixel_purchase") ||
    getActionValueExact(actionValues, "website_purchase");

  const leadCount = getActionExact(actions, "lead");
  const leads = leadCount || onFacebookLeads || websiteLeads;

  const cpl = leads > 0 ? spend / leads : null;
  const costPerPurchase = purchaseCount > 0 ? spend / purchaseCount : null;
  const websitePurchaseRoas = spend > 0 && purchaseValue > 0 ? purchaseValue / spend : null;

  const dateStr = row.date_start ?? row.date_stop;
  const data = dateStr ? new Date(dateStr + "T12:00:00Z") : new Date();

  const alcance = parseNum(row.reach);

  return {
    data,
    impressoes: impressions,
    cliques: inlineLinkClicks,
    leads,
    conversoes: purchaseCount,
    onFacebookLeads,
    websiteLeads,
    messagingConversationsStarted,
    contacts,
    purchases: purchaseCount,
    investimento: spend,
    cpl,
    costPerPurchase,
    websitePurchaseRoas,
    websitePurchasesConversionValue: purchaseValue,
    alcance,
    checkoutIniciado,
    profileVisits,
    addToCart,
    landingPageViews,
    campaignName: row.campaign_name?.trim() ?? "",
    campaignId: row.campaign_id?.trim() ?? "",
  };
}
