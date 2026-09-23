/**
 * Credential resolver for multi-BM (Meta) and multi-MCC (Google Ads) support.
 *
 * Priority:
 *   1. Conta.conexaoIntegracaoId → credentials stored in ConexaoIntegracao row
 *   2. Global SystemConfig / env vars (existing behavior for all current clients)
 */
import { prisma } from "@/lib/db";
import { getIntegrationsConfig } from "@/lib/config/integrations";

export interface MetaCredentials {
  token: string;
  accountId: string | null;
  connectionName?: string;
}

export interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  loginCustomerId: string | null;
  connectionName?: string;
}

/**
 * Resolve Meta credentials for a given clienteId.
 * If the client's META Conta has a `conexaoIntegracaoId`, credentials come from that connection.
 * Otherwise falls back to global SystemConfig / env.
 */
export async function resolveMetaCredentials(
  clienteId: string,
): Promise<MetaCredentials | null> {
  const conta = await prisma.conta.findFirst({
    where: { clienteId, plataforma: "META" },
    include: { conexaoIntegracao: true },
  });

  const conn = conta?.conexaoIntegracao;
  if (conn?.ativo && conn.metaAccessToken) {
    return {
      token: conn.metaAccessToken,
      accountId: conta?.accountIdPlataforma ?? null,
      connectionName: conn.nome,
    };
  }

  // Fallback: global config
  const global = await getIntegrationsConfig();
  const token = global.metaAccessToken ?? process.env.META_ACCESS_TOKEN ?? null;
  if (!token) return null;
  return {
    token,
    accountId: conta?.accountIdPlataforma ?? global.metaAdAccountId ?? process.env.META_AD_ACCOUNT_ID ?? null,
  };
}

/**
 * Resolve Google Ads credentials for a given clienteId.
 * If the client's GOOGLE_ADS Conta has a `conexaoIntegracaoId`, credentials come from that connection.
 * Otherwise falls back to global SystemConfig / env.
 */
export async function resolveGoogleAdsCredentials(
  clienteId: string,
): Promise<GoogleAdsCredentials | null> {
  const conta = await prisma.conta.findFirst({
    where: { clienteId, plataforma: "GOOGLE_ADS" },
    include: { conexaoIntegracao: true },
  });

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
    };
  }

  // Fallback: global config
  const global = await getIntegrationsConfig();
  const clientId = global.googleClientId ?? process.env.GOOGLE_ADS_CLIENT_ID ?? null;
  const clientSecret = global.googleClientSecret ?? process.env.GOOGLE_ADS_CLIENT_SECRET ?? null;
  const developerToken = global.googleDeveloperToken ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? null;
  const refreshToken = global.googleRefreshToken ?? process.env.GOOGLE_ADS_REFRESH_TOKEN ?? null;
  if (!clientId || !clientSecret || !developerToken || !refreshToken) return null;
  return {
    clientId,
    clientSecret,
    developerToken,
    refreshToken,
    loginCustomerId:
      conta?.googleAdsLoginCustomerId ??
      global.googleLoginCustomerId ??
      process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ??
      null,
  };
}
