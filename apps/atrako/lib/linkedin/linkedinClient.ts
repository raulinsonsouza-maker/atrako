import crypto from "crypto";
import { prisma } from "@/lib/db";

/**
 * Cliente da LinkedIn Marketing API (read-only).
 *
 * Credenciais do app (LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET) vêm de env vars.
 * Tokens OAuth (access + refresh) ficam por conexão em ConexaoIntegracao.
 * Escopos necessários: r_ads, r_ads_reporting.
 */

const LINKEDIN_API_BASE = "https://api.linkedin.com/rest";
const LINKEDIN_OAUTH_BASE = "https://www.linkedin.com/oauth/v2";
export const LINKEDIN_API_VERSION = "202606";
export const LINKEDIN_SCOPES = ["r_ads", "r_ads_reporting"];

// margem de segurança antes de expirar (5 min)
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

export async function getLinkedinAppCredentials(): Promise<{ clientId: string; clientSecret: string } | null> {
  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("LINKEDIN");
  const clientId = app?.credentials.clientId?.trim() || process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = app?.credentials.clientSecret?.trim() || process.env.LINKEDIN_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * State assinado (HMAC) para o fluxo OAuth: impede CSRF/replay sem estado no
 * servidor. Formato: `${conexaoId}.${expEpochMs}.${hmacHex}`.
 */
function stateSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado");
  return secret;
}

export function signOauthState(
  conexaoId: string,
  initiatedByInternalUserId: string,
  ttlMs = 10 * 60 * 1000,
): string {
  const exp = Date.now() + ttlMs;
  const payload = `${conexaoId}.${initiatedByInternalUserId}.${exp}`;
  const sig = crypto.createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyOauthState(
  state: string,
): { conexaoId: string; initiatedByInternalUserId: string } | null {
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [conexaoId, initiatedByInternalUserId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!conexaoId || !initiatedByInternalUserId || !Number.isFinite(exp) || Date.now() > exp) return null;
  const expected = crypto
    .createHmac("sha256", stateSecret())
    .update(`${conexaoId}.${initiatedByInternalUserId}.${exp}`)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { conexaoId, initiatedByInternalUserId };
}

/**
 * Origem pública da aplicação, confiável atrás de proxy (produção Replit).
 * `req.nextUrl.origin` resolve para o bind local (ex: https://0.0.0.0:5000)
 * em produção — usamos x-forwarded-host/proto para obter o domínio real.
 */
export function getPublicOrigin(req: { headers: Headers; nextUrl: { origin: string } }): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host && !host.startsWith("0.0.0.0") && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
  }
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}`;
  }
  return req.nextUrl.origin;
}

export async function buildLinkedinAuthUrl(redirectUri: string, state: string): Promise<string | null> {
  const creds = await getLinkedinAppCredentials();
  if (!creds) return null;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    state,
    scope: LINKEDIN_SCOPES.join(" "),
  });
  return `${LINKEDIN_OAUTH_BASE}/authorization?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number; // seconds
  refresh_token?: string;
  refresh_token_expires_in?: number; // seconds
}

