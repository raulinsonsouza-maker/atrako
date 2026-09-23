/**
 * Side-effects WhatsApp — cola CRM → WPP → Commerce/Agenda.
 * Credenciais sempre via resolveWhatsApp (Config).
 */

import { prisma } from "@/lib/db";
import { resolveWhatsApp } from "@/lib/config/resolveConnection";
import {
  isWithinCustomerWindow,
  normalizeWaPhone,
  sendAndPersistCta,
  sendAndPersistTemplate,
  sendAndPersistText,
  upsertWaConversation,
} from "@/lib/whatsapp/domain";
import { AUTOMATION_TEMPLATES } from "@/lib/atrako/crm-automations";

function phoneFromPayload(payload: Record<string, unknown>, context: Record<string, unknown>) {
  const candidates = [
    payload.phone,
    payload.customerPhone,
    payload.telefone,
    context.phone,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.replace(/\D/g, "").length >= 10) return normalizeWaPhone(c);
  }
  return null;
}

async function resolvePhoneForContact(workspaceId: string, contactId?: string) {
  if (!contactId) return null;
  const contact = await prisma.nativeContact.findFirst({
    where: { id: contactId, clienteId: workspaceId },
  });
  return contact?.phone ? normalizeWaPhone(contact.phone) : null;
}

function publicBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    "http://localhost:5000"
  ).replace(/\/$/, "");
}

