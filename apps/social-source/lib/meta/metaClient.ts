const GRAPH_BASE = "https://graph.facebook.com/v19.0";
const GRAPH_PREVIEW_BASE = "https://graph.facebook.com/v25.0";

export interface MetaLeadGenForm {
  id: string;
  name: string;
  status?: string;
  leads_count?: number;
  created_time?: string;
}

export interface MetaLeadGenFormsResponse {
  data: MetaLeadGenForm[];
  paging?: { cursors?: { before: string; after: string }; next?: string };
  error?: { message: string; type: string; code: number };
}

export interface MetaLeadFieldData {
  name: string;
  values: string[];
}

export interface MetaLeadEntry {
  id: string;
  created_time: string;
  field_data: MetaLeadFieldData[];
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
}

export interface MetaLeadsResponse {
  data: MetaLeadEntry[];
  paging?: { cursors?: { before: string; after: string }; next?: string };
  error?: { message: string; type: string; code: number };
}

/**
 * Paginate through all results of a /{page_id}/leadgen_forms endpoint.
 */
async function paginateLeadGenForms(firstUrl: string): Promise<{ forms: MetaLeadGenForm[]; error?: string }> {
  const all: MetaLeadGenForm[] = [];
  let url: string | null = firstUrl;
  while (url) {
    const r = await fetch(url);
    const d = (await r.json()) as MetaLeadGenFormsResponse;
    if (!r.ok || d.error) {
      const errMsg = d.error?.message ?? `HTTP ${r.status}`;
      console.warn(`[paginateLeadGenForms] error code=${d.error?.code} msg=${errMsg}`);
      return { forms: all, error: errMsg };
    }
    if (d.data?.length) all.push(...d.data);
    url = d.paging?.next ?? null;
  }
  return { forms: all };
}

/**
 * Fetch all lead gen forms for an ad account.
 *
 * Strategy (three-tier):
 * 1. Try the unofficial /{act_id}/leadgen_forms endpoint (works with some tokens).
 * 2. If that fails, retrieve the Facebook Pages associated with the ad account via
 *    /{act_id}/promote_pages and use the official /{page_id}/leadgen_forms endpoint
 *    documented at https://developers.facebook.com/docs/marketing-api/guides/lead-ads/
 * 3. Last resort: discover form IDs by scanning ads for their `leadgen_id` creative
 *    field, then fetch each form individually.
 */
