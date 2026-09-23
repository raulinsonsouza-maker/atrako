/**
 * Resolve credenciais do hub Atrako (WorkspaceConnection).
 * Fallback: conexões locais do Commerce.
 */

export type MercadoPagoHubCredentials = {
  accessToken: string;
  refreshToken?: string | null;
  publicKey?: string | null;
  userId?: number | null;
  liveMode?: boolean | null;
};

function atrakoBaseUrl() {
  return (
    process.env.ATRAKO_URL?.trim() ||
    process.env.ATRAKO_SHELL_URL?.trim() ||
    "http://localhost:5000"
  ).replace(/\/$/, "");
}

function serviceToken() {
  return (
    process.env.ATRAKO_CONNECTIONS_TOKEN?.trim() ||
    process.env.ATRAKO_EVENTS_TOKEN?.trim() ||
    ""
  );
}

export function getAtrakoWorkspaceId(): string | null {
  return process.env.ATRAKO_WORKSPACE_ID?.trim() || null;
}

export async function fetchMercadoPagoFromAtrako(
  workspaceId?: string | null,
): Promise<MercadoPagoHubCredentials | null> {
  const ws = workspaceId?.trim() || getAtrakoWorkspaceId();
  if (!ws) return null;

  const token = serviceToken();
  const url = `${atrakoBaseUrl()}/api/atrako/connections?workspaceId=${encodeURIComponent(ws)}&provider=MERCADO_PAGO`;

  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      connection?: {
        status?: string;
        credentials?: Record<string, unknown>;
      } | null;
    };
    const conn = json.connection;
    if (!conn || conn.status !== "ACTIVE" || !conn.credentials) return null;
    const accessToken =
      typeof conn.credentials.accessToken === "string"
        ? conn.credentials.accessToken
        : null;
    if (!accessToken) return null;
    return {
      accessToken,
      refreshToken:
        typeof conn.credentials.refreshToken === "string"
          ? conn.credentials.refreshToken
          : null,
      publicKey:
        typeof conn.credentials.publicKey === "string"
          ? conn.credentials.publicKey
          : null,
      userId:
        typeof conn.credentials.userId === "number"
          ? conn.credentials.userId
          : null,
      liveMode:
        typeof conn.credentials.liveMode === "boolean"
          ? conn.credentials.liveMode
          : null,
    };
  } catch {
    return null;
  }
}
