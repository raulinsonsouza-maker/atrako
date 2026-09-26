import { GoogleAdsApi } from "google-ads-api";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import type { GoogleAdsAccessibleAccount } from "@/lib/googleAds/types";
import { googleAdsFriendlyError } from "@/lib/googleAds/types";

export interface GoogleAdsCredentialOverride {
  clientId: string;
  clientSecret: string;
  /** Legado — Google Ads API ignora desde set/2026; string vazia ok. */
  developerToken?: string;
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
    const { resolvePlatformApp } = await import("@/lib/config/platformApps");
    const platform = await resolvePlatformApp("GOOGLE_ADS");
    const fromDb = await getIntegrationsConfig();
    clientId =
      platform?.credentials.clientId ??
      fromDb.googleClientId ??
      process.env.GOOGLE_ADS_CLIENT_ID ??
      undefined;
    clientSecret =
      platform?.credentials.clientSecret ??
      fromDb.googleClientSecret ??
      process.env.GOOGLE_ADS_CLIENT_SECRET ??
      undefined;
    developerToken =
      platform?.credentials.developerToken ??
      fromDb.googleDeveloperToken ??
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN ??
      undefined;
    refreshToken =
      platform?.credentials.refreshToken ??
      fromDb.googleRefreshToken ??
      process.env.GOOGLE_ADS_REFRESH_TOKEN ??
      undefined;
    loginCustomerId = (
      platform?.credentials.loginCustomerId ??
      fromDb.googleLoginCustomerId ??
      process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
    )
      ?.replace(/-/g, "") || undefined;
  }

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google Ads API: configure PlatformApp GOOGLE_ADS (client/secret) e refresh token do workspace",
    );
  }

  // O acesso é definido pelo Cloud project desde set/2026, mas google-ads-api@23
  // ainda valida localmente que o campo não esteja vazio antes de enviar a chamada.
  // Um marcador neutro mantém compatibilidade com o SDK; o servidor ignora o valor.
  const client = new GoogleAdsApi({
    client_id: clientId,
    client_secret: clientSecret,
    developer_token: developerToken?.trim() || "cloud-project-access",
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

/**
 * Lista CIDs acessíveis pelo OAuth do usuário.
 * Pós-set/2026: developer token é opcional/ignorado — o acesso vem do Google Cloud project
 * do Client OAuth (https://developers.google.com/google-ads/api/docs/api-policy/developer-token).
 * Pacote google-ads-api@23 → API v23.
 */
export type { GoogleAdsAccessibleAccount } from "@/lib/googleAds/types";

export function formatGoogleAdsCid(id: string): string {
  const d = id.replace(/\D/g, "");
  if (d.length !== 10) return d || id;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

export function isGoogleAdsDescriptiveName(name: string | null | undefined, id: string): boolean {
  const n = name?.trim() ?? "";
  if (!n || n.toLowerCase() === "google ads") return false;
  return n.replace(/\D/g, "") !== id.replace(/\D/g, "");
}

function unwrapScalar(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (value && typeof value === "object" && "value" in value) {
    return unwrapScalar((value as { value: unknown }).value);
  }
  return "";
}

function pickDescriptiveName(row: Record<string, unknown> | undefined | null): string | null {
  if (!row) return null;
  const raw = unwrapScalar(row.descriptive_name) || unwrapScalar(row.descriptiveName);
  const name = raw.trim();
  return name || null;
}

function isManagerFlag(row: Record<string, unknown> | undefined | null): boolean {
  if (!row) return false;
  const v = row.manager;
  if (v === true || v === "true" || v === 1) return true;
  if (v && typeof v === "object" && "value" in v) return Boolean((v as { value: unknown }).value);
  return false;
}

function extractCustomerRow(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const o = row as Record<string, unknown>;
  if (o.customer && typeof o.customer === "object" && !Array.isArray(o.customer)) {
    return o.customer as Record<string, unknown>;
  }
  return o;
}

function extractCustomerClientRow(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const o = row as Record<string, unknown>;
  if (o.customer_client && typeof o.customer_client === "object" && !Array.isArray(o.customer_client)) {
    return o.customer_client as Record<string, unknown>;
  }
  if (o.customerClient && typeof o.customerClient === "object" && !Array.isArray(o.customerClient)) {
    return o.customerClient as Record<string, unknown>;
  }
  return o;
}

function adsHeaders(accessToken: string, developerToken?: string, loginCustomerId?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
  if (developerToken) headers["developer-token"] = developerToken;
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;
  return headers;
}

async function queryCustomerMeta(
  client: GoogleAdsApi,
  refreshToken: string,
  customerId: string,
  loginCustomerId?: string,
): Promise<{ name: string | null; manager: boolean; error: string | null }> {
  try {
    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
      ...(loginCustomerId ? { login_customer_id: loginCustomerId } : {}),
    });
    const result = (await customer.query(`
      SELECT customer.id, customer.descriptive_name, customer.manager
      FROM customer
      LIMIT 1
    `)) as unknown[];
    const row = extractCustomerRow(result[0]);
    return {
      name: pickDescriptiveName(row),
      manager: isManagerFlag(row),
      error: null,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message.slice(0, 200) : "customer_query_failed";
    return { name: null, manager: false, error };
  }
}

async function getCustomerViaRest(
  accessToken: string,
  customerId: string,
  developerToken?: string,
  loginCustomerId?: string,
): Promise<{ name: string | null; manager: boolean; error: string | null }> {
  const versions = ["v23", "v22"];
  let lastError: string | null = null;
  for (const v of versions) {
    try {
      const searchUrl = `https://googleads.googleapis.com/${v}/customers/${customerId}/googleAds:search`;
      const searchRes = await fetch(searchUrl, {
        method: "POST",
        headers: {
          ...adsHeaders(accessToken, developerToken, loginCustomerId),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: "SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1",
        }),
      });
      const searchBody = (await searchRes.json().catch(() => ({}))) as {
        results?: unknown[];
        error?: { message?: string };
      };
      if (searchRes.ok) {
        const row = extractCustomerRow(searchBody.results?.[0]);
        const name = pickDescriptiveName(row);
        if (name) return { name, manager: isManagerFlag(row), error: null };
      } else {
        lastError = searchBody.error?.message || `http_${searchRes.status}`;
      }

      const getUrl = `https://googleads.googleapis.com/${v}/customers/${customerId}`;
      const getRes = await fetch(getUrl, {
        headers: adsHeaders(accessToken, developerToken, loginCustomerId),
      });
      const getBody = (await getRes.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: { message?: string };
      };
      if (getRes.ok) {
        const name = pickDescriptiveName(getBody);
        if (name) return { name, manager: isManagerFlag(getBody), error: null };
      } else {
        lastError = getBody.error?.message || `http_${getRes.status}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message.slice(0, 200) : "rest_customer_failed";
    }
  }
  return { name: null, manager: false, error: lastError };
}

/** Nomes dos clientes sob um MCC (mais confiável que query direta sem login_customer_id). */
async function queryCustomerClientNames(
  client: GoogleAdsApi,
  refreshToken: string,
  managerId: string,
): Promise<{ map: Map<string, { name: string; manager: boolean }>; error: string | null }> {
  const map = new Map<string, { name: string; manager: boolean }>();
  try {
    const customer = client.Customer({
      customer_id: managerId,
      refresh_token: refreshToken,
      login_customer_id: managerId,
    });
    const result = (await customer.query(`
      SELECT
        customer_client.id,
        customer_client.client_customer,
        customer_client.descriptive_name,
        customer_client.manager
      FROM customer_client
      WHERE customer_client.status = 'ENABLED'
    `)) as unknown[];
    for (const row of result) {
      const cc = extractCustomerClientRow(row);
      if (!cc) continue;
      const fromId = unwrapScalar(cc.id).replace(/\D/g, "");
      const fromResource = unwrapScalar(cc.client_customer || cc.clientCustomer).replace(/\D/g, "");
      const id = fromId || fromResource;
      const name = pickDescriptiveName(cc);
      if (!id) continue;
      map.set(id, { name: name || formatGoogleAdsCid(id), manager: isManagerFlag(cc) });
    }
    return { map, error: null };
  } catch (err) {
    const error = googleAdsFriendlyError(err).slice(0, 400);
    return { map, error };
  }
}

async function fetchCustomerLabels(
  client: GoogleAdsApi,
  params: {
    refreshToken: string;
    accessToken?: string | null;
    developerToken?: string;
    ids: string[];
  },
): Promise<{
  accounts: GoogleAdsAccessibleAccount[];
  loginCustomerId: string | null;
  nameError: string | null;
}> {
  const { refreshToken, accessToken, developerToken, ids } = params;
  const byId = new Map<string, GoogleAdsAccessibleAccount>();
  for (const id of ids) {
    byId.set(id, { id, name: formatGoogleAdsCid(id), manager: false, loginCustomerId: null });
  }

  const managers: string[] = [];
  const batchSize = 4;
  let lastError: string | null = null;

  const applyMeta = (id: string, meta: { name: string | null; manager: boolean; error: string | null }) => {
    if (meta.error) lastError = meta.error;
    const current = byId.get(id)!;
    if (meta.name && isGoogleAdsDescriptiveName(meta.name, id)) {
      byId.set(id, { id, name: meta.name, manager: meta.manager, loginCustomerId: current.loginCustomerId });
    } else if (meta.manager) {
      byId.set(id, { id, name: current.name, manager: true, loginCustomerId: current.loginCustomerId });
    }
    if (meta.manager && !managers.includes(id)) managers.push(id);
  };

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (id) => {
        const meta = await queryCustomerMeta(client, refreshToken, id);
        applyMeta(id, meta);
        if (!isGoogleAdsDescriptiveName(byId.get(id)!.name, id) && accessToken) {
          const rest = await getCustomerViaRest(accessToken, id, developerToken);
          applyMeta(id, rest);
        }
      }),
    );
  }

  const mccCandidates = managers.length > 0 ? managers : ids;
  for (const mcc of mccCandidates) {
    const clients = await queryCustomerClientNames(client, refreshToken, mcc);
    if (clients.error) lastError = clients.error;
    if (clients.map.size === 0) continue;
    if (!managers.includes(mcc)) managers.push(mcc);
    for (const [cid, info] of clients.map) {
      const current = byId.get(cid);
      byId.set(cid, {
        id: cid,
        name: current && isGoogleAdsDescriptiveName(current.name, cid) ? current.name : info.name,
        manager: info.manager,
        loginCustomerId: mcc,
      });
    }
  }

  const stillMissing = () => Array.from(byId.values())
    .filter((account) => !isGoogleAdsDescriptiveName(account.name, account.id))
    .map((account) => account.id);
  if (stillMissing().length > 0 && managers.length > 0) {
    const missing = stillMissing();
    for (let i = 0; i < missing.length; i += batchSize) {
      const batch = missing.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (id) => {
          for (const mcc of managers) {
            if (mcc === id) continue;
            if (!byId.has(id)) return;
            const meta = await queryCustomerMeta(client, refreshToken, id, mcc);
            applyMeta(id, meta);
            if (isGoogleAdsDescriptiveName(byId.get(id)!.name, id)) return;
            if (accessToken) {
              const rest = await getCustomerViaRest(accessToken, id, developerToken, mcc);
              applyMeta(id, rest);
              if (isGoogleAdsDescriptiveName(byId.get(id)!.name, id)) return;
            }
          }
        }),
      );
    }
  }

  const accounts = Array.from(byId.values());
  const selectable = accounts.some((account) => !account.manager)
    ? accounts.filter((account) => !account.manager)
    : accounts;
  const namesMissing = selectable.length > 0 && selectable.every(
    (account) => !isGoogleAdsDescriptiveName(account.name, account.id),
  );
  return {
    accounts: selectable.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    loginCustomerId: managers[0] ?? null,
    nameError: namesMissing ? lastError : null,
  };
}

/**
 * Lista CIDs acessíveis pelo OAuth do usuário (com nome descritivo quando possível).
 * Pós-set/2026: developer token é opcional/ignorado — o acesso vem do Google Cloud project
 * do Client OAuth (https://developers.google.com/google-ads/api/docs/api-policy/developer-token).
 * Pacote google-ads-api@23 → API v23.
 */
export async function listAccessibleCustomerIds(params: {
  refreshToken: string;
  accessToken?: string | null;
  clientId: string;
  clientSecret: string;
  /** Legado opcional — enviado só se presente; API ignora desde set/2026. */
  developerToken?: string | null;
}): Promise<{
  ids: string[];
  accounts: GoogleAdsAccessibleAccount[];
  error: string | null;
  loginCustomerId: string | null;
}> {
  const legacyToken = params.developerToken?.trim() || "";
  let libError: string | null = null;
  let ids: string[] = [];

  const client = new GoogleAdsApi({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    developer_token: legacyToken,
  });

  // 1) Client library (alinhada à v23 do pacote)
  try {
    const listed = await client.listAccessibleCustomers(params.refreshToken);
    const resources = (listed as { resource_names?: string[] })?.resource_names ?? [];
    ids = resources
      .map((r) => r.replace(/^customers\//, "").replace(/\D/g, ""))
      .filter(Boolean);
    if (ids.length === 0) libError = "no_accessible_customers";
  } catch (err) {
    libError = err instanceof Error ? err.message.slice(0, 240) : "list_customers_failed";
  }

  // 2) REST v23 (fallback) — versões antigas retornam http_404
  const accessToken = await refreshGoogleAccessToken(
    params.clientId,
    params.clientSecret,
    params.refreshToken,
  ).catch(() => params.accessToken?.trim() || null);

  if (ids.length === 0 && accessToken) {
    const rest = await listViaRest(accessToken, legacyToken || undefined);
    if (rest.ids.length > 0) {
      ids = rest.ids;
      libError = null;
    } else {
      return { ids: [], accounts: [], error: rest.error || libError, loginCustomerId: null };
    }
  }

  if (ids.length === 0) {
    return { ids: [], accounts: [], error: libError, loginCustomerId: null };
  }

  const labeled = await fetchCustomerLabels(client, {
    refreshToken: params.refreshToken,
    accessToken,
    developerToken: legacyToken || undefined,
    ids,
  });
  return {
    ids: labeled.accounts.map((account) => account.id),
    accounts: labeled.accounts,
    error: labeled.nameError,
    loginCustomerId: labeled.loginCustomerId,
  };
}

async function refreshGoogleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await response.json().catch(() => ({})) as {
    access_token?: string;
    error_description?: string;
  };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || `oauth_refresh_http_${response.status}`);
  }
  return json.access_token;
}

/** google-ads-api@23 → v23; v22 só como fallback de rede. */
const GADS_LIST_URLS = [
  "https://googleads.googleapis.com/v23/customers:listAccessibleCustomers",
  "https://googleads.googleapis.com/v22/customers:listAccessibleCustomers",
];

async function listViaRest(
  accessToken: string,
  developerToken?: string,
): Promise<{ ids: string[]; error: string | null }> {
  let lastError: string | null = null;
  for (const url of GADS_LIST_URLS) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    };
    if (developerToken) headers["developer-token"] = developerToken;
    try {
      const res = await fetch(url, { headers });
      const body = (await res.json().catch(() => ({}))) as {
        resourceNames?: string[];
        error?: { message?: string; status?: string };
      };
      if (!res.ok) {
        lastError = body.error?.message || `http_${res.status}`;
        continue;
      }
      const ids = (body.resourceNames ?? [])
        .map((r) => r.replace(/^customers\//, "").replace(/\D/g, ""))
        .filter(Boolean);
      return {
        ids,
        error: ids.length === 0 ? "no_accessible_customers" : null,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message.slice(0, 200) : "rest_list_failed";
    }
  }
  return { ids: [], error: lastError };
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
