/**
 * Persistência Meta Ads: WorkspaceConnection + Conta bridge para o dashboard.
 */

import { prisma } from "@/lib/db";
import {
  getWorkspaceConnection,
  upsertWorkspaceConnection,
} from "@/lib/atrako/workspace-connections";
import { normalizeAdAccountId } from "@/lib/integrations/meta/graph";
import {
  parseMetaAdsMetadata,
  type MetaAdsConnectionMetadata,
  type MetaConnectionHealth,
} from "@/lib/integrations/meta/types";

export function computeMetaHealth(
  metadata: MetaAdsConnectionMetadata,
  status?: string,
): MetaConnectionHealth {
  if (status === "DISCONNECTED" || status === "REVOKED") return "disconnected";
  if (status === "NEEDS_REAUTH" || metadata.health === "needs_reauth") return "needs_reauth";
  if (metadata.health === "sync_error") return "sync_error";
  if (metadata.selectedAdAccountId) return "ready";
  if (metadata.adAccounts?.length) return "connected_pending_account";
  return "connected_pending_account";
}

export async function upsertMetaContaForWorkspace(
  clienteId: string,
  adAccountId: string,
  nomeConta?: string | null,
) {
  const normalized = normalizeAdAccountId(adAccountId);
  const existing = await prisma.conta.findFirst({
    where: { clienteId, plataforma: "META" },
  });
  if (existing) {
    return prisma.conta.update({
      where: { id: existing.id },
      data: {
        accountIdPlataforma: normalized,
        nomeConta: nomeConta ?? existing.nomeConta ?? undefined,
      },
    });
  }
  return prisma.conta.create({
    data: {
      clienteId,
      plataforma: "META",
      accountIdPlataforma: normalized,
      nomeConta: nomeConta ?? null,
    },
  });
}

export async function selectMetaAdAccount(input: {
  workspaceId: string;
  adAccountId: string;
}): Promise<{ metadata: MetaAdsConnectionMetadata; contaId: string }> {
  const row = await getWorkspaceConnection(input.workspaceId, "META_ADS");
  if (!row || row.status === "DISCONNECTED" || row.status === "REVOKED") {
    throw new Error("Conexão Meta não encontrada. Conecte novamente.");
  }
  const metadata = parseMetaAdsMetadata(row.metadata);
  const wanted = normalizeAdAccountId(input.adAccountId);
  const match = metadata.adAccounts.find((a) => normalizeAdAccountId(a.id) === wanted);
  if (!match) {
    throw new Error("Conta de anúncio inválida para esta conexão.");
  }

  const nextMeta: MetaAdsConnectionMetadata = {
    ...metadata,
    selectedAdAccountId: wanted,
    health: "ready",
    lastError: null,
  };

  await upsertWorkspaceConnection({
    clienteId: input.workspaceId,
    provider: "META_ADS",
    label: metadata.businessName
      ? `${metadata.businessName} · ${match.name}`
      : match.name,
    credentials: row.credentials,
    metadata: nextMeta,
    status: "ACTIVE",
  });

  const conta = await upsertMetaContaForWorkspace(input.workspaceId, wanted, match.name);
  return { metadata: nextMeta, contaId: conta.id };
}

export async function markMetaConnectionHealth(
  workspaceId: string,
  health: MetaConnectionHealth,
  lastError?: string | null,
) {
  const row = await getWorkspaceConnection(workspaceId, "META_ADS");
  if (!row) return;
  const metadata = parseMetaAdsMetadata(row.metadata);
  const next: MetaAdsConnectionMetadata = {
    ...metadata,
    health,
    lastError: lastError ?? null,
  };
  const status =
    health === "needs_reauth"
      ? "NEEDS_REAUTH"
      : health === "disconnected"
        ? "DISCONNECTED"
        : "ACTIVE";
  await upsertWorkspaceConnection({
    clienteId: workspaceId,
    provider: "META_ADS",
    label: row.label,
    credentials: health === "disconnected" ? {} : row.credentials,
    metadata: next,
    status,
  });
}

export async function getMetaConnectionStatus(workspaceId: string) {
  const row = await getWorkspaceConnection(workspaceId, "META_ADS");
  if (!row) {
    return {
      connected: false,
      health: "disconnected" as MetaConnectionHealth,
      businessName: null as string | null,
      businessId: null as string | null,
      adAccounts: [] as MetaAdsConnectionMetadata["adAccounts"],
      selectedAdAccountId: null as string | null,
      pagesCount: 0,
      adAccountsCount: 0,
      lastError: null as string | null,
      lastSyncAt: null as string | null,
      tokenPresent: false,
    };
  }
  const metadata = parseMetaAdsMetadata(row.metadata);
  const health = computeMetaHealth(metadata, row.status);
  const token = typeof row.credentials.accessToken === "string" ? row.credentials.accessToken : null;
  return {
    connected: Boolean(token) && row.status !== "DISCONNECTED" && row.status !== "REVOKED",
    health,
    businessName: metadata.businessName ?? null,
    businessId: metadata.businessId ?? null,
    adAccounts: metadata.adAccounts,
    selectedAdAccountId: metadata.selectedAdAccountId ?? null,
    pagesCount: metadata.pages?.length ?? 0,
    adAccountsCount: metadata.adAccounts.length,
    lastError: metadata.lastError ?? null,
    lastSyncAt: metadata.lastSyncAt ?? row.lastSyncedAt?.toISOString() ?? null,
    tokenPresent: Boolean(token),
  };
}
