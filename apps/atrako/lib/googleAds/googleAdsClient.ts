import { GoogleAdsApi } from "google-ads-api";
import { getIntegrationsConfig } from "@/lib/config/integrations";

export interface GoogleAdsCredentialOverride {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  loginCustomerId?: string | null;
}

async function getClientAndRefreshToken(override?: GoogleAdsCredentialOverride) {
  let clientId: string | undefined;
  let clientSecret: string | undefined;
  let developerToken: string | undefined;
  let refreshToken: string | undefined;
  let loginCustomerId: string | undefined;

  if (override) {
    clientId = override.clientId;
    clientSecret = override.clientSecret;
    developerToken = override.developerToken;
    refreshToken = override.refreshToken;
    loginCustomerId = override.loginCustomerId?.replace(/-/g, "") || undefined;
  } else {
    const fromDb = await getIntegrationsConfig();
    clientId = fromDb.googleClientId ?? process.env.GOOGLE_ADS_CLIENT_ID ?? undefined;
    clientSecret = fromDb.googleClientSecret ?? process.env.GOOGLE_ADS_CLIENT_SECRET ?? undefined;
    developerToken = fromDb.googleDeveloperToken ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? undefined;
    refreshToken = fromDb.googleRefreshToken ?? process.env.GOOGLE_ADS_REFRESH_TOKEN ?? undefined;
    loginCustomerId = (fromDb.googleLoginCustomerId ?? process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)?.replace(/-/g, "") || undefined;
  }

  if (!clientId || !clientSecret || !developerToken || !refreshToken) {
    throw new Error(
      "Google Ads API: GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN e GOOGLE_ADS_REFRESH_TOKEN são obrigatórios"
    );
  }

  const client = new GoogleAdsApi({
    client_id: clientId,
    client_secret: clientSecret,
    developer_token: developerToken,
  });

  return { client, refreshToken, loginCustomerId };
}

function normalizeLoginCustomerId(value?: string | null): string | undefined {
  const normalized = String(value ?? "").replace(/\D/g, "");
  return normalized || undefined;
}

function createCustomer(client: GoogleAdsApi, params: {
  customerId: string;
  refreshToken: string;
  loginCustomerId?: string | null;
  defaultLoginCustomerId?: string | null;
}) {
  const loginCustomerId = normalizeLoginCustomerId(params.loginCustomerId)
    ?? normalizeLoginCustomerId(params.defaultLoginCustomerId);
  return client.Customer({
    customer_id: params.customerId.replace(/-/g, ""),
    refresh_token: params.refreshToken,
    ...(loginCustomerId ? { login_customer_id: loginCustomerId } : {}),
  });
}

export interface GoogleAdsCampaignRow {
  campaign?: { id?: string; name?: string; status?: string; advertising_channel_type?: string };
  segments?: { date?: string };
  metrics?: {
    impressions?: string | number;
    clicks?: string | number;
    cost_micros?: string | number;
    conversions?: string | number;
    all_conversions?: string | number;
    conversions_value?: string | number;
    all_conversions_value?: string | number;
    unique_users?: string | number;
  };
}

export interface GoogleAdsBeginCheckoutRow {
  segments?: { date?: string };
  metrics?: { conversions?: string | number; all_conversions?: string | number };
}

export interface GoogleAdsAdCreativeRow {
  campaign?: { id?: string; name?: string; status?: string };
  ad_group?: { id?: string; name?: string };
  ad_group_ad?: {
    resource_name?: string;
    ad?: {
      id?: string;
      final_urls?: string[];
      responsive_search_ad?: {
        headlines?: Array<{ text?: string }>;
        descriptions?: Array<{ text?: string }>;
      };
      expanded_text_ad?: {
        headline_part1?: string;
        headline_part2?: string;
        description?: string;
      };
    };
  };
  segments?: { date?: string };
  metrics?: {
    impressions?: string | number;
    clicks?: string | number;
    cost_micros?: string | number;
    conversions?: string | number;
    all_conversions?: string | number;
    conversions_value?: string | number;
    all_conversions_value?: string | number;
  };
}

/**
 * Busca métricas de campanhas por dia (agregadas por segments.date).
 * Retorna uma linha por campanha por data.
 */
