/**
 * Credential resolver for multi-BM (Meta) and multi-MCC (Google Ads) support.
 *
 * Priority (Meta):
 *   1. WorkspaceConnection META_ADS (hub /config/conexoes — AES)
 *   2. Conta.conexaoIntegracaoId → ConexaoIntegracao (legado dual-read)
 *   3. Global SystemConfig / env (legado dual-read)
 *
 * Priority (Google Ads):
 *   1. WorkspaceConnection GOOGLE_ADS + PlatformApp GOOGLE_ADS
 *   2. Conta.conexaoIntegracao (legado)
 *   3. PlatformApp / SystemConfig / env (legado)
 */
import { prisma } from "@/lib/db";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { resolvePlatformApp } from "@/lib/config/platformApps";
import { normalizeAdAccountId } from "@/lib/integrations/meta/graph";
import { parseMetaAdsMetadata } from "@/lib/integrations/meta/types";

export interface MetaCredentials {
  token: string;
  accountId: string | null;
  connectionName?: string;
  source?: "workspace_connection" | "conexao_integracao" | "global";
}

export interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  loginCustomerId: string | null;
  connectionName?: string;
  source?: "workspace_connection" | "conexao_integracao" | "global";
}

/**
 * Resolve Meta credentials for a given clienteId (= workspaceId).
 */
export async function resolveMetaCredentials(
  clienteId: string,
): Promise<MetaCredentials | null> {
  const conta = await prisma.conta.findFirst({
    where: { clienteId, plataforma: "META" },
    include: { conexaoIntegracao: true },
  });

  const hub = await getWorkspaceConnection(clienteId, "META_ADS");
  if (
    hub &&
    hub.status !== "DISCONNECTED" &&
    hub.status !== "REVOKED" &&
    typeof hub.credentials.accessToken === "string" &&
    hub.credentials.accessToken
  ) {
    const metadata = parseMetaAdsMetadata(hub.metadata);
    const fromMeta = metadata.selectedAdAccountId
      ? normalizeAdAccountId(metadata.selectedAdAccountId)
      : null;
    const fromConta = conta?.accountIdPlataforma
      ? normalizeAdAccountId(conta.accountIdPlataforma)
      : null;
    return {
      token: hub.credentials.accessToken,
      accountId: fromMeta ?? fromConta,
      connectionName: hub.label ?? metadata.businessName ?? "Meta Ads",
      source: "workspace_connection",
    };
  }

  const conn = conta?.conexaoIntegracao;
  if (conn?.ativo && conn.metaAccessToken) {
    return {
      token: conn.metaAccessToken,
      accountId: conta?.accountIdPlataforma ?? null,
      connectionName: conn.nome,
      source: "conexao_integracao",
    };
  }

  // Fallback: global config (legado only — dual-read)
  const global = await getIntegrationsConfig();
  const token = global.metaAccessToken ?? process.env.META_ACCESS_TOKEN ?? null;
  if (!token) return null;
  return {
    token,
    accountId:
      conta?.accountIdPlataforma ??
      global.metaAdAccountId ??
      process.env.META_AD_ACCOUNT_ID ??
      null,
    source: "global",
  };
}

/**
 * Resolve Google Ads credentials for a given clienteId.
 * Hub-first: WorkspaceConnection GOOGLE_ADS + PlatformApp for client/secret/devToken.
 */
export async function resolveGoogleAdsCredentials(
  clienteId: string,
): Promise<GoogleAdsCredentials | null> {
  const conta = await prisma.conta.findFirst({
    where: { clienteId, plataforma: "GOOGLE_ADS" },
    include: { conexaoIntegracao: true },
  });

  const platform = await resolvePlatformApp("GOOGLE_ADS");
  const hub = await getWorkspaceConnection(clienteId, "GOOGLE_ADS");
  if (
    hub &&
    hub.status !== "DISCONNECTED" &&
    hub.status !== "REVOKED" &&
    typeof hub.credentials.refreshToken === "string" &&
    hub.credentials.refreshToken
  ) {
    const clientId =
      (typeof hub.credentials.clientId === "string" && hub.credentials.clientId) ||
      platform?.credentials.clientId ||
      null;
    const clientSecret =
      (typeof hub.credentials.clientSecret === "string" && hub.credentials.clientSecret) ||
      platform?.credentials.clientSecret ||
      null;
    const developerToken =
      (typeof hub.credentials.developerToken === "string" && hub.credentials.developerToken) ||
      platform?.credentials.developerToken ||
      null;
    if (clientId && clientSecret && developerToken) {
      const loginFromHub =
        (typeof hub.credentials.loginCustomerId === "string" && hub.credentials.loginCustomerId) ||
        (hub.metadata &&
        typeof hub.metadata === "object" &&
        hub.metadata !== null &&
        "loginCustomerId" in hub.metadata &&
        typeof (hub.metadata as { loginCustomerId?: unknown }).loginCustomerId === "string"
          ? (hub.metadata as { loginCustomerId: string }).loginCustomerId
          : null);
      return {
        clientId,
        clientSecret,
        developerToken,
        refreshToken: hub.credentials.refreshToken,
        loginCustomerId:
          loginFromHub ??
          conta?.googleAdsLoginCustomerId ??
          platform?.credentials.loginCustomerId ??
          null,
        connectionName: hub.label ?? "Google Ads",
        source: "workspace_connection",
      };
    }
  }

  const conn = conta?.conexaoIntegracao;
  if (
    conn?.ativo &&
    conn.googleClientId &&
    conn.googleClientSecret &&
    conn.googleDeveloperToken &&
    conn.googleRefreshToken
  ) {
    return {
      clientId: conn.googleClientId,
      clientSecret: conn.googleClientSecret,
      developerToken: conn.googleDeveloperToken,
      refreshToken: conn.googleRefreshToken,
      loginCustomerId: conn.googleLoginCustomerId ?? conta?.googleAdsLoginCustomerId ?? null,
      connectionName: conn.nome,
      source: "conexao_integracao",
    };
  }

  const global = await getIntegrationsConfig();
  const clientId =
    platform?.credentials.clientId ??
    global.googleClientId ??
    process.env.GOOGLE_ADS_CLIENT_ID ??
    null;
  const clientSecret =
    platform?.credentials.clientSecret ??
    global.googleClientSecret ??
    process.env.GOOGLE_ADS_CLIENT_SECRET ??
    null;
  const developerToken =
    platform?.credentials.developerToken ??
    global.googleDeveloperToken ??
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN ??
    null;
  const refreshToken =
    platform?.credentials.refreshToken ??
    global.googleRefreshToken ??
    process.env.GOOGLE_ADS_REFRESH_TOKEN ??
    null;
  if (!clientId || !clientSecret || !developerToken || !refreshToken) {
    return null;
  }
  return {
    clientId,
    clientSecret,
    developerToken,
    refreshToken,
    loginCustomerId:
      conta?.googleAdsLoginCustomerId ??
      platform?.credentials.loginCustomerId ??
      global.googleLoginCustomerId ??
      null,
    source: "global",
  };
}
