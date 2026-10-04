/**
 * Backup do webhook: GET /emails do Resend preenche eventos perdidos (padrão Hostax sync.js).
 */

import { prisma } from "@/lib/db";
import { listResendEmails } from "@/lib/integrations/resend/client";
import { resolveResend } from "@/lib/integrations/resend/connection";
import { applyDeliveryEvent, mapResendLastEvent } from "@/lib/flows/delivery-status";

const LOOKBACK_MS = 3 * 86_400_000;

export async function syncResendEmails(workspaceId: string): Promise<{ checked: number; updated: number }> {
  const conn = await resolveResend(workspaceId);
  if (!conn) return { checked: 0, updated: 0 };

  const since = Date.now() - LOOKBACK_MS;
  let after: string | undefined;
  let checked = 0;
  let updated = 0;

  for (let page = 0; page < 10; page++) {
    const r = await listResendEmails(conn.apiKey, { limit: 100, after });
    const rows = r.data ?? [];
    if (!rows.length) break;
    const ids = rows.map((e) => e.id);
    const deliveries = await prisma.messageDelivery.findMany({
      where: { clienteId: workspaceId, providerMessageId: { in: ids } },
      select: { id: true, contactId: true, providerMessageId: true, status: true },
    });
    const byId = new Map(deliveries.map((d) => [d.providerMessageId, d]));
    for (const e of rows) {
      checked++;
      const d = byId.get(e.id);
      const event = mapResendLastEvent(e.last_event);
      if (!d || !event) continue;
      const before = d.status;
      await applyDeliveryEvent({
        deliveryId: d.id,
        clienteId: workspaceId,
        contactId: d.contactId,
        event,
        at: e.created_at ? new Date(e.created_at) : undefined,
        skipEventRow: true,
      });
      const after2 = await prisma.messageDelivery.findUnique({
        where: { id: d.id },
        select: { status: true },
      });
      if (after2 && after2.status !== before) updated++;
    }
    const oldest = rows[rows.length - 1];
    if (!r.has_more || (oldest.created_at && new Date(oldest.created_at).getTime() < since)) break;
    after = oldest.id;
  }
  return { checked, updated };
}

export async function syncAllResendWorkspaces() {
  const conns = await prisma.workspaceConnection.findMany({
    where: { provider: "RESEND", status: "ACTIVE" },
    select: { clienteId: true },
  });
  const results: Record<string, unknown> = {};
  for (const c of conns) {
    try {
      results[c.clienteId] = await syncResendEmails(c.clienteId);
    } catch (err) {
      results[c.clienteId] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return results;
}