export async function fetchLeadGenForms(
  accountId: string,
  token: string
): Promise<MetaLeadGenForm[]> {
  const actId = ensureActPrefix(accountId);
  const tokenParam = `access_token=${encodeURIComponent(token)}`;

  // ── Tier 1: /{act_id}/leadgen_forms ──────────────────────────────────────
  const t1Res = await fetch(
    `${GRAPH_BASE}/${actId}/leadgen_forms?${tokenParam}&fields=id,name,status,leads_count,created_time&limit=100`
  );
  const t1Data = (await t1Res.json()) as MetaLeadGenFormsResponse;
  console.log(`[fetchLeadGenForms] T1 actId=${actId} ok=${t1Res.ok} error=${t1Data.error?.code} msg=${t1Data.error?.message} count=${t1Data.data?.length ?? 0}`);

  if (t1Res.ok && !t1Data.error) {
    const all: MetaLeadGenForm[] = [];
    if (t1Data.data?.length) all.push(...t1Data.data);
    let next = t1Data.paging?.next ?? null;
    while (next) {
      const r = await fetch(next);
      const d = (await r.json()) as MetaLeadGenFormsResponse;
      if (!r.ok || d.error) break;
      if (d.data?.length) all.push(...d.data);
      next = d.paging?.next ?? null;
    }
    return all;
  }

  // Only proceed with fallbacks on known permission / field-not-found errors.
  const t1ErrCode = t1Data?.error?.code;
  const t1ErrMsg = t1Data?.error?.message ?? "";
  const isKnownError =
    t1ErrCode === 100 ||
    t1ErrMsg.includes("leadgen_forms") ||
    t1ErrMsg.includes("nonexisting field") ||
    t1ErrMsg.includes("permission") ||
    t1ErrMsg.includes("OAuthException");

  if (!isKnownError) {
    throw new Error(t1ErrMsg || `Meta API error: ${t1Res.status}`);
  }

  // ── Tier 2: /{page_id}/leadgen_forms  (official per Meta docs) ───────────
  // Strategy: collect page IDs from multiple sources:
  //   2a. promote_pages endpoint
  //   2b. campaigns' promoted_object (works with basic insights access)
  type PageItem = { id: string; name?: string };

  const pageIdSet = new Set<string>();
  let t2PermErr: string | null = null;

  // 2a — promote_pages
  const pagesRes = await fetch(
    `${GRAPH_BASE}/${actId}/promote_pages?${tokenParam}&fields=id,name&limit=25`
  );
  const pagesData = (await pagesRes.json()) as {
    data?: PageItem[];
    error?: { message: string; code: number };
  };
  if (pagesRes.ok && !pagesData.error) {
    (pagesData.data ?? []).forEach((p) => pageIdSet.add(p.id));
  } else {
    t2PermErr = pagesData.error?.message ?? null;
  }
  console.log(`[fetchLeadGenForms] T2a promote_pages ok=${pagesRes.ok} error=${pagesData.error?.code} pageIds=[${[...pageIdSet].join(",")}]`);

  // 2b — extract page IDs from campaigns' promoted_object (requires only insights access)
  if (pageIdSet.size === 0) {
    const campRes = await fetch(
      `${GRAPH_BASE}/${actId}/campaigns?${tokenParam}&fields=promoted_object&effective_status=["ACTIVE","PAUSED","ARCHIVED"]&limit=50`
    );
    const campData = (await campRes.json()) as {
      data?: Array<{ promoted_object?: { page_id?: string } }>;
      error?: { message: string; code: number };
    };
    if (campRes.ok && !campData.error) {
      for (const c of campData.data ?? []) {
        if (c.promoted_object?.page_id) pageIdSet.add(c.promoted_object.page_id);
      }
    }
    console.log(`[fetchLeadGenForms] T2b campaigns promoted_object ok=${campRes.ok} error=${campData.error?.code} pageIds=[${[...pageIdSet].join(",")}]`);
  }

  // 2c — fall back to all pages the token user manages (/me/accounts)
  //       Works when the user is a Page admin even without full ad account access.
  if (pageIdSet.size === 0) {
    let meAccountsUrl: string | null =
      `${GRAPH_BASE}/me/accounts?${tokenParam}&fields=id,name&limit=100`;
    while (meAccountsUrl) {
      const r = await fetch(meAccountsUrl);
      const d = (await r.json()) as {
        data?: Array<{ id: string; name?: string }>;
        paging?: { next?: string };
        error?: { message: string; code: number };
      };
      if (!r.ok || d.error) {
        console.log(`[fetchLeadGenForms] T2c me/accounts error=${d.error?.code} msg=${d.error?.message}`);
        break;
      }
      for (const p of d.data ?? []) pageIdSet.add(p.id);
      meAccountsUrl = d.paging?.next ?? null;
    }
    console.log(`[fetchLeadGenForms] T2c me/accounts pageIds=[${[...pageIdSet].join(",")}]`);
  }

  const pageIds: string[] = [...pageIdSet];

  if (pageIds.length > 0) {
    // For each page, try to exchange the system user token for a Page Access Token.
    // /{pageId}/leadgen_forms requires a Page Access Token (error 190 otherwise).
    const formSets = await Promise.all(
      pageIds.map(async (pageId) => {
        // Try to get a Page Access Token first
        let pageToken: string | null = null;
        try {
          const pageTokenRes = await fetch(
            `${GRAPH_BASE}/${pageId}?fields=access_token&${tokenParam}`
          );
          const pageTokenData = (await pageTokenRes.json()) as {
            access_token?: string;
            error?: { message: string; code: number };
          };
          if (pageTokenRes.ok && !pageTokenData.error && pageTokenData.access_token) {
            pageToken = pageTokenData.access_token;
            console.log(`[fetchLeadGenForms] T2 got page token for pageId=${pageId}`);
          } else {
            console.log(`[fetchLeadGenForms] T2 no page token for pageId=${pageId}: code=${pageTokenData.error?.code} msg=${pageTokenData.error?.message}`);
          }
        } catch {
          // ignore — fall through to using the user token
        }
        const tokenToUse = pageToken ?? token;
        const tokenParamToUse = `access_token=${encodeURIComponent(tokenToUse)}`;
        return paginateLeadGenForms(
          `${GRAPH_BASE}/${pageId}/leadgen_forms?${tokenParamToUse}&fields=id,name,status,leads_count,created_time&limit=100`
        );
      })
    );
    const allForms = formSets.flatMap((s) => s.forms);
    const t2PageErrors = formSets.filter((s) => s.error).map((s) => s.error!);
    console.log(`[fetchLeadGenForms] T2 page forms total=${allForms.length} pageErrors=${t2PageErrors.length} errors=[${t2PageErrors.join("; ")}]`);

    if (allForms.length > 0) {
      const seen = new Set<string>();
      return allForms.filter((f) => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      });
    }
    // If we found pages but got 0 forms (likely a permission error on the Page),
    // fall through to T3 (ads scan) which only needs ads_read/insights access.
    if (t2PageErrors.length > 0) {
      t2PermErr = t2PageErrors[0];
    }
    console.log(`[fetchLeadGenForms] T2 returned 0 forms — falling through to T3`);
  }

  // ── Tier 3: discover form IDs via ads' leadgen_id creative field ──────────
  const formIds = new Set<string>();
  let t3PermErr: string | null = null;
  const adsParams = new URLSearchParams({
    access_token: token,
    fields: "id,adcreatives{leadgen_id}",
    // NB: "DELETED" is no longer a valid value for the ads `effective_status`
    // filter — including it makes Meta reject the whole request with
    // error 100 / subcode 1815001 ("Invalid parameter"), silently breaking
    // this fallback tier. Keep only the values Meta still accepts here.
    effective_status: JSON.stringify(["ACTIVE", "PAUSED", "ARCHIVED"]),
    limit: "500",
  });
  let adsUrl: string | null = `${GRAPH_BASE}/${actId}/ads?${adsParams.toString()}`;

  while (adsUrl) {
    const r = await fetch(adsUrl);
    const d = (await r.json()) as {
      data?: Array<{ id: string; adcreatives?: { data?: Array<{ leadgen_id?: string }> } }>;
      paging?: { next?: string };
      error?: { message: string; code: number };
    };
    if (!r.ok || d.error) {
      t3PermErr = d.error?.message ?? `HTTP ${r.status}`;
      console.warn(`[fetchLeadGenForms] T3 ads error code=${d.error?.code} msg=${t3PermErr}`);
      break;
    }
    for (const ad of d.data ?? []) {
      for (const creative of ad.adcreatives?.data ?? []) {
        if (creative.leadgen_id) formIds.add(creative.leadgen_id);
      }
    }
    console.log(`[fetchLeadGenForms] T3 ads page: ${d.data?.length ?? 0} ads, formIds so far: ${formIds.size}`);
    adsUrl = d.paging?.next ?? null;
  }

  console.log(`[fetchLeadGenForms] T3 ads scan formIds found: ${formIds.size} ids=[${[...formIds].join(",")}]`);

  // All three tiers failed due to permissions — throw so the caller can surface a useful message.
  if (formIds.size === 0 && (t2PermErr || t3PermErr)) {
    const permMsg = t2PermErr ?? t3PermErr ?? "Permission denied";
    throw new Error(`PERMISSION_ERROR: ${permMsg}`);
  }

  if (formIds.size === 0) return [];

  // Fetch details for each discovered form.
  const forms: MetaLeadGenForm[] = [];
  await Promise.all(
    [...formIds].map(async (formId) => {
      const r = await fetch(
        `${GRAPH_BASE}/${formId}?${tokenParam}&fields=id,name,status,leads_count,created_time`
      );
      const d = (await r.json()) as MetaLeadGenForm & { error?: { message: string } };
      if (!d.error && d.id) forms.push(d);
    })
  );

  return forms;
}

/**
 * Wrapper around fetchLeadGenForms that also surfaces permission errors
 * so the caller can show actionable messages instead of silently returning 0.
 *
 * When a permission error is detected, it additionally checks whether the
 * configured ad account is even visible to the token user via /me/adaccounts.
 * If not, a specific ACCOUNT_NOT_ACCESSIBLE error is returned with the list
 * of actually accessible accounts so the user can diagnose the issue.
 */
