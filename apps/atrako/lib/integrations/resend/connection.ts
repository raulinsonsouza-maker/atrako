/**
 * Conta Resend por loja (WorkspaceConnection RESEND) + fallback interno (PlatformApp RESEND).
 * credentials: apiKey, webhookSecret · metadata: fromName, fromEmail, replyTo, domain, domainId,
 * domainStatus, domainVerifiedAt, webhookId, lastWebhookAt.
 */

import { prisma } from "@/lib/db";
import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";

export type ResendConnection = {
  apiKey: string;
  webhookSecret: string | null;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  domain: string | null;
  domainId: string | null;
  domainStatus: string | null;
  domainVerifiedAt: string | null;
  webhookId: string | null;
  lastWebhookAt: string | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function resolveResend(workspaceId: string): Promise<ResendConnection | null> {
  const row = await getWorkspaceConnection(workspaceId, "RESEND");
  if (!row || row.status !== "ACTIVE") return null;
  const apiKey = str(row.credentials.apiKey);
  if (!apiKey) return null;
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    apiKey,
    webhookSecret: str(row.credentials.webhookSecret),
    fromName: str(m.fromName),
    fromEmail: str(m.fromEmail),
    replyTo: str(m.replyTo),
    domain: str(m.domain),
    domainId: str(m.domainId),
    domainStatus: str(m.domainStatus),
    domainVerifiedAt: str(m.domainVerifiedAt),
    webhookId: str(m.webhookId),
    lastWebhookAt: str(m.lastWebhookAt),
  };
}

/** Fluxos só enviam com domínio verificado e remetente escolhido. */
export function resendReady(conn: ResendConnection | null): conn is ResendConnection {
  return Boolean(conn && conn.fromEmail && conn.domainStatus === "verified");
}

export function formatFrom(conn: Pick<ResendConnection, "fromName" | "fromEmail">, fallbackName: string) {
  const name = (conn.fromName || fallbackName).replace(/[<>"]/g, "").trim();
  return name ? `${name} <${conn.fromEmail}>` : String(conn.fromEmail);
}

export async function patchResendMetadata(workspaceId: string, patch: Record<string, unknown>) {
  const row = await prisma.workspaceConnection.findUnique({
    where: { clienteId_provider: { clienteId: workspaceId, provider: "RESEND" } },
    select: { id: true, metadata: true },
  });
  if (!row) return;
  const prev = (row.metadata ?? {}) as Record<string, unknown>;
  await prisma.workspaceConnection.update({
    where: { id: row.id },
    data: { metadata: { ...prev, ...patch } as object },
  });
}

/** API key da plataforma — só avisos internos da equipe e envios de teste sem conta da loja. */
export async function resolvePlatformResend(): Promise<{ apiKey: string; from: string } | null> {
  try {
    const { resolvePlatformApp } = await import("@/lib/config/platformApps");
    const app = await resolvePlatformApp("RESEND");
    const apiKey = str(app?.credentials.clientSecret);
    if (!app?.enabled || !apiKey) return null;
    return { apiKey, from: str(app.credentials.clientId) || "Atrako <avisos@atrako.com.br>" };
  } catch {
    return null;
  }
}

/**
 * Aquecimento automático: teto diário crescente pela idade da verificação do domínio.
 * 200 → 500 → 1.000 → 2.500 → 5.000 → 10.000 → sem teto (após ~6 semanas).
 */
export function warmupDailyCap(domainVerifiedAt: string | null, now = new Date()): number | null {
  if (!domainVerifiedAt) return 200;
  const days = Math.floor((now.getTime() - new Date(domainVerifiedAt).getTime()) / 86_400_000);
  if (days < 3) return 200;
  if (days < 7) return 500;
  if (days < 14) return 1000;
  if (days < 21) return 2500;
  if (days < 28) return 5000;
  if (days < 42) return 10000;
  return null;
}
