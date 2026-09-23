/**
 * Resolve Instagram do hub Atrako e sincroniza no IgAccount local.
 */

import { prisma } from "@/lib/db";

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

export async function fetchInstagramFromAtrako(
  workspaceId?: string | null,
): Promise<{ accessToken: string; expiresIn?: number | null; label?: string | null } | null> {
  const ws = workspaceId?.trim() || getAtrakoWorkspaceId();
  if (!ws) return null;

  const token = serviceToken();
  const url = `${atrakoBaseUrl()}/api/atrako/connections?workspaceId=${encodeURIComponent(ws)}&provider=INSTAGRAM`;

  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      connection?: {
        status?: string;
        label?: string | null;
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
      expiresIn:
        typeof conn.credentials.expiresIn === "number"
          ? conn.credentials.expiresIn
          : null,
      label: conn.label ?? null,
    };
  } catch {
    return null;
  }
}

/** Garante IgAccount local com token do hub (para embed Atrako). */
export async function syncInstagramFromAtrakoHub(organizationId: string) {
  const hub = await fetchInstagramFromAtrako();
  if (!hub) return null;

  const existing = await prisma.igAccount.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });

  const tokenExpiresAt =
    hub.expiresIn != null
      ? new Date(Date.now() + hub.expiresIn * 1000)
      : null;

  if (existing) {
    return prisma.igAccount.update({
      where: { id: existing.id },
      data: {
        accessToken: hub.accessToken,
        status: "CONNECTED",
        tokenExpiresAt,
        igUsername: existing.igUsername || hub.label || "instagram",
      },
    });
  }

  return prisma.igAccount.create({
    data: {
      organizationId,
      pageId: `atrako-hub-${organizationId.slice(-8)}`,
      pageName: hub.label || "Instagram (Atrako)",
      accessToken: hub.accessToken,
      igUserId: `hub-${organizationId.slice(-10)}`,
      igUsername: hub.label || "instagram",
      status: "CONNECTED",
      tokenExpiresAt,
      messagesEnabled: true,
    },
  });
}