export async function fetchLeadGenFormsWithDiag(
  accountId: string,
  token: string
): Promise<{ forms: MetaLeadGenForm[]; permissionError: string | null }> {
  try {
    const forms = await fetchLeadGenForms(accountId, token);
    return { forms, permissionError: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isPermErr =
      msg.startsWith("PERMISSION_ERROR:") ||
      msg.includes("ads_management") ||
      msg.includes("ads_read") ||
      msg.includes("leads_retrieval");

    if (!isPermErr) {
      return { forms: [], permissionError: null };
    }

    // ── Diagnose: is the account even accessible to this token? ─────────────
    const normalizedId = accountId.replace(/^act_/, "");
    let accountAccessible = false;
    const accessibleNames: string[] = [];

    try {
      const tokenParam = `access_token=${encodeURIComponent(token)}`;
      let meAccountsUrl: string | null =
        `${GRAPH_BASE}/me/adaccounts?${tokenParam}&fields=account_id,name&limit=100`;
      while (meAccountsUrl) {
        const r = await fetch(meAccountsUrl);
        const d = (await r.json()) as {
          data?: Array<{ account_id: string; name?: string }>;
          paging?: { next?: string };
          error?: { message: string };
        };
        if (!r.ok || d.error) break;
        for (const acc of d.data ?? []) {
          accessibleNames.push(`${acc.name ?? acc.account_id} (${acc.account_id})`);
          if (acc.account_id === normalizedId) accountAccessible = true;
        }
        meAccountsUrl = d.paging?.next ?? null;
      }
    } catch {
      // ignore diagnostic errors
    }

    console.log(`[fetchLeadGenFormsWithDiag] account ${normalizedId} accessible=${accountAccessible} accessible_count=${accessibleNames.length}`);

    if (!accountAccessible) {
      const permErr =
        `ACCOUNT_NOT_ACCESSIBLE: A conta de anúncios ${normalizedId} não está acessível pelo usuário do token. ` +
        `Acesse o Meta Business Manager e adicione o usuário "Raul Souza" (ou o dono do token) como Anunciante na conta ${normalizedId}. ` +
        `Contas acessíveis pelo token atual: ${accessibleNames.length > 0 ? accessibleNames.slice(0, 5).join(", ") + (accessibleNames.length > 5 ? ` (+${accessibleNames.length - 5} mais)` : "") : "nenhuma"}.`;
      return { forms: [], permissionError: permErr };
    }

    return {
      forms: [],
      permissionError: msg.replace("PERMISSION_ERROR:", "").trim(),
    };
  }
}

/**
 * Fetch individual lead entries from a lead gen form.
 * Supports paging and optional date filtering.
 */
export async function fetchLeadsFromForm(
  formId: string,
  token: string,
  options?: { dateFrom?: string; dateTo?: string; maxLeads?: number }
): Promise<MetaLeadEntry[]> {
  const maxLeads = options?.maxLeads ?? 10000;
  const fields = "id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id";
  const params = new URLSearchParams({
    access_token: token,
    fields,
    limit: "100",
  });
  if (options?.dateFrom) {
    const sinceTs = Math.floor(new Date(options.dateFrom + "T00:00:00Z").getTime() / 1000);
    params.set("filtering", JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: sinceTs }]));
  }

  const all: MetaLeadEntry[] = [];
  let url: string | null = `${GRAPH_BASE}/${formId}/leads?${params.toString()}`;

  while (url && all.length < maxLeads) {
    const res = await fetch(url);
    const data = (await res.json()) as MetaLeadsResponse;
    if (!res.ok || data.error) {
      const msg = data?.error?.message ?? `Meta API error: ${res.status}`;
      const code = data?.error?.code;
      console.warn(`[fetchLeadsFromForm] form=${formId} error code=${code} msg=${msg}`);
      // Gracefully skip forms that don't exist or have permission issues.
      if (msg.includes("does not exist") || msg.includes("permission") || code === 100 || code === 200 || code === 190) break;
      throw new Error(msg);
    }
    if (data.data?.length) all.push(...data.data);
    url = data.paging?.next ?? null;
  }

  return all;
}

/**
 * Fetch leads directly from a specific ad via /{ad_id}/leads.
 * Works with ads_read + leads_retrieval without requiring Page access token.
 * This is Tier 4 fallback when form-based endpoints fail due to missing Page permissions.
 */
export async function fetchLeadsFromAd(
  adId: string,
  token: string,
  options?: { maxLeads?: number }
): Promise<MetaLeadEntry[]> {
  const maxLeads = options?.maxLeads ?? 10000;
  const fields = "id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform";
  const params = new URLSearchParams({ access_token: token, fields, limit: "100" });

  const all: MetaLeadEntry[] = [];
  let url: string | null = `${GRAPH_BASE}/${adId}/leads?${params.toString()}`;

  while (url && all.length < maxLeads) {
    const res = await fetch(url);
    const data = (await res.json()) as MetaLeadsResponse;
    if (!res.ok || data.error) {
      const code = data?.error?.code;
      const msg = data?.error?.message ?? `HTTP ${res.status}`;
      // Silently skip — non-lead-gen ads return error 100 for this endpoint
      if (code === 100 || code === 200 || code === 190) break;
      console.warn(`[fetchLeadsFromAd] ad=${adId} code=${code} msg=${msg}`);
      break;
    }
    if (data.data?.length) all.push(...data.data);
    url = data.paging?.next ?? null;
  }

  return all;
}

/** Ad formats supported by Meta preview API */
export type MetaAdPreviewFormat =
  | "DESKTOP_FEED_STANDARD"
  | "MOBILE_FEED_STANDARD"
  | "INSTAGRAM_EXPLORE_GRID_HOME"
  | "INSTAGRAM_SEARCH_CHAIN"
  | "FACEBOOK_STORY_MOBILE"
  | "RIGHT_COLUMN_STANDARD";

function upgradeFbCdnImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/fbcdn\.net|facebook\.com/.test(trimmed) && (/\b64x64\b|p64x64/.test(trimmed))) {
    return trimmed
      .replace(/\/p64x64\//g, "/p1080x1080/")
      .replace(/\b64x64\b/g, "1080x1080");
  }
  return trimmed;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  account_id?: string;
}

export interface MetaAdAccountsResponse {
  data: MetaAdAccount[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
    previous?: string;
  };
  error?: { message: string; type: string; code: number };
}

export interface MetaInsightRow {
  date_start: string;
  date_stop: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  unique_actions?: Array<{ action_type: string; value: string }>;
  campaign_id?: string;
  campaign_name?: string;
  /**
   * Campaign-level primary result KPI — present only when level=campaign.
   * Structure: [{indicator: "profile_visit_view", values: [{value: "45"}]}, ...]
   * Indicator names for profile visits: "profile_visit_view", "total_profile_visits"
   */
  results?: Array<{ indicator: string; values: Array<{ value: string; attribution_windows?: string[] }> }>;
}

export interface MetaInsightsResponse {
  data: MetaInsightRow[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
    previous?: string;
  };
  error?: { message: string; type: string; code: number };
}

export interface MetaAdCreative {
  id: string;
  object_story_id?: string;
  thumbnail_url?: string;
  image_url?: string;
  image_url_full?: string;
  image_hash?: string;
  video_id?: string;
  video_source_url?: string;
  video_picture_url?: string;
  video_embed_html?: string;
  body?: string;
  title?: string;
  object_story_spec?: {
    link_data?: {
      image_hash?: string;
      image_url?: string;
      picture?: string;
      child_attachments?: Array<{
        image_hash?: string;
        image_url?: string;
        picture?: string;
        video_id?: string;
      }>;
    };
    photo_data?: { image_hash?: string; url?: string };
    video_data?: { image_url?: string; thumbnail_url?: string; video_id?: string };
  };
  asset_feed_spec?: {
    videos?: Array<{ video_id?: string; thumbnail_url?: string; image_url?: string }>;
    images?: Array<{ hash?: string; url?: string }>;
  };
}

export interface MetaAdInsight {
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
  ctr?: string;
  cpc?: string;
  frequency?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  video_p100_watched_actions?: Array<{ action_type: string; value: string }>;
}

export interface MetaAd {
  id: string;
  name: string;
  effective_status?: string;
  adset?: { id?: string; name?: string; campaign?: { id?: string; name?: string; objective?: string } };
  adcreatives?: { data: MetaAdCreative[] };
  insights?: { data: MetaAdInsight[] };
}

export interface MetaAdsResponse {
  data: MetaAd[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
    previous?: string;
  };
  error?: { message: string; type: string; code: number };
}

function ensureActPrefix(accountId: string): string {
  if (accountId.startsWith("act_")) return accountId;
  return `act_${accountId}`;
}

/**
 * Checks whether a Meta API error message is a transient/retryable error.
 * These include 503 service unavailable, unknown errors, and rate limits.
 */
