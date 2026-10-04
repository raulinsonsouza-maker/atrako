/**
 * Remove contatos "Contato" sem email/telefone criados pelo lead-pipeline a partir de
 * eventos sem dados (ex.: lead.created de commerce antes de reaproveitar context.contactId).
 *
 * Dry-run por padrão. Uso:
 *   npx tsx scripts/cleanup-anonymous-event-leads.ts [--workspace <clienteId>] [--apply]
 */
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma";

const prisma = new PrismaClient();

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const workspaceId = argValue("--workspace");

  const candidates = await prisma.nativeContact.findMany({
    where: {
      ...(workspaceId ? { clienteId: workspaceId } : {}),
      name: "Contato",
      email: null,
      phone: null,
      metadata: { path: ["anonymous"], equals: true },
      waConversations: { none: {} },
      commerceOrders: { none: {} },
      marketplaceOrders: { none: {} },
    },
    select: { id: true, clienteId: true, metadata: true, leads: { select: { id: true } } },
  });

  const contacts = candidates.filter(
    (c) => typeof (c.metadata as Record<string, unknown> | null)?.eventName === "string",
  );
  const leadIds = contacts.flatMap((c) => c.leads.map((l) => l.id));

  const [ledgerRefs, orderRefs] = await Promise.all([
    prisma.workspaceLedgerEntry.findMany({
      where: { leadId: { in: leadIds } },
      select: { leadId: true },
    }),
    prisma.marketplaceOrder.findMany({
      where: { leadId: { in: leadIds } },
      select: { leadId: true },
    }),
  ]);
  const referencedLeads = new Set(
    [...ledgerRefs, ...orderRefs].map((r) => r.leadId).filter(Boolean) as string[],
  );
  const safeContacts = contacts.filter((c) => c.leads.every((l) => !referencedLeads.has(l.id)));
  const safeContactIds = safeContacts.map((c) => c.id);
  const safeLeadIds = safeContacts.flatMap((c) => c.leads.map((l) => l.id));
  const crmLeadIds = safeContactIds.map((id) => `atrako:contact:${id}`);

  const byWorkspace: Record<string, number> = {};
  for (const c of safeContacts) byWorkspace[c.clienteId] = (byWorkspace[c.clienteId] ?? 0) + 1;

  console.log({
    mode: apply ? "apply" : "dry-run",
    contacts: safeContactIds.length,
    leads: safeLeadIds.length,
    skippedReferenced: contacts.length - safeContacts.length,
    byWorkspace,
  });

  if (!apply || safeContactIds.length === 0) return;

  const result = await prisma.$transaction([
    prisma.leadCrm.deleteMany({ where: { crmLeadId: { in: crmLeadIds } } }),
    prisma.nativeLead.deleteMany({ where: { id: { in: safeLeadIds } } }),
    prisma.nativeContact.deleteMany({ where: { id: { in: safeContactIds } } }),
  ]);
  console.log({
    deletedLeadCrm: result[0].count,
    deletedLeads: result[1].count,
    deletedContacts: result[2].count,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
