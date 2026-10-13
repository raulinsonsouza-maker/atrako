/**
 * Pagamento confirmado fecha o card e avisa no WhatsApp.
 * Ganho não acontece porque o cliente disse que pagou.
 */

import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { ensureDefaultPipeline, STAGE_ROLE_WON, updateLeadStage } from "@/lib/modules/crm";
import { isWithinCustomerWindow, sendAndPersistText } from "@/lib/whatsapp/domain";
import { getMercadoPagoPayment } from "@/lib/commerce/mp";
import { sendWhatsAppMessage } from "@/lib/flows/send";
import { loadMessagingPrefs } from "@/lib/flows/prefs";

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export async function closeLeadOnPayment(input: {
  workspaceId: string;
  leadId: string;
  amount: number;
}) {
  const lead = await prisma.nativeLead.findFirst({
    where: { id: input.leadId, clienteId: input.workspaceId },
    include: { contact: true },
  });
  if (!lead || lead.status === "WON") return lead;
  const pipeline = await ensureDefaultPipeline(input.workspaceId);
  const won = pipeline.stages.find((s) => s.role === STAGE_ROLE_WON);
  if (!won) return lead;
  const updated = await updateLeadStage({
    workspaceId: input.workspaceId,
    leadId: lead.id,
    stageId: won.id,
    dealValue: input.amount,
  });
  await confirmPaymentOnWhatsApp({
    workspaceId: input.workspaceId,
    phone: updated.contact?.phoneE164 || updated.contact?.phone || null,
    contactId: updated.contactId,
    name: updated.contact?.name ?? null,
    amount: input.amount,
  }).catch((err) => console.warn("[attendance] confirmação", err instanceof Error ? err.message : err));
  return updated;
}

/** Avisa no WhatsApp quando o checkout que o agente enviou foi pago. Não lança de novo no caixa. */
export async function announceIfAgentCheckout(input: {
  workspaceId: string;
  contactId?: string | null;
  phone?: string | null;
  kind: "checkout" | "agenda";
  ref: string;
  amount: number;
}) {
  const lead = await findCheckoutLead(input);
  if (!lead) return null;
  const contact = lead.contactId
    ? await prisma.nativeContact.findFirst({
        where: { id: lead.contactId },
        select: { name: true, phone: true, phoneE164: true },
      })
    : null;
  await confirmPaymentOnWhatsApp({
    workspaceId: input.workspaceId,
    phone: contact?.phoneE164 || contact?.phone || input.phone || null,
    contactId: lead.contactId,
    name: contact?.name ?? null,
    amount: input.amount,
  });
  return lead;
}

export async function closeLeadMatchingCheckout(input: {
  workspaceId: string;
  contactId?: string | null;
  phone?: string | null;
  kind: "checkout" | "agenda";
  ref: string;
  amount: number;
}) {
  const lead = await findCheckoutLead(input);
  if (!lead || lead.status === "WON") return lead;
  return closeLeadOnPayment({ workspaceId: input.workspaceId, leadId: lead.id, amount: input.amount });
}

async function findCheckoutLead(input: {
  workspaceId: string;
  contactId?: string | null;
  phone?: string | null;
  kind: "checkout" | "agenda";
  ref: string;
}) {
  if (!input.contactId && !input.phone) return null;
  const digits = (input.phone ?? "").replace(/\D/g, "");
  const contact = input.contactId
    ? { id: input.contactId }
    : await prisma.nativeContact.findFirst({
        where: {
          clienteId: input.workspaceId,
          OR: [
            { phone: input.phone ?? undefined },
            ...(digits ? [{ phoneE164: digits }, { phone: { endsWith: digits.slice(-8) } }] : []),
          ],
        },
        select: { id: true },
      });
  if (!contact) return null;
  const leads = await prisma.nativeLead.findMany({
    where: { clienteId: input.workspaceId, contactId: contact.id, status: { in: ["OPEN", "WON"] } },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });
  return (
    leads.find((row) => {
      const checkout = asMeta(asMeta(row.metadata).agentCheckout);
      return checkout.kind === input.kind && checkout.ref === input.ref;
    }) ?? null
  );
}