function isTransientMetaError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("service temporarily unavailable") ||
    lower.includes("an unknown error occurred") ||
    lower.includes("try again") ||
    lower.includes("temporarily") ||
    lower.includes("rate limit") ||
    lower.includes("too many calls") ||
    lower.includes("user request limit")
  );
}

/**
 * Wraps a fetch call with up to `maxRetries` retries for transient Meta API errors.
 * Waits 3s before the first retry, 6s before the second, etc. (3s * attempt).
 */
async function fetchWithRetry(
  urlOrFn: string | (() => Promise<Response>),
  maxRetries = 3
): Promise<Response> {
  const doFetch = typeof urlOrFn === "string" ? () => fetch(urlOrFn) : urlOrFn;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const waitMs = attempt * 3000;
      console.warn(`[fetchWithRetry] transient error, retrying in ${waitMs}ms (attempt ${attempt}/${maxRetries})...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
    try {
      const res = await doFetch();
      // If it's a 503 or similar server error, check if we should retry
      if (!res.ok && res.status >= 500 && attempt < maxRetries) {
        const body = await res.clone().json().catch(() => ({})) as { error?: { message?: string } };
        const msg = body?.error?.message ?? `HTTP ${res.status}`;
        if (isTransientMetaError(msg) || res.status === 503) {
          lastError = new Error(msg);
          continue;
        }
      }
      return res;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (!isTransientMetaError(lastError.message) || attempt >= maxRetries) throw lastError;
    }
  }
  throw lastError ?? new Error("Max retries exceeded");
}

/**
 * Fetch all ad accounts the token has access to.
 */
export async function fetchAdAccounts(token: string): Promise<MetaAdAccount[]> {
  const all: MetaAdAccount[] = [];
  const fields = "id,name,account_id";
  let url: string | null = `${GRAPH_BASE}/me/adaccounts?access_token=${encodeURIComponent(token)}&fields=${encodeURIComponent(fields)}`;

  while (url) {
    const res = await fetch(url);
    const data = (await res.json()) as MetaAdAccountsResponse;
    if (!res.ok) {
      throw new Error(data?.error?.message ?? `Meta API error: ${res.status}`);
    }
    if (data.error) {
      throw new Error(data.error.message);
    }
    if (data.data?.length) {
      all.push(...data.data);
    }
    url = data.paging?.next ?? null;
  }

  return all;
}

export interface MetaAccountBalance {
  balance: number | null;
  currency: string;
  spendCap: number | null;
}

/**
 * Fetch the current balance (credit available) for a Meta ad account.
 * Returns balance in the account's currency units (e.g. BRL R$).
 *
 * Priority:
 * 1. funding_source_details.amount — the "Saldo disponível" shown in Meta's billing UI
 *    (available for prepaid/coupon accounts, stored in cents)
 * 2. balance — the ad account's net rolling balance (deducted as spend accumulates
 *    between daily charges; correct for most accounts but lags behind for prepaid ones)
 */
export async function fetchAccountBalance(accountId: string, token: string): Promise<MetaAccountBalance> {
  const actId = ensureActPrefix(accountId);
  const url = `${GRAPH_BASE}/${actId}?fields=balance,currency,spend_cap,funding_source_details&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message ?? `Meta API error: ${res.status}`);
  }

  const fsd = data.funding_source_details as {
    amount?: string | number;
    type?: number;
    display_string?: string;
  } | undefined;

  // Meta does NOT return `funding_source_details.amount` in the API response.
  // Instead, the correct "Saldo disponível" is embedded in `display_string` for
  // prepaid accounts (type 20): e.g. "Saldo disponível (R$1.073,27 BRL)"
  // We parse it out using a regex that handles Brazilian number formatting.
  let fsdParsed: number | null = null;
  if (fsd?.type === 20 && fsd?.display_string) {
    const m = fsd.display_string.match(/R\$\s*([\d.]+,\d+)/);
    if (m) {
      // Convert from Brazilian format: "1.073,27" → 1073.27
      const num = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(num)) fsdParsed = num;
    }
  }

  // `balance` field is a net rolling amount (in cents) — does NOT match Meta's billing UI
  // for prepaid accounts (shown as ~1-2% of real saldo). Used only for credit card accounts.
  const accountBalance = data.balance ? parseFloat(data.balance) / 100 : 0;

  // Priority:
  // 1. fsdParsed > 0 → type-20 prepaid account (boleto/pix), display_string parsed — matches Meta UI
  // 2. fsdParsed === 0 → prepaid account with zero balance → show 0 (not null)
  // 3. accountBalance > 0 with no fsd type 20 → credit card/other, use it
  // 4. Everything zero/null → return null (show "—")
  const balance: number | null = fsd?.type === 20
    ? (fsdParsed ?? 0)
    : accountBalance > 0
    ? accountBalance
    : null;

  return {
    balance,
    currency: data.currency ?? "BRL",
    spendCap: data.spend_cap ? parseFloat(data.spend_cap) / 100 : null,
  };
}

/**
 * Fetch account-level insights broken down by day.
 * @param accountId - e.g. act_237828749660910 or 237828749660910
 * @param token - Meta access token
 * @param dateFrom - YYYY-MM-DD
 * @param dateTo - YYYY-MM-DD
 */
