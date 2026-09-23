/**
 * Resolve conexões do Config para uso pelos módulos.
 * Tokens vêm de WorkspaceConnection (credentialsEnc) — nunca hardcode.
 * Doc: docs/INTEGRATIONS.md
 */

import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";

export async function resolveMercadoPago(workspaceId: string) {
  const row = await getWorkspaceConnection(workspaceId, "MERCADO_PAGO");
  if (!row || row.status !== "ACTIVE") return null;
  const c = row.credentials;
  const accessToken = typeof c.accessToken === "string" ? c.accessToken : null;
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: typeof c.refreshToken === "string" ? c.refreshToken : null,
    publicKey: typeof c.publicKey === "string" ? c.publicKey : null,
  };
}

export async function resolveMercadoLivre(workspaceId: string) {
  const row = await getWorkspaceConnection(workspaceId, "MERCADO_LIVRE");
  if (!row || row.status !== "ACTIVE") return null;
  const c = row.credentials;
  const accessToken = typeof c.accessToken === "string" ? c.accessToken : null;
  if (!accessToken) return null;
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : null;
  const meliUserId =
    typeof metadata?.meliUserId === "number"
      ? metadata.meliUserId
      : typeof metadata?.meliUserId === "string"
        ? Number(metadata.meliUserId)
        : typeof c.userId === "number"
          ? c.userId
          : null;
  return {
    connectionId: row.id,
    accessToken,
    refreshToken: typeof c.refreshToken === "string" ? c.refreshToken : null,
    expiresAt: typeof c.expiresAt === "string" ? c.expiresAt : null,
    meliUserId: Number.isFinite(meliUserId) ? meliUserId : null,
    metadata: row.metadata,
  };
}

export async function resolveInstagram(workspaceId: string) {
  const row = await getWorkspaceConnection(workspaceId, "INSTAGRAM");
  if (!row || row.status !== "ACTIVE") return null;
  const c = row.credentials;
  const accessToken = typeof c.accessToken === "string" ? c.accessToken : null;
  if (!accessToken) return null;
  return {
    accessToken,
    expiresIn: typeof c.expiresIn === "number" ? c.expiresIn : null,
  };
}

export async function resolveMetaAds(workspaceId: string) {
  const row = await getWorkspaceConnection(workspaceId, "META_ADS");
  if (
    !row ||
    row.status === "DISCONNECTED" ||
    row.status === "REVOKED" ||
    (row.status !== "ACTIVE" && row.status !== "NEEDS_REAUTH")
  ) {
    return null;
  }
  const c = row.credentials;
  const accessToken = typeof c.accessToken === "string" ? c.accessToken : null;
  if (!accessToken) return null;
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : null;
  const selectedAdAccountId =
    typeof metadata?.selectedAdAccountId === "string"
      ? metadata.selectedAdAccountId
      : null;
  return {
    connectionId: row.id,
    label: row.label,
    metadata: row.metadata,
    accessToken,
    adAccountId: selectedAdAccountId,
    status: row.status,
  };
}

/** WhatsApp Cloud API — tokens e phone_number_id do Config (nunca env de módulo). */
export async function resolveWhatsApp(workspaceId: string) {
  const row = await getWorkspaceConnection(workspaceId, "WHATSAPP");
  if (!row || row.status !== "ACTIVE") return null;
  const c = row.credentials;
  const accessToken = typeof c.accessToken === "string" ? c.accessToken : null;
  const phoneNumberId = typeof c.phoneNumberId === "string" ? c.phoneNumberId : null;
  const wabaId = typeof c.wabaId === "string" ? c.wabaId : null;
  if (!accessToken || !phoneNumberId) return null;
  return {
    accessToken,
    phoneNumberId,
    wabaId,
    webhookVerifyToken:
      typeof c.webhookVerifyToken === "string" ? c.webhookVerifyToken : null,
    displayPhoneNumber:
      typeof (row.metadata as { displayPhoneNumber?: string } | null)?.displayPhoneNumber ===
      "string"
        ? (row.metadata as { displayPhoneNumber: string }).displayPhoneNumber
        : null,
  };
}
