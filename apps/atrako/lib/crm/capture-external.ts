/**
 * Ponte única: lead de anúncio, planilha ou RD vira card no funil nativo.
 * Reabre o card da mesma pessoa. Boas-vindas só no card novo, quando pedido.
 */

import { upsertPersonAndLead } from "@/lib/atrako/person";

export async function captureExternalLead(input: {
  workspaceId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source: string;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  /** Matricula a régua de boas-vindas só quando o card acaba de nascer. */
  welcome?: boolean;
  /** Avisa a equipe por e-mail (notifyPrefs.leadEmails) quando o card nasce. Importações em lote não avisam. */
  notifyTeam?: boolean;
}): Promise<{ leadId: string; contactId: string | null; created: boolean } | null> {
  const name = input.name?.trim() || "";
  const email = input.email?.trim() || "";
  const phone = input.phone?.trim() || "";
  if (!name && !email && !phone) return null;

  const { lead } = await upsertPersonAndLead({
    workspaceId: input.workspaceId,
    name: name || email || phone,
    email: email || undefined,
    phone: phone || undefined,
    source: input.source,
    metadata: input.metadata ?? null,
  });

  const created = Date.now() - lead.createdAt.getTime() < 15_000;
  if (created && input.welcome !== false && lead.contactId) {
    const { onLeadCaptured } = await import("@/lib/flows/capture");
    await onLeadCaptured({
      workspaceId: input.workspaceId,
      contactId: lead.contactId,
      leadId: lead.id,
      payload: input.payload ?? {},
      source: input.source,
    }).catch((err) => console.warn("[capture-external] welcome", err instanceof Error ? err.message : err));
  }
  if (created && input.notifyTeam) {
    const { sendLeadTeamEmail } = await import("@/lib/notifications/lead-team-email");
    await sendLeadTeamEmail(input.workspaceId, lead.id).catch((err) =>
      console.warn("[capture-external] team email", err instanceof Error ? err.message : err),
    );
  }

  return { leadId: lead.id, contactId: lead.contactId, created };
}