export async function applyLeadPaymentWebhook(input: {
  leadId: string;
  paymentId: string;
  hintedStatus: string;
}) {
  const lead = await prisma.nativeLead.findUnique({ where: { id: input.leadId }, select: { id: true, clienteId: true, status: true } });
  if (!lead) return { ok: false as const, reason: "lead_missing" };
  let status = input.hintedStatus;
  let amount = 0;
  if (input.paymentId) {
    try {
      const payment = await getMercadoPagoPayment(lead.clienteId, input.paymentId);
      if (payment.externalReference && payment.externalReference !== `lead:${lead.id}`) {
        return { ok: false as const, reason: "reference_mismatch" };
      }
      status = payment.status || status;
      amount = payment.amount;
    } catch {
      return { ok: false as const, reason: "payment_lookup_failed" };
    }
  }
  const paid = ["processed", "approved", "paid"].some((x) => status.toLowerCase().includes(x));
  if (!paid) return { ok: true as const, paid: false };
  const meta = asMeta((await prisma.nativeLead.findUnique({ where: { id: lead.id }, select: { metadata: true } }))?.metadata);
  const checkout = asMeta(meta.agentCheckout);
  const fallback = typeof checkout.amount === "number" ? checkout.amount : 0;
  await closeLeadOnPayment({
    workspaceId: lead.clienteId,
    leadId: lead.id,
    amount: amount > 0 ? amount : fallback,
  });
  return { ok: true as const, paid: true };
}

async function confirmPaymentOnWhatsApp(input: {
  workspaceId: string;
  phone: string | null;
  contactId: string | null;
  name: string | null;
  amount: number;
}) {
  const who = input.name?.trim() || "cliente";
  const value = input.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (!input.phone) {
    await notifyPaid(input.workspaceId, who, value, false);
    return;
  }
  const conversation = await prisma.waConversation.findUnique({
    where: { clienteId_phone: { clienteId: input.workspaceId, phone: input.phone.replace(/\D/g, "") } },
    select: { windowExpiresAt: true },
  });
  if (isWithinCustomerWindow(conversation?.windowExpiresAt)) {
    await sendAndPersistText({
      workspaceId: input.workspaceId,
      to: input.phone,
      body: `Pagamento confirmado, ${who.split(" ")[0]}. Recebemos ${value}.`,
      contactId: input.contactId,
      contactName: input.name,
    });
    return;
  }
  const contact = input.contactId
    ? await prisma.nativeContact.findFirst({ where: { id: input.contactId, clienteId: input.workspaceId } })
    : null;
  if (contact && !contact.waOptOutAt) {
    const { prefs } = await loadMessagingPrefs(input.workspaceId);
    const sent = await sendWhatsAppMessage({
      clienteId: input.workspaceId,
      contact,
      content: { purpose: "sales_followup" },
      data: {},
      origin: {},
      automatic: true,
      reservePercent: prefs.waAutoReservePercent,
    }).catch(() => null);
    if (sent?.status === "SENT") {
      await notifyPaid(input.workspaceId, who, value, true);
      return;
    }
  }
  await notifyPaid(input.workspaceId, who, value, true);
}

async function notifyPaid(workspaceId: string, who: string, value: string, windowClosed: boolean) {
  await notify({
    clienteId: workspaceId,
    role: "ADMIN",
    type: "wa.payment",
    title: `Pagamento confirmado · ${who}`,
    body: windowClosed
      ? `${value}. A janela do WhatsApp fechou, então a confirmação ficou para a equipe.`
      : value,
    href: "/crm",
    severity: "info",
    dedupeKey: `wa-paid:${workspaceId}:${who}:${value}`,
    email: false,
  });
}