export async function fetchCampaignMetrics(
  customerId: string,
  dateFrom: string,
  dateTo: string,
  options?: { loginCustomerId?: string | null; credentials?: GoogleAdsCredentialOverride }
): Promise<GoogleAdsCampaignRow[]> {
  const { client, refreshToken, loginCustomerId } = await getClientAndRefreshToken(options?.credentials);
  const customer = createCustomer(client, {
    customerId,
    refreshToken,
    loginCustomerId: options?.loginCustomerId,
    defaultLoginCustomerId: loginCustomerId,
  });

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.all_conversions,
      metrics.conversions_value,
      metrics.all_conversions_value,
      metrics.unique_users
    FROM campaign
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
      AND metrics.cost_micros > 0
    ORDER BY segments.date, metrics.impressions DESC
    LIMIT 10000
  `;

  const results = await customer.query(query);
  return results as unknown as GoogleAdsCampaignRow[];
}

/**
 * Busca conversões "Begin checkout" por dia (GA4 / segmentação por conversion_action_category).
 * Retorna um mapa dateString -> total de checkouts iniciados.
 */
export async function fetchBeginCheckoutConversions(
  customerId: string,
  dateFrom: string,
  dateTo: string,
  options?: { loginCustomerId?: string | null; credentials?: GoogleAdsCredentialOverride }
): Promise<Map<string, number>> {
  const { client, refreshToken, loginCustomerId } = await getClientAndRefreshToken(options?.credentials);
  const customer = createCustomer(client, {
    customerId,
    refreshToken,
    loginCustomerId: options?.loginCustomerId,
    defaultLoginCustomerId: loginCustomerId,
  });

  const query = `
    SELECT
      segments.date,
      segments.conversion_action_category,
      metrics.conversions,
      metrics.all_conversions
    FROM campaign
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
      AND segments.conversion_action_category = 'BEGIN_CHECKOUT'
  `;

  try {
    const results = (await customer.query(query)) as unknown as GoogleAdsBeginCheckoutRow[];
    const byDate = new Map<string, number>();
    for (const row of results) {
      const rowAny = row as Record<string, unknown>;
      const segments = (row.segments ?? rowAny.segments) as Record<string, unknown> | undefined;
      const metrics = (row.metrics ?? rowAny.metrics) as Record<string, unknown> | undefined;
      const dateStr = segments?.date ? String(segments.date) : null;
      const conversions =
        parseFloat(String(metrics?.conversions ?? 0)) ||
        parseFloat(String((metrics as Record<string, unknown>)?.all_conversions ?? 0));
      if (dateStr && Number.isFinite(conversions)) {
        const current = byDate.get(dateStr) ?? 0;
        byDate.set(dateStr, current + conversions);
      }
    }
    return byDate;
  } catch {
    return new Map();
  }
}

/**
 * Busca conversões de COMPRA (PURCHASE) por dia.
 * Retorna um mapa dateString -> { count, value } para compras reais.
 * Ao contrário de metrics.conversions (que conta TODAS as conversões primárias),
 * este busca especificamente a categoria PURCHASE.
 */
export async function fetchPurchaseConversions(
  customerId: string,
  dateFrom: string,
  dateTo: string,
  options?: { loginCustomerId?: string | null; credentials?: GoogleAdsCredentialOverride }
): Promise<Map<string, { count: number; value: number }>> {
  const { client, refreshToken, loginCustomerId } = await getClientAndRefreshToken(options?.credentials);
  const customer = createCustomer(client, {
    customerId,
    refreshToken,
    loginCustomerId: options?.loginCustomerId,
    defaultLoginCustomerId: loginCustomerId,
  });

  const query = `
    SELECT
      segments.date,
      segments.conversion_action_category,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
      AND segments.conversion_action_category = 'PURCHASE'
  `;

  try {
    const results = (await customer.query(query)) as unknown as Array<Record<string, unknown>>;
    const byDate = new Map<string, { count: number; value: number }>();
    for (const row of results) {
      const segments = row.segments as Record<string, unknown> | undefined;
      const metrics = row.metrics as Record<string, unknown> | undefined;
      const dateStr = segments?.date ? String(segments.date) : null;
      const count = parseFloat(String(metrics?.conversions ?? 0));
      const value = parseFloat(String(metrics?.conversions_value ?? 0));
      if (dateStr && Number.isFinite(count)) {
        const existing = byDate.get(dateStr) ?? { count: 0, value: 0 };
        byDate.set(dateStr, {
          count: existing.count + (Number.isFinite(count) ? count : 0),
          value: existing.value + (Number.isFinite(value) ? value : 0),
        });
      }
    }
    return byDate;
  } catch {
    return new Map();
  }
}

/**
 * Busca criativos (ad_group_ad) com métricas por dia.
 * Retorna uma linha por anúncio por data.
 */
export async function fetchAdCreatives(
  customerId: string,
  dateFrom: string,
  dateTo: string,
  options?: { loginCustomerId?: string | null; credentials?: GoogleAdsCredentialOverride }
): Promise<GoogleAdsAdCreativeRow[]> {
  const { client, refreshToken, loginCustomerId } = await getClientAndRefreshToken(options?.credentials);
  const customer = createCustomer(client, {
    customerId,
    refreshToken,
    loginCustomerId: options?.loginCustomerId,
    defaultLoginCustomerId: loginCustomerId,
  });

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      ad_group.id,
      ad_group.name,
      ad_group_ad.resource_name,
      ad_group_ad.ad.id,
      ad_group_ad.ad.final_urls,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.expanded_text_ad.headline_part1,
      ad_group_ad.ad.expanded_text_ad.headline_part2,
      ad_group_ad.ad.expanded_text_ad.description,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.all_conversions,
      metrics.conversions_value,
      metrics.all_conversions_value
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
      AND metrics.cost_micros > 0
    ORDER BY segments.date, metrics.impressions DESC
    LIMIT 10000
  `;

  const results = await customer.query(query);
  return results as unknown as GoogleAdsAdCreativeRow[];
}

