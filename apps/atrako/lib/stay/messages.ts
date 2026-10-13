/**
 * Confirmação e lembrete de check-in: WhatsApp (template UTILITY) e e-mail.
 */

import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { buildSendComponents, resolveTemplateForPurpose } from "@/lib/flows/wa-templates";
import { sendEmailMessage } from "@/lib/flows/send";
import { sendWhatsAppTemplateComponents } from "@/lib/integrations/whatsapp/messages";
import { persistOutboundMessage, upsertWaConversation } from "@/lib/whatsapp/domain";
import { getServerPublicOrigin } from "@/lib/http/public-origin";
import { addDays, formatBrDate, todayInTimeZone } from "@/lib/stay/nights";

type StayNotice = {
  id: string;
  clienteId: string;
  contactId: string | null;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string;
  phoneE164: string | null;
  number: number;
  publicToken: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  amountCents: number;
  property: { name: string; slug: string; timezone: string; checkInTime: string };
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "oi";
}

function reservationUrl(slug: string, token: string) {
  return `${getServerPublicOrigin()}/estadia/${slug}?reserva=${token}`;
}

async function sendStayTemplate(row: StayNotice, purpose: string, preview: string) {
  const phone = row.phoneE164 || row.guestPhone;
  if (!phone) return { sent: false, reason: "no_phone" };
  if (row.contactId) {
    const contact = await prisma.nativeContact.findFirst({
      where: { id: row.contactId, clienteId: row.clienteId },
      select: { waOptOutAt: true },
    });
    if (contact?.waOptOutAt) return { sent: false, reason: "wa_opt_out" };
  }
  const ref = await resolveTemplateForPurpose(row.clienteId, purpose);
  if (!ref) return { sent: false, reason: "template_not_approved" };
  const token = randomBytes(9).toString("base64url");
  const params = {
    first_name: firstName(row.guestName),
    store_name: row.property.name,
    order_ref: `#${row.number}`,
    order_total: (row.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  };
  const destination = reservationUrl(row.property.slug, row.publicToken);
  const { components, missing } = buildSendComponents(ref.components, ref.parameterFormat, {
    params,
    urlSuffix: token,
  });
  if (missing.length) return { sent: false, reason: `missing:${missing.join(",")}` };
  await prisma.messageDelivery.create({
    data: {
      clienteId: row.clienteId,
      channel: "WHATSAPP",
      contactId: row.contactId,
      toAddress: phone,
      trackingToken: token,
      templateName: ref.name,
      status: "QUEUED",
      pricingCategory: "utility",
      contentSnapshot: { destination, medium: "whatsapp", preview, params, purpose },
    },
  });
  const { wamid } = await sendWhatsAppTemplateComponents({
    workspaceId: row.clienteId,
    to: phone,
    templateName: ref.name,
    languageCode: ref.language,
    components,
    marketingApi: false,
  });
  await prisma.messageDelivery.updateMany({
    where: { trackingToken: token },
    data: { providerMessageId: wamid, status: "SENT", sentAt: new Date() },
  });
  const conv = await upsertWaConversation({
    workspaceId: row.clienteId,
    phone,
    contactId: row.contactId,
    contactName: row.guestName,
  });
  await persistOutboundMessage({
    workspaceId: row.clienteId,
    conversationId: conv.id,
    body: `${preview} Reserva #${row.number}.`,
    wamid,
    type: "template",
    templateName: ref.name,
  });
  return { sent: true };
}

async function sendStayEmail(row: StayNotice, kind: "confirmed" | "checkin") {
  if (!row.guestEmail || !row.contactId) return;
  const contact = await prisma.nativeContact.findFirst({
    where: { id: row.contactId, clienteId: row.clienteId },
    select: { id: true, name: true, email: true, phone: true, phoneE164: true },
  });
  if (!contact?.email) return;
  const url = reservationUrl(row.property.slug, row.publicToken);
  const when = `${formatBrDate(row.checkIn)} a ${formatBrDate(row.checkOut)}`;
  const confirmed = kind === "confirmed";
  await sendEmailMessage({
    clienteId: row.clienteId,
    contact,
    content: {
      subject: confirmed
        ? `Reserva confirmada no ${row.property.name}`
        : `Amanhã é o check-in no ${row.property.name}`,
      preheader: when,
      blocks: [
        { type: "heading", text: confirmed ? "Sua reserva está confirmada" : "Seu check-in é amanhã" },
        {
          type: "text",
          text: confirmed
            ? `Olá, ${firstName(row.guestName)}. ${row.property.name} está reservado de ${when}, ${row.nights} noites. Check-in às ${row.property.checkInTime}.`
            : `Olá, ${firstName(row.guestName)}. Amanhã você entra no ${row.property.name}. Check-in às ${row.property.checkInTime}, estadia de ${when}.`,
        },
        { type: "button", label: confirmed ? "Ver reserva" : "Ver detalhes", url },
        { type: "signature" },
      ],
    },
    data: {
      destination: url,
      totalCents: row.amountCents,
      orderRef: `#${row.number}`,
    },
    origin: { flowKey: confirmed ? "stay_confirmed" : "stay_checkin" },
    idempotencyKey: `stay-${kind}-email-${row.id}`,
  }).catch((err) => console.error("[stay-email]", err));
}

const noticeInclude = { property: { select: { name: true, slug: true, timezone: true, checkInTime: true } } } as const;

const STAY_WA_PURPOSES = ["stay_unpaid", "stay_confirmed", "stay_checkin", "stay_checkout", "stay_thanks"];

export async function enrollStayFlow(input: {
  reservationId: string;
  trigger: "stay_unpaid" | "stay_confirmed" | "stay_checkin" | "stay_checkout" | "stay_thanks";
  dedupeKey: string;
}) {
  const row = await prisma.stayReservation.findUnique({ where: { id: input.reservationId }, include: noticeInclude });
  if (!row?.contactId) return 0;
  const { ensureDefaultFlows, STAY_PLAYBOOKS } = await import("@/lib/flows/playbooks");
  const { enrollContact } = await import("@/lib/flows/engine");
  const { ensureDefaultWaTemplates } = await import("@/lib/flows/wa-templates");
  await ensureDefaultFlows(row.clienteId, { playbooks: STAY_PLAYBOOKS });
  const ready = await prisma.waTemplateRef.count({
    where: { clienteId: row.clienteId, purpose: { in: STAY_WA_PURPOSES }, status: { notIn: ["DELETED", "PENDING_DELETION"] } },
  });
  if (ready < STAY_WA_PURPOSES.length) {
    await ensureDefaultWaTemplates(row.clienteId, undefined, STAY_WA_PURPOSES).catch(() => null);
  }
  const result = await enrollContact({
    clienteId: row.clienteId,
    trigger: input.trigger,
    contactId: row.contactId,
    leadId: row.leadId,
    refType: "order",
    refId: row.id,
    dedupeKey: input.dedupeKey,
    context: {
      totalCents: row.amountCents,
      orderRef: String(row.number),
      storeName: row.property.name,
      destination: reservationUrl(row.property.slug, row.publicToken),
      provider: "STAY",
      items: [{ title: `${row.nights} noites`, quantity: 1, unitPriceCents: row.amountCents }],
    },
  });
  return result.enrolled;
}

export async function sendStayConfirmed(reservationIdOrRow: string | { id: string }) {
  const id = typeof reservationIdOrRow === "string" ? reservationIdOrRow : reservationIdOrRow.id;
  const row = await prisma.stayReservation.findUnique({ where: { id }, include: noticeInclude });
  if (!row || row.status !== "CONFIRMED") return;
  const notice = row as StayNotice;
  await sendStayTemplate(notice, "stay_confirmed", "Sua reserva foi confirmada.");
  await sendStayEmail(notice, "confirmed");
}

export async function remindStayCheckins(now = new Date()) {
  const rows = await prisma.stayReservation.findMany({
    where: { status: "CONFIRMED" },
    select: { id: true, checkIn: true, checkOut: true, property: { select: { timezone: true } } },
    take: 200,
  });
  let enrolled = 0;
  for (const row of rows) {
    const today = todayInTimeZone(row.property.timezone, now);
    const tomorrow = addDays(today, 1);
    const yesterday = addDays(today, -1);
    if (row.checkIn === tomorrow) {
      enrolled += await enrollStayFlow({ reservationId: row.id, trigger: "stay_checkin", dedupeKey: `stay-checkin:${row.id}` });
    }
    if (row.checkOut === today) {
      enrolled += await enrollStayFlow({ reservationId: row.id, trigger: "stay_checkout", dedupeKey: `stay-checkout:${row.id}` });
    }
    if (row.checkOut === yesterday) {
      enrolled += await enrollStayFlow({ reservationId: row.id, trigger: "stay_thanks", dedupeKey: `stay-thanks:${row.id}` });
    }
  }
  return enrolled;
}