/** Envios de automação WhatsApp a partir de eventos Atrako. */
export async function processWhatsAppEventSideEffects(event: {
  name: string;
  source: string;
  idempotencyKey: string;
  context: Record<string, unknown>;
  payload: Record<string, unknown>;
}) {
  const workspaceId = event.context.workspaceId;
  if (typeof workspaceId !== "string" || !workspaceId) return;

  const wa = await resolveWhatsApp(workspaceId);
  if (!wa) return;

  const contactId =
    typeof event.context.contactId === "string" ? event.context.contactId : undefined;

  // --- Boas-vindas / lead / form ---
  if (
    event.name === "lead.created" ||
    event.name === "form.completed" ||
    event.name === "tracking.form_submitted" ||
    (event.name === "conversation.started" &&
      event.payload.kind === "welcome" &&
      event.payload.channel === "whatsapp")
  ) {
    const phone =
      phoneFromPayload(event.payload, event.context) ||
      (await resolvePhoneForContact(workspaceId, contactId));
    if (!phone) return;

    const custom =
      typeof event.payload.message === "string" ? event.payload.message : null;
    const body = custom || AUTOMATION_TEMPLATES.welcome;
    const templateName =
      typeof event.payload.templateName === "string"
        ? event.payload.templateName
        : process.env.WHATSAPP_TEMPLATE_WELCOME?.trim() || null;

    try {
      if (templateName) {
        await sendAndPersistTemplate({
          workspaceId,
          to: phone,
          templateName,
          contactId,
          previewBody: body,
        });
      } else {
        const conv = await upsertWaConversation({ workspaceId, phone, contactId });
        if (isWithinCustomerWindow(conv.windowExpiresAt)) {
          await sendAndPersistText({ workspaceId, to: phone, body, contactId });
        } else {
          console.info(
            "[wa-triggers] welcome skipped (no window / no template)",
            workspaceId,
            phone,
          );
        }
      }
    } catch (e) {
      console.warn("[wa-triggers] welcome failed", e);
    }
    return;
  }

  // --- Abandono de carrinho / checkout ---
  if (event.name === "checkout.abandoned" || event.payload.kind === "abandonment") {
    const phone =
      phoneFromPayload(event.payload, event.context) ||
      (await resolvePhoneForContact(workspaceId, contactId));
    if (!phone) return;

    const productId =
      typeof event.payload.productId === "string" ? event.payload.productId : null;
    const slug = typeof event.payload.slug === "string" ? event.payload.slug : null;
    const orderId = typeof event.payload.orderId === "string" ? event.payload.orderId : null;
    const base = publicBaseUrl();
    const url = productId
      ? `${base}/checkout/${productId}`
      : slug
        ? `${base}/p/${slug}`
        : orderId
          ? `${base}/obrigado?orderId=${orderId}`
          : `${base}/commerce`;

    const body =
      (typeof event.payload.message === "string" && event.payload.message) ||
      AUTOMATION_TEMPLATES.abandonment;
    const templateName =
      typeof event.payload.templateName === "string"
        ? event.payload.templateName
        : process.env.WHATSAPP_TEMPLATE_ABANDONMENT?.trim() || null;

    try {
      if (templateName) {
        await sendAndPersistTemplate({
          workspaceId,
          to: phone,
          templateName,
          contactId,
          buttonUrlSuffix: productId || slug || undefined,
          previewBody: body,
        });
      } else {
        await sendAndPersistCta({
          workspaceId,
          to: phone,
          body,
          buttonText: "Retomar",
          url,
          contactId,
        });
      }
    } catch (e) {
      console.warn("[wa-triggers] abandonment failed", e);
    }
    return;
  }

  // --- Confirmação de agenda ---
  if (event.name === "booking.confirmed" || event.name === "booking.created") {
    const phone =
      phoneFromPayload(event.payload, event.context) ||
      (await resolvePhoneForContact(workspaceId, contactId));
    if (!phone) return;

    const bookingId =
      typeof event.payload.bookingId === "string"
        ? event.payload.bookingId
        : typeof event.context.bookingId === "string"
          ? event.context.bookingId
          : null;
    const base = publicBaseUrl();
    const url = bookingId ? `${base}/b/${bookingId}` : `${base}/agenda`;
    const when =
      typeof event.payload.startAt === "string"
        ? new Date(event.payload.startAt).toLocaleString("pt-BR")
        : "";
    const body = when
      ? `Sua reserva está confirmada para ${when}.`
      : "Sua reserva está confirmada.";

    const templateName =
      typeof event.payload.templateName === "string"
        ? event.payload.templateName
        : process.env.WHATSAPP_TEMPLATE_BOOKING?.trim() || null;

    try {
      if (templateName) {
        await sendAndPersistTemplate({
          workspaceId,
          to: phone,
          templateName,
          bodyParams: when ? [when] : undefined,
          contactId,
          previewBody: body,
        });
      } else {
        await sendAndPersistCta({
          workspaceId,
          to: phone,
          body,
          buttonText: "Ver reserva",
          url,
          contactId,
        });
      }
    } catch (e) {
      console.warn("[wa-triggers] booking failed", e);
    }
    return;
  }

  // --- Datas especiais / birthday ---
  if (event.payload.kind === "birthday") {
    const phone =
      phoneFromPayload(event.payload, event.context) ||
      (await resolvePhoneForContact(workspaceId, contactId));
    if (!phone) return;
    const body =
      (typeof event.payload.message === "string" && event.payload.message) ||
      AUTOMATION_TEMPLATES.birthday;
    const templateName =
      typeof event.payload.templateName === "string"
        ? event.payload.templateName
        : process.env.WHATSAPP_TEMPLATE_BIRTHDAY?.trim() || null;
    try {
      if (templateName) {
        await sendAndPersistTemplate({
          workspaceId,
          to: phone,
          templateName,
          contactId,
          previewBody: body,
        });
      } else {
        const conv = await upsertWaConversation({ workspaceId, phone, contactId });
        if (isWithinCustomerWindow(conv.windowExpiresAt)) {
          await sendAndPersistText({ workspaceId, to: phone, body, contactId });
        }
      }
    } catch (e) {
      console.warn("[wa-triggers] birthday failed", e);
    }
  }
}

/** Cron / job: pedidos PENDING antigos → checkout.abandoned + send. */
export async function emitAbandonedCommerceOrders(opts?: { olderThanMinutes?: number }) {
  const minutes = opts?.olderThanMinutes ?? 60;
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const orders = await prisma.commerceOrder.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      phone: { not: null },
    },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  const { createEvent, publishEventBatch } = await import("@atrako/events");
  const events = [];
  for (const order of orders) {
    if (!order.phone) continue;
    events.push(
      createEvent({
        name: "checkout.abandoned",
        source: "commerce",
        idempotencyKey: `commerce-abandon-${order.id}`,
        context: { workspaceId: order.clienteId },
        payload: {
          orderId: order.id,
          productId: order.productId,
          phone: order.phone,
          email: order.email,
          kind: "abandonment",
        },
      }),
    );
  }
  if (events.length) await publishEventBatch(events);
  return { count: events.length };
}