export async function exchangeLinkedinCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const creds = await getLinkedinAppCredentials();
  if (!creds) throw new Error("LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET não configurados");
  const res = await fetch(`${LINKEDIN_OAUTH_BASE}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn OAuth token exchange falhou (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

async function refreshLinkedinToken(conexaoId: string, refreshToken: string): Promise<string> {
  const creds = await getLinkedinAppCredentials();
  if (!creds) throw new Error("LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET não configurados");
  const res = await fetch(`${LINKEDIN_OAUTH_BASE}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn refresh token falhou (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as TokenResponse;
  const now = Date.now();
  await prisma.conexaoIntegracao.update({
    where: { id: conexaoId },
    data: {
      linkedinAccessToken: data.access_token,
      linkedinTokenExpiresAt: new Date(now + data.expires_in * 1000),
      ...(data.refresh_token
        ? {
            linkedinRefreshToken: data.refresh_token,
            linkedinRefreshTokenExpiresAt: data.refresh_token_expires_in
              ? new Date(now + data.refresh_token_expires_in * 1000)
              : undefined,
          }
        : {}),
    },
  });
  return data.access_token;
}

/**
 * Access token via WorkspaceConnection LINKEDIN_ADS (hub-first).
 */
export async function getValidLinkedinAccessTokenForWorkspace(clienteId: string): Promise<string> {
  const { getWorkspaceConnection, upsertWorkspaceConnection } = await import(
    "@/lib/atrako/workspace-connections"
  );
  const hub = await getWorkspaceConnection(clienteId, "LINKEDIN_ADS");
  if (!hub || typeof hub.credentials.accessToken !== "string" || !hub.credentials.accessToken) {
    throw new Error("LinkedIn não conectado — use Config → Conexões");
  }
  const expiresAt =
    typeof hub.credentials.expiresAt === "string" || typeof hub.credentials.expiresAt === "number"
      ? new Date(hub.credentials.expiresAt as string | number).getTime()
      : null;
  const refreshToken =
    typeof hub.credentials.refreshToken === "string" ? hub.credentials.refreshToken : null;
  if (expiresAt && Date.now() > expiresAt - TOKEN_EXPIRY_MARGIN_MS && refreshToken) {
    const creds = await getLinkedinAppCredentials();
    if (!creds) throw new Error("App LinkedIn não configurado em /admin/apps");
    const res = await fetch(`${LINKEDIN_OAUTH_BASE}/accessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LinkedIn refresh token falhou (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as TokenResponse;
    const now = Date.now();
    await upsertWorkspaceConnection({
      clienteId,
      provider: "LINKEDIN_ADS",
      label: hub.label,
      credentials: {
        ...hub.credentials,
        accessToken: data.access_token,
        expiresAt: new Date(now + data.expires_in * 1000).toISOString(),
        ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
      },
      metadata: hub.metadata as Record<string, unknown> | null,
      status: hub.status,
    });
    return data.access_token;
  }
  return hub.credentials.accessToken;
}

/**
 * Retorna um access token válido para a conexão, renovando automaticamente
 * se estiver perto de expirar e houver refresh token.
 */
export async function getValidLinkedinAccessToken(conexaoId: string): Promise<string> {
  const conexao = await prisma.conexaoIntegracao.findUnique({ where: { id: conexaoId } });
  if (!conexao || !conexao.linkedinAccessToken) {
    throw new Error("Conexão LinkedIn sem token — conclua o fluxo OAuth no painel admin");
  }
  const expiresAt = conexao.linkedinTokenExpiresAt?.getTime() ?? 0;
  const needsRefresh = expiresAt > 0 && expiresAt - TOKEN_EXPIRY_MARGIN_MS < Date.now();
  if (needsRefresh && conexao.linkedinRefreshToken) {
    return refreshLinkedinToken(conexao.id, conexao.linkedinRefreshToken);
  }
  return conexao.linkedinAccessToken;
}

async function linkedinGet(accessToken: string, pathAndQuery: string): Promise<unknown> {
  const res = await fetch(`${LINKEDIN_API_BASE}${pathAndQuery}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn API ${res.status} em ${pathAndQuery.split("?")[0]}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export interface LinkedinCampaignInfo {
  id: string;
  name: string;
  status: string | null;
  type: string | null;
}

/** Lista campanhas de uma conta de anúncios (sponsoredAccount id numérico). */
export async function fetchLinkedinCampaigns(
  accessToken: string,
  adAccountId: string
): Promise<LinkedinCampaignInfo[]> {
  const campaigns: LinkedinCampaignInfo[] = [];
  let start = 0;
  const count = 100;
  for (let page = 0; page < 20; page++) {
    const data = (await linkedinGet(
      accessToken,
      `/adAccounts/${adAccountId}/adCampaigns?q=search&start=${start}&count=${count}`
    )) as { elements?: Array<{ id?: number | string; name?: string; status?: string; type?: string }> };
    const elements = data.elements ?? [];
    for (const el of elements) {
      if (el.id == null) continue;
      campaigns.push({
        id: String(el.id),
        name: el.name ?? `Campanha ${el.id}`,
        status: el.status ?? null,
        type: el.type ?? null,
      });
    }
    if (elements.length < count) break;
    start += count;
  }
  return campaigns;
}

export interface LinkedinDailyMetric {
  campaignId: string;
  date: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  cost: number; // moeda local da conta
  conversions: number;
  leads: number; // oneClickLeads (Lead Gen Forms)
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Métricas diárias por campanha via adAnalytics (pivot CAMPAIGN, DAILY).
 */
export async function fetchLinkedinDailyAnalytics(
  accessToken: string,
  adAccountId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<LinkedinDailyMetric[]> {
  const dateRange =
    `(start:(year:${dataInicio.getUTCFullYear()},month:${dataInicio.getUTCMonth() + 1},day:${dataInicio.getUTCDate()}),` +
    `end:(year:${dataFim.getUTCFullYear()},month:${dataFim.getUTCMonth() + 1},day:${dataFim.getUTCDate()}))`;
  const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${adAccountId}`);
  const fields = [
    "impressions",
    "clicks",
    "costInLocalCurrency",
    "externalWebsiteConversions",
    "oneClickLeads",
    "dateRange",
    "pivotValues",
  ].join(",");

  const data = (await linkedinGet(
    accessToken,
    `/adAnalytics?q=analytics&pivot=CAMPAIGN&timeGranularity=DAILY` +
      `&dateRange=${dateRange}&accounts=List(${accountUrn})&fields=${fields}`
  )) as {
    elements?: Array<{
      pivotValues?: string[];
      dateRange?: { start?: { year: number; month: number; day: number } };
      impressions?: number;
      clicks?: number;
      costInLocalCurrency?: string | number;
      externalWebsiteConversions?: number;
      oneClickLeads?: number;
    }>;
  };

  const metrics: LinkedinDailyMetric[] = [];
  for (const el of data.elements ?? []) {
    const urn = el.pivotValues?.[0] ?? "";
    const campaignId = urn.replace(/^urn:li:sponsoredCampaign:/, "");
    const s = el.dateRange?.start;
    if (!campaignId || !s) continue;
    metrics.push({
      campaignId,
      date: `${s.year}-${pad2(s.month)}-${pad2(s.day)}`,
      impressions: el.impressions ?? 0,
      clicks: el.clicks ?? 0,
      cost: Number(el.costInLocalCurrency ?? 0) || 0,
      conversions: el.externalWebsiteConversions ?? 0,
      leads: el.oneClickLeads ?? 0,
    });
  }
  return metrics;
}

/** Testa a conexão listando contas de anúncios acessíveis. */
export async function testLinkedinConnection(
  accessToken: string
): Promise<{ ok: boolean; accounts: Array<{ id: string; name: string }>; error?: string }> {
  try {
    const data = (await linkedinGet(
      accessToken,
      "/adAccounts?q=search&start=0&count=25"
    )) as { elements?: Array<{ id?: number | string; name?: string }> };
    const accounts = (data.elements ?? [])
      .filter((el) => el.id != null)
      .map((el) => ({ id: String(el.id), name: el.name ?? String(el.id) }));
    return { ok: true, accounts };
  } catch (e) {
    return { ok: false, accounts: [], error: e instanceof Error ? e.message : String(e) };
  }
}