export async function fetchAccountInsights(
  accountId: string,
  token: string,
  dateFrom: string,
  dateTo: string
): Promise<MetaInsightsResponse> {
  const actId = ensureActPrefix(accountId);
  const params = new URLSearchParams({
    access_token: token,
    level: "account",
    fields: "spend,impressions,clicks,inline_link_clicks,reach,ctr,cpc,actions,action_values,unique_actions",
    time_increment: "1",
    limit: "100",
    "time_range": JSON.stringify({ since: dateFrom, until: dateTo }),
  });

  const all: MetaInsightRow[] = [];
  let url: string | null = `${GRAPH_BASE}/${actId}/insights?${params.toString()}`;

  while (url) {
    const currentUrl = url;
    let data: MetaInsightsResponse | null = null;
    let lastMsg = "";
    let succeeded = false;
    for (let attempt = 0; attempt <= 3; attempt++) {
      if (attempt > 0) {
        const waitMs = attempt * 5000;
        console.warn(`[fetchAccountInsights] retry ${attempt}/3 in ${waitMs}ms after: ${lastMsg}`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
      const res = await fetch(currentUrl);
      const d = (await res.json()) as MetaInsightsResponse;
      const errMsg = d?.error?.message ?? (res.ok ? "" : `HTTP ${res.status}`);
      if (!res.ok || d.error) {
        lastMsg = errMsg;
        if (isTransientMetaError(errMsg) && attempt < 3) continue;
        throw new Error(errMsg || `Meta API error: ${res.status}`);
      }
      data = d;
      succeeded = true;
      break;
    }
    if (!succeeded || !data) throw new Error(lastMsg || "Max retries exceeded");
    if (data.data?.length) {
      all.push(...data.data);
    }
    url = data.paging?.next ?? null;
  }

  return { data: all };
}

/**
 * Fetch campaign-level daily insights.
 * Used for accounts where account-level aggregation doesn't expose the right action types
 * (e.g. profile-visit campaigns where ig_profile_visit is only available per campaign).
 * Returns rows with the same shape as account-level insights but aggregated from all campaigns.
 */
export async function fetchCampaignInsightsAggregatedByDay(
  accountId: string,
  token: string,
  dateFrom: string,
  dateTo: string
): Promise<MetaInsightsResponse> {
  const actId = ensureActPrefix(accountId);
  const params = new URLSearchParams({
    access_token: token,
    level: "campaign",
    fields: "spend,impressions,clicks,inline_link_clicks,reach,ctr,cpc,actions,action_values,unique_actions,results",
    time_increment: "1",
    limit: "200",
    "time_range": JSON.stringify({ since: dateFrom, until: dateTo }),
  });

  const campaignRows: MetaInsightRow[] = [];
  let url: string | null = `${GRAPH_BASE}/${actId}/insights?${params.toString()}`;

  while (url) {
    const currentUrl = url;
    let data: MetaInsightsResponse | null = null;
    let lastMsg = "";
    let succeeded = false;
    for (let attempt = 0; attempt <= 3; attempt++) {
      if (attempt > 0) {
        const waitMs = attempt * 5000;
        console.warn(`[fetchCampaignInsightsAggregatedByDay] retry ${attempt}/3 in ${waitMs}ms after: ${lastMsg}`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
      const res = await fetch(currentUrl);
      const d = (await res.json()) as MetaInsightsResponse;
      const errMsg = d?.error?.message ?? (res.ok ? "" : `HTTP ${res.status}`);
      if (!res.ok || d.error) {
        lastMsg = errMsg;
        if (isTransientMetaError(errMsg) && attempt < 3) continue;
        throw new Error(errMsg || `Meta API error: ${res.status}`);
      }
      data = d;
      succeeded = true;
      break;
    }
    if (!succeeded || !data) throw new Error(lastMsg || "Max retries exceeded");
    if (data.data?.length) {
      campaignRows.push(...data.data);
    }
    url = data.paging?.next ?? null;
  }

  // Aggregate campaign rows into single rows per day
  const byDay = new Map<string, MetaInsightRow>();
  for (const row of campaignRows) {
    const day = row.date_start ?? row.date_stop;
    if (!day) continue;
    const existing = byDay.get(day);
    if (!existing) {
      byDay.set(day, {
        ...row,
        actions: [...(row.actions ?? [])],
        unique_actions: [...(row.unique_actions ?? [])],
        results: [...(row.results ?? [])],
      });
      continue;
    }
    // Merge numeric fields
    const addNum = (a?: string, b?: string) => String((parseFloat(a ?? "0") || 0) + (parseFloat(b ?? "0") || 0));
    existing.spend = addNum(existing.spend, row.spend);
    existing.impressions = addNum(existing.impressions, row.impressions);
    existing.clicks = addNum(existing.clicks, row.clicks);
    existing.inline_link_clicks = addNum(existing.inline_link_clicks, row.inline_link_clicks);
    existing.reach = addNum(existing.reach, row.reach);
    // Merge actions by type
    const mergeActions = (
      base: Array<{ action_type: string; value: string }>,
      incoming: Array<{ action_type: string; value: string }> | undefined
    ) => {
      if (!incoming?.length) return;
      for (const a of incoming) {
        const found = base.find((b) => b.action_type === a.action_type);
        if (found) {
          found.value = String((parseFloat(found.value) || 0) + (parseFloat(a.value) || 0));
        } else {
          base.push({ ...a });
        }
      }
    };
    mergeActions(existing.actions ?? [], row.actions);
    mergeActions(existing.unique_actions ?? [], row.unique_actions);
    // Merge results (different structure: [{indicator, values:[{value}]}])
    if (!existing.results) existing.results = [];
    for (const r of (row.results ?? [])) {
      const found = existing.results.find((e) => e.indicator === r.indicator);
      if (found) {
        const existingVal = parseFloat(found.values?.[0]?.value ?? "0") || 0;
        const incomingVal = parseFloat(r.values?.[0]?.value ?? "0") || 0;
        if (found.values?.[0]) {
          found.values[0].value = String(existingVal + incomingVal);
        } else {
          found.values = [{ value: String(existingVal + incomingVal) }];
        }
      } else {
        existing.results.push({ ...r, values: [...(r.values ?? [])] });
      }
    }
  }

  return { data: Array.from(byDay.values()) };
}

/**
 * Split a date range into chunks of at most maxDays days.
 * Returns array of [from, to] pairs as "YYYY-MM-DD" strings.
 */
function splitDateRange(dateFrom: string, dateTo: string, maxDays = 30): Array<[string, string]> {
  const chunks: Array<[string, string]> = [];
  let current = new Date(dateFrom + "T00:00:00Z");
  const end = new Date(dateTo + "T00:00:00Z");
  while (current <= end) {
    const chunkEnd = new Date(current);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + maxDays - 1);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push([
      current.toISOString().slice(0, 10),
      chunkEnd.toISOString().slice(0, 10),
    ]);
    current = new Date(chunkEnd);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return chunks;
}

/**
 * Fetch one chunk of campaign-level daily insights (max 30-day range).
 */
async function fetchCampaignInsightsPerCampaignChunk(
  actId: string,
  token: string,
  dateFrom: string,
  dateTo: string
): Promise<MetaInsightRow[]> {
  const params = new URLSearchParams({
    access_token: token,
    level: "campaign",
    fields: "campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,inline_link_clicks,reach,ctr,cpc,actions,action_values,unique_actions,results",
    time_increment: "1",
    limit: "200",
    time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
  });

  const all: MetaInsightRow[] = [];
  let url: string | null = `${GRAPH_BASE}/${actId}/insights?${params.toString()}`;

  while (url) {
    const currentUrl = url;
    let data: MetaInsightsResponse | null = null;
    let lastMsg = "";
    let succeeded = false;
    // Longer backoff: 15s, 30s, 45s to give Meta API more recovery time
    const backoffs = [15000, 30000, 45000];
    for (let attempt = 0; attempt <= 3; attempt++) {
      if (attempt > 0) {
        const waitMs = backoffs[attempt - 1] ?? 15000;
        console.warn(`[fetchCampaignInsightsPerCampaign] retry ${attempt}/3 in ${waitMs / 1000}s (chunk ${dateFrom}→${dateTo}) after: ${lastMsg}`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
      const res = await fetch(currentUrl);
      const d = (await res.json()) as MetaInsightsResponse;
      const errMsg = d?.error?.message ?? (res.ok ? "" : `HTTP ${res.status}`);
      if (!res.ok || d.error) {
        lastMsg = errMsg;
        if (isTransientMetaError(errMsg) && attempt < 3) continue;
        throw new Error(errMsg || `Meta API error: ${res.status}`);
      }
      data = d;
      succeeded = true;
      break;
    }
    if (!succeeded || !data) throw new Error(lastMsg || "Max retries exceeded");
    if (data.data?.length) {
      all.push(...data.data);
    }
    url = data.paging?.next ?? null;
  }

  return all;
}

/**
 * Fetch campaign-level daily insights keeping each campaign as a separate row.
 * Splits large date ranges into 30-day chunks to avoid Meta API errors.
 * Fault-tolerant: failed chunks are skipped with a warning so partial data is still saved.
 * Returns rows that include campaign_id and campaign_name alongside metrics.
 * Used when per-campaign breakdown is needed (e.g. Hotel Fazenda São João).
 */
export async function fetchCampaignInsightsPerCampaign(
  accountId: string,
  token: string,
  dateFrom: string,
  dateTo: string
): Promise<MetaInsightRow[]> {
  const actId = ensureActPrefix(accountId);
  const chunks = splitDateRange(dateFrom, dateTo, 30);
  const all: MetaInsightRow[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const [chunkFrom, chunkTo] = chunks[i];
    try {
      const rows = await fetchCampaignInsightsPerCampaignChunk(actId, token, chunkFrom, chunkTo);
      all.push(...rows);
      console.log(`[fetchCampaignInsightsPerCampaign] chunk ${i + 1}/${chunks.length} OK (${chunkFrom}→${chunkTo}): ${rows.length} rows`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[fetchCampaignInsightsPerCampaign] chunk ${i + 1}/${chunks.length} FAILED (${chunkFrom}→${chunkTo}): ${msg} — skipping`);
    }
    // Pause between chunks to reduce pressure on the Meta API
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  return all;
}

async function fetchAdImagesByHash(
  accountId: string,
  hashes: string[],
  token: string
): Promise<Map<string, string>> {
  if (hashes.length === 0) return new Map();
  try {
    const actId = ensureActPrefix(accountId);
    const hashesParam = JSON.stringify(hashes);
    const url = `${GRAPH_BASE}/${actId}/adimages?access_token=${encodeURIComponent(token)}&hashes=${encodeURIComponent(hashesParam)}&fields=hash,url,permalink_url,original_width,original_height`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      data?: Array<{ hash?: string; url?: string; permalink_url?: string }>;
      images?: Record<string, { hash?: string; url?: string; permalink_url?: string }>;
      error?: { message: string };
    };
    if (data.error) return new Map();
    const map = new Map<string, string>();
    if (Array.isArray(data.data)) {
      for (const img of data.data) {
        const h = img.hash;
        const urlFull = img.url || img.permalink_url;
        if (h && urlFull) map.set(h, urlFull);
      }
    }
    if (data.images && typeof data.images === "object") {
      for (const [key, img] of Object.entries(data.images)) {
        const h = img?.hash ?? key;
        const urlFull = img?.url || img?.permalink_url;
        if (h && urlFull) map.set(h, urlFull);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Fetch creative by ID with full fields. Used when nested ads response
 * returns incomplete object_story_spec/asset_feed_spec (common for video_id).
 */
async function fetchCreativeDetails(
  creativeId: string,
  token: string
): Promise<Partial<MetaAdCreative> | null> {
  try {
    const url = `${GRAPH_BASE}/${creativeId}?access_token=${encodeURIComponent(token)}&fields=image_hash,thumbnail_url,object_story_spec,asset_feed_spec{videos{video_id,thumbnail_url},images{hash,url}}`;
    const res = await fetch(url);
    const data = (await res.json()) as Partial<MetaAdCreative> & { error?: { message: string } };
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch ad preview iframe HTML from Meta preview API.
 * Uses creative_id or ad_id. Requires user access token (not page token).
 * @returns The body HTML (iframe) of the first preview, or null on error
 */
export async function fetchCreativePreview(
  creativeOrAdId: string,
  token: string,
  adFormat: MetaAdPreviewFormat = "DESKTOP_FEED_STANDARD"
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      ad_format: adFormat,
      access_token: token,
    });
    const url = `${GRAPH_PREVIEW_BASE}/${creativeOrAdId}/previews?${params.toString()}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      data?: Array<{ body?: string }>;
      error?: { message: string };
    };
    if (data.error || !res.ok) return null;
    const body = data.data?.[0]?.body;
    return typeof body === "string" && body.trim() ? body : null;
  } catch {
    return null;
  }
}

/**
 * Fallback: fetch video thumbnail via /picture endpoint (Graph API).
 * Returns ProfilePictureSource url when main video fields don't include picture.
 * @see https://developers.facebook.com/docs/graph-api/reference/video/picture/
 */
async function fetchVideoPictureFallback(
  videoId: string,
  token: string
): Promise<string | null> {
  try {
    const url = `${GRAPH_BASE}/${videoId}/picture?access_token=${encodeURIComponent(token)}&redirect=0&width=480&height=480`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      data?: Array<{ url?: string; width?: number; height?: number }>;
      error?: { message: string };
    };
    if (data.error) return null;
    const first = data.data?.[0];
    return first?.url ?? null;
  } catch {
    return null;
  }
}

async function fetchVideoDetails(
  videoId: string,
  token: string
): Promise<{ source: string | null; picture: string | null; embedHtml: string | null }> {
  try {
    const url = `${GRAPH_BASE}/${videoId}?access_token=${encodeURIComponent(token)}&fields=source,picture,thumbnails,embed_html,format{picture,width,height,embed_html}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      source?: string;
      picture?: string | { data?: { url?: string } };
      thumbnails?: { data?: Array<{ uri?: string; width?: number; height?: number }> };
      embed_html?: string;
      format?: Array<{ picture?: string; width?: number; height?: number; embed_html?: string }>;
      error?: { message: string };
    };
    if (data.error) return { source: null, picture: null, embedHtml: null };
    let pictureUrl =
      typeof data.picture === "string"
        ? data.picture
        : (data.picture as { data?: { url?: string } })?.data?.url ?? null;
    let embedHtml = data.embed_html ?? null;
    if (data.format?.length) {
      const largest = data.format.reduce((best, f) => {
        const area = (f.width ?? 0) * (f.height ?? 0);
        const bestArea = (best.width ?? 0) * (best.height ?? 0);
        return area > bestArea ? f : best;
      });
      if (largest.picture) pictureUrl = largest.picture;
      if (!embedHtml && largest.embed_html) embedHtml = largest.embed_html;
    }
    if (!pictureUrl && data.thumbnails?.data?.length) {
      const largestThumb = data.thumbnails.data.reduce((best, thumb) => {
        const area = (thumb.width ?? 0) * (thumb.height ?? 0);
        const bestArea = (best.width ?? 0) * (best.height ?? 0);
        return area > bestArea ? thumb : best;
      });
      if (largestThumb.uri) pictureUrl = largestThumb.uri;
    }
    if (!pictureUrl) {
      pictureUrl = await fetchVideoPictureFallback(videoId, token);
    }
    return { source: data.source ?? null, picture: pictureUrl, embedHtml };
  } catch {
    return { source: null, picture: null, embedHtml: null };
  }
}

const DELIVERY_ACTIVE_STATUSES = ["ACTIVE", "IN_PROCESS"] as const;

const PAGE_COVER_OBJECTIVES = ["PAGE_LIKES", "OUTCOME_PAGE_LIKES"];

function isPageCoverOrLikeAd(ad: MetaAd): boolean {
  const objective = ad.adset?.campaign?.objective;
  if (objective && PAGE_COVER_OBJECTIVES.includes(objective)) return true;
  const name = (ad.name || "").toLowerCase();
  if (/capa|cover|curtir\s*página|like\s*page|page\s*like/.test(name)) return true;
  return false;
}

function getCreativeVideoId(creative?: MetaAdCreative): string | undefined {
  return (
    creative?.video_id ||
    creative?.object_story_spec?.video_data?.video_id ||
    creative?.object_story_spec?.link_data?.child_attachments?.find((child) => !!child.video_id)?.video_id ||
    creative?.asset_feed_spec?.videos?.[0]?.video_id
  );
}

function hasDedicatedCreativePayload(creative?: MetaAdCreative): boolean {
  if (!creative) return false;
  return Boolean(
    creative.image_url ||
      creative.image_hash ||
      creative.thumbnail_url ||
      getCreativeVideoId(creative) ||
      creative.object_story_spec?.link_data?.image_hash ||
      creative.object_story_spec?.link_data?.image_url ||
      creative.object_story_spec?.link_data?.child_attachments?.length ||
      creative.object_story_spec?.photo_data?.image_hash ||
      creative.object_story_spec?.photo_data?.url ||
      creative.object_story_spec?.video_data?.image_url ||
      creative.object_story_spec?.video_data?.thumbnail_url ||
      creative.asset_feed_spec?.images?.length ||
      creative.asset_feed_spec?.videos?.length
  );
}

function collectCreativeImageHashes(creative?: MetaAdCreative): string[] {
  if (!creative) return [];
  const hashes = new Set<string>();
  if (creative.image_hash) hashes.add(creative.image_hash);
  if (creative.object_story_spec?.link_data?.image_hash) {
    hashes.add(creative.object_story_spec.link_data.image_hash);
  }
  if (creative.object_story_spec?.photo_data?.image_hash) {
    hashes.add(creative.object_story_spec.photo_data.image_hash);
  }
  for (const child of creative.object_story_spec?.link_data?.child_attachments ?? []) {
    if (child.image_hash) hashes.add(child.image_hash);
  }
  for (const img of creative.asset_feed_spec?.images ?? []) {
    if (img.hash) hashes.add(img.hash);
  }
  return Array.from(hashes);
}

function resolveCreativeImageUrl(
  creative: MetaAdCreative,
  imageUrlsByHash: Map<string, string>
): string | null {
  for (const hash of collectCreativeImageHashes(creative)) {
    const fromHash = imageUrlsByHash.get(hash);
    if (fromHash) return fromHash;
  }

  return (
    creative.image_url ||
    creative.object_story_spec?.link_data?.image_url ||
    creative.object_story_spec?.video_data?.image_url ||
    creative.object_story_spec?.photo_data?.url ||
    creative.object_story_spec?.link_data?.child_attachments?.find((child) => !!child.image_url)?.image_url ||
    creative.object_story_spec?.link_data?.picture ||
    creative.object_story_spec?.link_data?.child_attachments?.find((child) => !!child.picture)?.picture ||
    creative.asset_feed_spec?.images?.[0]?.url ||
    creative.asset_feed_spec?.videos?.[0]?.image_url ||
    creative.thumbnail_url ||
    null
  );
}

function resolveCreativePosterUrl(creative: MetaAdCreative): string | null {
  return (
    creative.video_picture_url ||
    creative.object_story_spec?.video_data?.thumbnail_url ||
    creative.object_story_spec?.video_data?.image_url ||
    creative.object_story_spec?.link_data?.child_attachments?.find((child) => !!child.image_url)?.image_url ||
    creative.object_story_spec?.link_data?.child_attachments?.find((child) => !!child.picture)?.picture ||
    creative.object_story_spec?.link_data?.image_url ||
    creative.object_story_spec?.link_data?.picture ||
    creative.asset_feed_spec?.videos?.[0]?.thumbnail_url ||
    creative.asset_feed_spec?.videos?.[0]?.image_url ||
    creative.asset_feed_spec?.images?.[0]?.url ||
    creative.thumbnail_url ||
    null
  );
}

/**
 * Fetch all ads with creatives and insights, following paging.next.
 * Only returns ads with status de veiculação ativo: ACTIVE (inclui em aprendizado e
 * aprendizado limitado) ou IN_PROCESS. Exclui desativados (PAUSED, DELETED, etc.).
 * Exclui anúncios que promovem publicações existentes (object_story_id) — somente
 * criativos de anúncios dedicados (link_data, photo_data, video_data).
 * Enriches creatives with video_source_url when video_id is present.
 */
export async function fetchAdsWithCreatives(
  accountId: string,
  token: string,
  options?: { maxPages?: number; dateFrom?: string; dateTo?: string }
): Promise<MetaAd[]> {
  const actId = ensureActPrefix(accountId);
  const maxPages = options?.maxPages ?? 50;
  const allAds: MetaAd[] = [];
  const adsById = new Map<string, MetaAd>();

  // Break the date range into 30-day windows so the Meta API payload (ads × days × metrics)
  // does not exceed Meta's "Please reduce the amount of data" limit on accounts with many ads.
  const dateChunks: Array<[string, string] | null> =
    options?.dateFrom && options?.dateTo
      ? splitDateRange(options.dateFrom, options.dateTo, 30)
      : [null];

  for (let chunkIdx = 0; chunkIdx < dateChunks.length; chunkIdx++) {
    const chunk = dateChunks[chunkIdx];
    const insightsField = chunk
      ? `insights.time_range(${JSON.stringify({
          since: chunk[0],
          until: chunk[1],
        })}).time_increment(1).limit(500){date_start,date_stop,spend,impressions,clicks,inline_link_clicks,ctr,cpc,frequency,actions,action_values,video_p100_watched_actions}`
      : "insights{date_start,date_stop,spend,impressions,clicks,inline_link_clicks,ctr,cpc,frequency,actions,action_values,video_p100_watched_actions}";
    const fields =
      `id,name,effective_status,adset{id,name,campaign{id,name,objective}},adcreatives{id,object_story_id,thumbnail_url,image_hash,video_id,body,title,object_story_spec,asset_feed_spec{videos{video_id,thumbnail_url},images{hash,url}}},${insightsField}`;
    const filtering = JSON.stringify([
      { field: "effective_status", operator: "IN", value: [...DELIVERY_ACTIVE_STATUSES] },
    ]);
    let url: string | null = `${GRAPH_BASE}/${actId}/ads?access_token=${encodeURIComponent(token)}&fields=${encodeURIComponent(fields)}&filtering=${encodeURIComponent(filtering)}&limit=50`;

    for (let page = 0; page < maxPages && url; page++) {
      const currentUrl = url;
      let data: MetaAdsResponse | null = null;
      let lastMsg = "";
      const backoffs = [10000, 20000, 30000];
      for (let attempt = 0; attempt <= 3; attempt++) {
        if (attempt > 0) {
          const waitMs = backoffs[attempt - 1] ?? 10000;
          console.warn(`[fetchAdsWithCreatives] retry ${attempt}/3 in ${waitMs / 1000}s (chunk ${chunkIdx + 1}/${dateChunks.length}) after: ${lastMsg}`);
          await new Promise((r) => setTimeout(r, waitMs));
        }
        const res = await fetch(currentUrl);
        const d = (await res.json()) as MetaAdsResponse;
        const errMsg = d?.error?.message ?? (res.ok ? "" : `HTTP ${res.status}`);
        if (!res.ok || d.error) {
          lastMsg = errMsg;
          if (isTransientMetaError(errMsg) && attempt < 3) continue;
          throw new Error(errMsg || `Meta API error: ${res.status}`);
        }
        data = d;
        break;
      }
      if (!data) throw new Error(lastMsg || "Max retries exceeded");
      if (data.data?.length) {
        for (const ad of data.data) {
          const status = ad.effective_status;
          if (!status || !(DELIVERY_ACTIVE_STATUSES as readonly string[]).includes(status)) continue;
          const creative = ad.adcreatives?.data?.[0];
          if (!creative) continue;
          if (creative.object_story_id) continue;
          if (isPageCoverOrLikeAd(ad)) continue;
          if (!hasDedicatedCreativePayload(creative)) continue;
          const existing = adsById.get(ad.id);
          if (existing) {
            const existingRows = existing.insights?.data ?? [];
            const newRows = ad.insights?.data ?? [];
            existing.insights = { data: [...existingRows, ...newRows] };
          } else {
            adsById.set(ad.id, ad);
            allAds.push(ad);
          }
        }
      }
      url = data.paging?.next ?? null;
    }
    // Pause between date chunks to ease Meta API pressure
    if (chunkIdx < dateChunks.length - 1) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  const creativeIdsToEnrich = new Set<string>();
  for (const ad of allAds) {
    const creative = ad.adcreatives?.data?.[0];
    if (!creative?.id) continue;
    const videoId = getCreativeVideoId(creative);
    const looksLikeVideoAd =
      !!creative.object_story_spec?.video_data ||
      !!creative.asset_feed_spec?.videos?.length ||
      !!creative.video_id;
    if (looksLikeVideoAd && !videoId) creativeIdsToEnrich.add(creative.id);
  }

  if (creativeIdsToEnrich.size > 0) {
    const enriched = await Promise.all(
      Array.from(creativeIdsToEnrich).map(async (cid) => {
        const details = await fetchCreativeDetails(cid, token);
        return [cid, details] as const;
      })
    );
    const enrichedMap = new Map(enriched.filter(([, d]) => d != null) as [string, Partial<MetaAdCreative>][]);
    for (const ad of allAds) {
      const creative = ad.adcreatives?.data?.[0];
      if (!creative?.id) continue;
      const details = enrichedMap.get(creative.id);
      if (!details) continue;
      Object.assign(creative, {
        image_hash: creative.image_hash || details.image_hash,
        thumbnail_url: creative.thumbnail_url || details.thumbnail_url,
        object_story_spec: { ...creative.object_story_spec, ...details.object_story_spec },
        asset_feed_spec: creative.asset_feed_spec || details.asset_feed_spec,
      });
    }
  }

  const videoIds = new Set<string>();
  for (const ad of allAds) {
    const creative = ad.adcreatives?.data?.[0];
    const videoId = getCreativeVideoId(creative);
    if (videoId) videoIds.add(videoId);
  }

  const videoDetails = new Map<
    string,
    { source: string | null; picture: string | null; embedHtml: string | null }
  >();
  if (videoIds.size > 0) {
    const results = await Promise.all(
      Array.from(videoIds).map(async (vid) => {
        const details = await fetchVideoDetails(vid, token);
        return [vid, details] as const;
      })
    );
    for (const [vid, details] of results) videoDetails.set(vid, details);
  }

  for (const ad of allAds) {
    const creative = ad.adcreatives?.data?.[0];
    if (!creative) continue;
    const c = creative as MetaAdCreative & {
      video_source_url?: string;
      video_picture_url?: string;
      video_embed_html?: string;
    };
    const videoId = getCreativeVideoId(creative);
    if (videoId) c.video_id = videoId;
    if (videoId && videoDetails.has(videoId)) {
      const { source, picture, embedHtml } = videoDetails.get(videoId)!;
      if (source) c.video_source_url = source;
      if (picture) c.video_picture_url = picture;
      if (embedHtml) c.video_embed_html = embedHtml;
    }
    if (!c.video_picture_url) {
      const fallbackPoster = resolveCreativePosterUrl(creative);
      if (fallbackPoster) c.video_picture_url = fallbackPoster;
    }
  }

  const imageHashes = new Set<string>();
  for (const ad of allAds) {
    const creative = ad.adcreatives?.data?.[0];
    if (!creative) continue;
    for (const hash of collectCreativeImageHashes(creative)) {
      imageHashes.add(hash);
    }
  }

  const imageUrlsByHash = imageHashes.size > 0
    ? await fetchAdImagesByHash(actId, Array.from(imageHashes), token)
    : new Map<string, string>();

  for (const ad of allAds) {
    const creative = ad.adcreatives?.data?.[0];
    if (!creative) continue;
    const resolvedImageUrl = resolveCreativeImageUrl(creative, imageUrlsByHash);
    if (resolvedImageUrl) {
      const upgraded = upgradeFbCdnImageUrl(resolvedImageUrl) || resolvedImageUrl;
      (creative as MetaAdCreative).image_url_full = upgraded;
    }
    if (!creative.video_picture_url) {
      const fallbackPoster = resolveCreativePosterUrl(creative);
      if (fallbackPoster) (creative as MetaAdCreative).video_picture_url = fallbackPoster;
    }
  }

  return allAds;
}

/**
 * Row returned from the Meta ad-level insights endpoint.
 * Used to analyse per-property-ID performance for Miguel Imóveis.
 */
export interface MetaAdLevelInsightRow {
  ad_id: string;
  ad_name: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Array<{ action_type: string; value: string }>;
}

interface MetaAdLevelInsightsResponse {
  data: MetaAdLevelInsightRow[];
  paging?: { cursors?: { before: string; after: string }; next?: string };
  error?: { message: string; type: string; code: number };
}

/**
 * Fetch ad-level insights (all ads, including inactive ones) for a date range.
 * Unlike fetchAdsWithCreatives this endpoint is not filtered to active ads and
 * returns all ads that had delivery in the period — ideal for historical reporting.
 */
export async function fetchAdLevelInsights(
  accountId: string,
  token: string,
  dateFrom: string,
  dateTo: string
): Promise<MetaAdLevelInsightRow[]> {
  const actId = ensureActPrefix(accountId);
  const params = new URLSearchParams({
    access_token: token,
    level: "ad",
    fields: "ad_id,ad_name,spend,impressions,clicks,actions",
    time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
    limit: "500",
  });

  const all: MetaAdLevelInsightRow[] = [];
  let url: string | null = `${GRAPH_BASE}/${actId}/insights?${params.toString()}`;

  while (url) {
    const res = await fetch(url);
    const data = (await res.json()) as MetaAdLevelInsightsResponse;
    if (!res.ok) {
      throw new Error(data?.error?.message ?? `Meta API error: ${res.status}`);
    }
    if (data.error) {
      throw new Error(data.error.message);
    }
    if (data.data?.length) {
      all.push(...data.data);
    }
    url = data.paging?.next ?? null;
  }

  return all;
}
