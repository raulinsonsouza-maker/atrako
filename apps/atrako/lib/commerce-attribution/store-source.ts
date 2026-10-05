/**
 * Origem do pedido como a loja gravou (WooCommerce Order Attribution, `_wc_order_attribution_*`).
 * A URL de entrada da sessão é a fonte mais completa: o Woo não guarda `utm_id`/`utm_term` em campo próprio.
 */

export type OrderChannel =
  | "meta_ads"
  | "google_ads"
  | "instagram"
  | "facebook"
  | "google_organic"
  | "email"
  | "whatsapp"
  | "direct"
  | "referral"
  | "other"
  | "unknown";

export type StoreOrderSource = {
  channel: OrderChannel;
  storeSource: string | null;
  storeMedium: string | null;
  storeCampaign: string | null;
  storeContent: string | null;
  storeTerm: string | null;
  referrer: string | null;
  landingUrl: string | null;
  deviceType: string | null;
  sessionPages: number | null;
  sessionCount: number | null;
  hasFbclid: boolean;
  /** IDs/nomes do Meta presentes nas UTMs (só quando o canal é meta_ads). */
  meta: {
    campaignId: string | null;
    campaignName: string | null;
    adsetId: string | null;
    adId: string | null;
    adName: string | null;
  } | null;
};

type MetaRow = { key?: string; value?: unknown };

const META_ID = /^\d{10,20}$/;
const PAID_MEDIUMS = new Set(["paid", "cpc", "ppc", "paid_social", "paidsocial", "paid-social", "ads", "ad", "cpm", "display"]);
const META_SOURCES = /(^|\b)(facebook|fb|instagram|ig|meta|an|msg|igshopping|threads)(\b|$)/i;
const META_REFERRERS = /(facebook\.com|instagram\.com|fb\.me|messenger\.com|threads\.net)/i;

function clean(v: unknown, max = 300): string | null {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s || s === "(none)") return null;
  try {
    s = decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    s = s.replace(/\+/g, " ");
  }
  return s.trim().slice(0, max) || null;
}

function metaValue(meta: MetaRow[] | undefined, key: string): string | null {
  const row = meta?.find((m) => m.key === key);
  return row ? clean(row.value, 2000) : null;
}

function parseUrl(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function toInt(v: string | null): number | null {
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function classifyChannel(input: {
  source: string | null;
  medium: string | null;
  referrer: string | null;
  sourceType: string | null;
  hasGclid: boolean;
  metaIdInUtm: boolean;
}): OrderChannel {
  const source = (input.source ?? "").toLowerCase();
  const medium = (input.medium ?? "").toLowerCase();
  const referrer = (input.referrer ?? "").toLowerCase();
  const paid = PAID_MEDIUMS.has(medium) || input.metaIdInUtm;

  if (input.hasGclid || (paid && source.includes("google"))) return "google_ads";
  if (paid && (META_SOURCES.test(source) || META_REFERRERS.test(referrer) || META_ID.test(source))) return "meta_ads";
  if (medium === "email" || source.includes("email") || source.includes("newsletter")) return "email";
  if (medium === "whatsapp" || source.includes("whatsapp") || source === "wa") return "whatsapp";
  if (/(^|\.)instagram\.com$|^ig$|^instagram$|igshopping/.test(source) || referrer.includes("instagram.com")) return "instagram";
  if (/(^|\.)facebook\.com$|^fb$|^facebook$/.test(source) || referrer.includes("facebook.com")) return "facebook";
  if (source.includes("google") && (medium === "organic" || input.sourceType === "organic")) return "google_organic";
  if (source === "(direct)" || input.sourceType === "typein" || (!source && !referrer)) return "direct";
  if (input.sourceType === "organic") return "referral";
  if (input.sourceType === "referral" || referrer) return "referral";
  return "other";
}

/** Lê a origem gravada no pedido WooCommerce. `null` quando a loja não registrou nada. */
export function parseWooOrderSource(order: { meta_data?: MetaRow[] }): StoreOrderSource | null {
  const meta = order.meta_data;
  const sourceType = metaValue(meta, "_wc_order_attribution_source_type");
  const landingUrl = metaValue(meta, "_wc_order_attribution_session_entry");
  if (!sourceType && !landingUrl) return null;

  const url = parseUrl(landingUrl);
  const qp = (k: string) => clean(url?.searchParams.get(k));

  const source = qp("utm_source") ?? metaValue(meta, "_wc_order_attribution_utm_source");
  const medium = qp("utm_medium") ?? metaValue(meta, "_wc_order_attribution_utm_medium");
  const campaign = qp("utm_campaign") ?? metaValue(meta, "_wc_order_attribution_utm_campaign");
  const content = qp("utm_content") ?? metaValue(meta, "_wc_order_attribution_utm_content");
  const term = qp("utm_term") ?? metaValue(meta, "_wc_order_attribution_utm_term");
  const utmId = qp("utm_id") ?? metaValue(meta, "_wc_order_attribution_utm_id");
  const referrer = metaValue(meta, "_wc_order_attribution_referrer");
  const hasFbclid = Boolean(url?.searchParams.get("fbclid"));
  const hasGclid = Boolean(url?.searchParams.get("gclid") || url?.searchParams.get("gbraid") || url?.searchParams.get("wbraid"));

  // `{{campaign.id}}` pode vir em utm_id (padrão) ou em utm_source (template antigo).
  const campaignId = [utmId, source, campaign].find((v) => v && META_ID.test(v)) ?? null;
  const adsetId = term && META_ID.test(term) ? term : null;
  const adId = [content, qp("atk_ad")].find((v) => v && META_ID.test(v)) ?? null;

  const channel = classifyChannel({
    source,
    medium,
    referrer,
    sourceType,
    hasGclid,
    metaIdInUtm: Boolean(campaignId) && !hasGclid,
  });

  return {
    channel,
    storeSource: source?.slice(0, 200) ?? null,
    storeMedium: medium?.slice(0, 120) ?? null,
    storeCampaign: campaign,
    storeContent: content,
    storeTerm: term,
    referrer: referrer?.slice(0, 500) ?? null,
    landingUrl,
    deviceType: metaValue(meta, "_wc_order_attribution_device_type")?.slice(0, 40) ?? null,
    sessionPages: toInt(metaValue(meta, "_wc_order_attribution_session_pages")),
    sessionCount: toInt(metaValue(meta, "_wc_order_attribution_session_count")),
    hasFbclid,
    meta:
      channel === "meta_ads"
        ? {
            campaignId,
            campaignName: campaign && !META_ID.test(campaign) ? campaign : null,
            adsetId,
            adId,
            adName: content && !META_ID.test(content) ? content : null,
          }
        : null,
  };
}

export const CHANNEL_LABELS: Record<OrderChannel, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  instagram: "Instagram orgânico",
  facebook: "Facebook orgânico",
  google_organic: "Google orgânico",
  email: "E-mail",
  whatsapp: "WhatsApp",
  direct: "Direto",
  referral: "Outro site",
  other: "Outro",
  unknown: "Não informado pela loja",
};
