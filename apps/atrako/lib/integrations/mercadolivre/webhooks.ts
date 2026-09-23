/**
 * Notificações Mercado Livre (orders_v2 + shipments).
 * Doc: https://developers.mercadolivre.com.br/pt_br/notificacoes
 */

import { prisma } from "@/lib/db";
import { decryptCredentials } from "@/lib/atrako/credentials-crypto";

export type MlNotification = {
  resource?: string;
  user_id?: number;
  topic?: string;
  application_id?: number;
  attempts?: number;
  sent?: string;
  received?: string;
  _id?: string;
};

/** Extrai order id de resource tipo "/orders/123" ou "/orders_v2/123". */
export function parseMlOrderIdFromResource(resource: string | undefined): string | null {
  if (!resource) return null;
  const match = resource.match(/\/orders(?:_v2)?\/(\d+)/i);
  return match?.[1] ?? null;
}

export function parseMlShipmentIdFromResource(resource: string | undefined): string | null {
  if (!resource) return null;
  const match = resource.match(/\/shipments\/(\d+)/i);
  return match?.[1] ?? null;
}

export async function findWorkspaceByMeliUserId(meliUserId: number | string) {
  const target = String(meliUserId);
  if (!target) return null;

  const rows = await prisma.workspaceConnection.findMany({
    where: { provider: "MERCADO_LIVRE", status: "ACTIVE" },
  });

  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (String(meta.meliUserId ?? "") === target) {
      return { workspaceId: row.clienteId, connectionId: row.id };
    }
    const creds = decryptCredentials(row.credentialsEnc);
    if (String(creds.userId ?? "") === target) {
      return { workspaceId: row.clienteId, connectionId: row.id };
    }
  }
  return null;
}
