/**
 * Base de leads para automação e disparo: quem já está no CRM ganha contato
 * e, ao ligar o fluxo lead_base, entra na sequência se tiver e-mail.
 */

import { prisma } from "@/lib/db";
import { upsertPersonContact } from "@/lib/atrako/person";
import { enrollContact } from "@/lib/flows/engine";

function text(meta: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function metaOf(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** Liga um contato aos leads que já têm nome, e-mail ou telefone gravados. */
export async function ensureLeadContacts(workspaceId: string) {
  let linked = 0;
  let cursor: string | undefined;
  do {
    const orphans = await prisma.nativeLead.findMany({
      where: { clienteId: workspaceId, contactId: null },
      select: { id: true, source: true, metadata: true },
      orderBy: { id: "asc" },
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    for (const lead of orphans) {
      const meta = metaOf(lead.metadata);
      const name = text(meta, ["name", "nome", "fullName", "full_name"]);
      const email = text(meta, ["email", "e-mail", "mail"]);
      const phone = text(meta, ["phone", "telefone", "whatsapp", "celular", "phoneE164"]);
      if (!name && !email && !phone) continue;
      const contact = await upsertPersonContact({
        workspaceId,
        name,
        email,
        phone,
        source: lead.source,
        metadata: { fromLead: lead.id },
      });
      await prisma.nativeLead.update({ where: { id: lead.id }, data: { contactId: contact.id } });
      linked += 1;
    }
    cursor = orphans.length === 200 ? orphans[orphans.length - 1]?.id : undefined;
  } while (cursor);
  return { linked };
}

/** Matricula a base atual no fluxo que acabou de ser ligado. */
export async function enrollLeadBase(workspaceId: string, flowId: string) {
  await ensureLeadContacts(workspaceId);
  let enrolled = 0;
  let cursor: string | undefined;
  do {
    const contacts = await prisma.nativeContact.findMany({
      where: {
        clienteId: workspaceId,
        email: { not: null },
        NOT: { email: "" },
        emailOptOutAt: null,
        emailBouncedAt: null,
        emailComplainedAt: null,
        leads: { some: { clienteId: workspaceId } },
      },
      select: {
        id: true,
        email: true,
        leads: {
          where: { clienteId: workspaceId },
          take: 1,
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        },
      },
      orderBy: { id: "asc" },
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    for (const contact of contacts) {
      if (!contact.email?.trim()) continue;
      const leadId = contact.leads[0]?.id ?? null;
      const result = await enrollContact({
        clienteId: workspaceId,
        trigger: "lead_base",
        contactId: contact.id,
        leadId,
        refType: "lead",
        refId: leadId,
        dedupeKey: "lead_base",
        flowIds: [flowId],
      });
      enrolled += result.enrolled;
    }
    cursor = contacts.length === 200 ? contacts[contacts.length - 1]?.id : undefined;
  } while (cursor);
  return { enrolled };
}
