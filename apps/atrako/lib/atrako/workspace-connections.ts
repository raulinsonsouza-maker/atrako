import { prisma } from "@/lib/db";
import { decryptCredentials, encryptCredentials } from "@/lib/atrako/credentials-crypto";

export const CONNECTION_PROVIDERS = [
  "META_ADS",
  "GOOGLE_ADS",
  "LINKEDIN_ADS",
  "INSTAGRAM",
  "MERCADO_PAGO",
  "MERCADO_LIVRE",
  "WHATSAPP",
  "WOOCOMMERCE",
] as const;

export type ConnectionProvider = (typeof CONNECTION_PROVIDERS)[number];

export function isConnectionProvider(value: string): value is ConnectionProvider {
  return (CONNECTION_PROVIDERS as readonly string[]).includes(value);
}

export async function upsertWorkspaceConnection(input: {
  clienteId: string;
  provider: ConnectionProvider;
  label?: string | null;
  credentials: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  status?: string;
}) {
  const credentialsEnc = encryptCredentials(input.credentials);
  return prisma.workspaceConnection.upsert({
    where: {
      clienteId_provider: {
        clienteId: input.clienteId,
        provider: input.provider,
      },
    },
    create: {
      clienteId: input.clienteId,
      provider: input.provider,
      label: input.label ?? null,
      status: input.status ?? "ACTIVE",
      credentialsEnc,
      metadata: input.metadata ?? undefined,
      lastSyncedAt: new Date(),
    },
    update: {
      label: input.label ?? undefined,
      status: input.status ?? "ACTIVE",
      credentialsEnc,
      metadata: input.metadata ?? undefined,
      lastSyncedAt: new Date(),
    },
  });
}

export async function getWorkspaceConnection(
  clienteId: string,
  provider: ConnectionProvider,
) {
  const row = await prisma.workspaceConnection.findUnique({
    where: { clienteId_provider: { clienteId, provider } },
  });
  if (!row) return null;
  return {
    ...row,
    credentials: decryptCredentials(row.credentialsEnc),
  };
}

export async function listWorkspaceConnections(clienteId: string) {
  const rows = await prisma.workspaceConnection.findMany({
    where: { clienteId },
    orderBy: { provider: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    status: row.status,
    label: row.label,
    metadata: row.metadata,
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasCredentials: Object.keys(decryptCredentials(row.credentialsEnc)).length > 0,
  }));
}

export async function disconnectWorkspaceConnection(
  clienteId: string,
  provider: ConnectionProvider,
) {
  return prisma.workspaceConnection.updateMany({
    where: { clienteId, provider },
    data: { status: "DISCONNECTED", credentialsEnc: encryptCredentials({}) },
  });
}
