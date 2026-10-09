/**
 * Status operacional do pedido no WhatsApp oficial.
 * Template UTILITY, fora do fluxo de marketing (order_paid / recompra).
 * Opt-out de marketing não bloqueia. Opt-out total do WhatsApp bloqueia.
 */

import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { buildSendComponents, resolveTemplateForPurpose } from "@/lib/flows/wa-templates";
import { sendWhatsAppTemplateComponents } from "@/lib/integrations/whatsapp/messages";
import { persistOutboundMessage, upsertWaConversation } from "@/lib/whatsapp/domain";
import { statusTemplatePurpose } from "@/lib/food/quote";
import { getServerPublicOrigin } from "@/lib/http/public-origin";

const PREVIEW: Record<string, string> = {
  food_confirmed: "Seu pedido foi confirmado.",
  food_preparing: "Seu pedido está sendo preparado.",
  food_ready: "Seu pedido está pronto para retirada.",
  food_ready_dispatch: "Seu pedido está pronto para sair.",
  food_out_for_delivery: "Seu pedido saiu para entrega.",
  food_completed: "Seu pedido foi concluído.",
  food_cancelled: "Seu pedido foi cancelado.",
};

export async function sendFoodStatusMessage(order: {
  id: string;
  clienteId: string;
  contactId: string | null;
  customerName: string;
  phoneE164: string | null;
  phone: string;
  number: number;
  publicToken: string;
  fulfillment: string;
  fulfillmentStatus: string;
}) {
  const purpose = statusTemplatePurpose(order.fulfillmentStatus, order.fulfillment === "PICKUP" ? "PICKUP" : "DELIVERY");
  if (!purpose) return { sent: false, reason: "no_template" };
  const phone = order.phoneE164 || order.phone;
  if (!phone) return { sent: false, reason: "no_phone" };

  if (order.contactId) {
    const contact = await prisma.nativeContact.findFirst({
      where: { id: order.contactId, clienteId: order.clienteId },
      select: { waOptOutAt: true, name: true },
    });
    if (contact?.waOptOutAt) return { sent: false, reason: "wa_opt_out" };
  }

  const ref = await resolveTemplateForPurpose(order.clienteId, purpose);
  if (!ref) return { sent: false, reason: "template_not_approved" };

  const store = await prisma.foodStore.findFirst({
    where: { clienteId: order.clienteId },
    select: { name: true, slug: true },
  });
  const first = order.customerName.trim().split(/\s+/)[0] || "oi";
  const origin = getServerPublicOrigin();
  const destination = `${origin}/cardapio/${store?.slug || "lepido"}#pedido/${order.publicToken}`;
  const token = randomBytes(9).toString("base64url");
  const params = {
    first_name: first,
    store_name: store?.name || "restaurante",
    order_ref: `#${order.number}`,
  };
  const { components, missing } = buildSendComponents(ref.components, ref.parameterFormat, {
    params,
    urlSuffix: token,
  });
  if (missing.length) return { sent: false, reason: `missing:${missing.join(",")}` };

  const preview = PREVIEW[purpose] || "Atualização do seu pedido.";
  await prisma.messageDelivery.create({
    data: {
      clienteId: order.clienteId,
      channel: "WHATSAPP",
      contactId: order.contactId,
      toAddress: phone,
      trackingToken: token,
      templateName: ref.name,
      status: "QUEUED",
      pricingCategory: "utility",
      contentSnapshot: { destination, medium: "whatsapp", preview, params, purpose },
    },
  });

  const { wamid } = await sendWhatsAppTemplateComponents({
    workspaceId: order.clienteId,
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
    workspaceId: order.clienteId,
    phone,
    contactId: order.contactId,
    contactName: order.customerName,
  });
  await persistOutboundMessage({
    workspaceId: order.clienteId,
    conversationId: conv.id,
    body: `${preview} Pedido #${order.number}.`,
    wamid,
    type: "template",
    templateName: ref.name,
  });
  return { sent: true };
}