export interface GoogleAdsKeywordRow {
  campaign?: { id?: string; name?: string };
  ad_group?: { id?: string; name?: string };
  ad_group_criterion?: {
    keyword?: { text?: string; match_type?: string };
    status?: string;
  };
  metrics?: {
    impressions?: string | number;
    clicks?: string | number;
    cost_micros?: string | number;
    conversions?: string | number;
    all_conversions?: string | number;
    ctr?: string | number;
    average_cpc?: string | number;
  };
}

/**
 * Busca métricas de palavras-chave agregadas pelo período.
 */
export async function fetchKeywordMetrics(
  customerId: string,
  dateFrom: string,
  dateTo: string,
  options?: { loginCustomerId?: string | null; credentials?: GoogleAdsCredentialOverride }
): Promise<GoogleAdsKeywordRow[]> {
  const { client, refreshToken, loginCustomerId } = await getClientAndRefreshToken(options?.credentials);
  const customer = createCustomer(client, {
    customerId,
    refreshToken,
    loginCustomerId: options?.loginCustomerId,
    defaultLoginCustomerId: loginCustomerId,
  });

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.all_conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM keyword_view
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
      AND ad_group_criterion.status != 'REMOVED'
      AND metrics.impressions > 0
    ORDER BY metrics.impressions DESC
    LIMIT 500
  `;

  const results = await customer.query(query);
  return results as unknown as GoogleAdsKeywordRow[];
}

export interface GoogleAdsAccountBudget {
  approvedSpendingLimit: number | null;
  amountServed: number;
  remaining: number | null;
  currency: string;
}

/**
 * Fetch account-level budget info for a Google Ads customer.
 * Uses the account_budget resource (available for accounts with a billing setup).
 * Returns null when no account-level budget is configured.
 */
export async function fetchAccountBudget(
  customerId: string,
  loginCustomerId?: string | null,
  credentials?: GoogleAdsCredentialOverride
): Promise<GoogleAdsAccountBudget | null> {
  const { client, refreshToken, loginCustomerId: defaultLoginCustomerId } = await getClientAndRefreshToken(credentials);
  const customer = createCustomer(client, {
    customerId,
    refreshToken,
    loginCustomerId,
    defaultLoginCustomerId,
  });

  try {
    const rows = await customer.query(`
      SELECT
        account_budget.approved_spending_limit_micros,
        account_budget.amount_served_micros,
        account_budget.status
      FROM account_budget
      WHERE account_budget.status = 'APPROVED'
      LIMIT 1
    `);

    if (!rows || rows.length === 0) return null;

    const row = rows[0] as {
      account_budget?: {
        approved_spending_limit_micros?: string | number;
        amount_served_micros?: string | number;
      };
    };

    const approved = row.account_budget?.approved_spending_limit_micros;
    const served = row.account_budget?.amount_served_micros;

    const approvedMicros = approved != null ? Number(approved) : null;
    const servedMicros = served != null ? Number(served) : 0;

    const approvedValue = approvedMicros != null ? approvedMicros / 1_000_000 : null;
    const servedValue = servedMicros / 1_000_000;

    return {
      approvedSpendingLimit: approvedValue,
      amountServed: servedValue,
      remaining: approvedValue != null ? Math.max(0, approvedValue - servedValue) : null,
      currency: "BRL",
    };
  } catch {
    return null;
  }
}
