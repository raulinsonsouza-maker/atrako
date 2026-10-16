/**
 * Porta única de envio WhatsApp Cloud API.
 * Valida opt-out, janela 24h, marketing throttle, FEP e persiste MessageDelivery + WaMessage.
 */

import { prisma } from "@/lib/db";
import { newTrackingToken } from "@/lib/flows/tracking";
import { applyWaErrorToContact, WA_ERROR, waRateFor } from "@/lib/flows/wa-limits";
import {
  sendWhatsAppText,
  sendWhatsAppCtaUrl,
  sendWhatsAppReplyButtons,
  sendWhatsAppList,
  sendWhatsAppTemplate,
  sendWhatsAppTemplateComponents,
  WaSendError,
  type ReplyButton,
  type ListRow,
} from "@/lib/integrations/whatsapp/messages";
import {
  isWithinCustomerWindow,
  normalizeWaPhone,
  persistOutboundMessage,
  upsertWaConversation,
} from "@/lib/whatsapp/domain";

export type WaPricingCategory = "service" | "marketing" | "utility" | "authentication";

export class WaGateError extends Error {
  code: string;
  metaCode: number | null;
  constructor(code: string, message: string, metaCode: number | null = null) {
    super(message);
    this.code = code;
    this.metaCode = metaCode;
  }
}

const FEP_MS = 7 * 24 * 60 * 60 * 1000;
const SERVICE_FREE_MONTHLY = 1000;

export function isWithinFep(fepExpiresAt: Date | null | undefined) {
  if (!fepExpiresAt) return false;
  return fepExpiresAt.getTime() > Date.now();
}

/** Abre/renova FEP após 1ª resposta do business a inbound CTWA/page_cta. */
export async function openFepIfEligible(conversationId: string, workspaceId: string) {
  const conv = await prisma.waConversation.findFirst({
    where: { id: conversationId, clienteId: workspaceId },
    select: { fepExpiresAt: true, entrySource: true },
  });
  if (!conv) return null;
  const src = (conv.entrySource || "").toLowerCase();
  if (src !== "ctwa" && src !== "page_cta") return conv.fepExpiresAt;
  if (conv.fepExpiresAt && conv.fepExpiresAt.getTime() > Date.now()) return conv.fepExpiresAt;
  const fepExpiresAt = new Date(Date.now() + FEP_MS);
  await prisma.waConversation.update({
    where: { id: conversationId },
    data: { fepExpiresAt },
  });
  return fepExpiresAt;
}

export async function countServiceDeliveriesThisMonth(workspaceId: string) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return prisma.messageDelivery.count({
    where: {
      clienteId: workspaceId,
      channel: "WHATSAPP",
      pricingCategory: "service",
      isTest: false,
      createdAt: { gte: start },
      status: { notIn: ["FAILED", "BLOCKED", "SKIPPED", "QUEUED"] },
    },
  });
}

async function loadContactGates(workspaceId: string, contactId: string | null | undefined) {
  if (!contactId) return null;
  return prisma.nativeContact.findFirst({
    where: { id: contactId, clienteId: workspaceId },
    select: {
      id: true,
      waOptOutAt: true,
      waMarketingOptOutAt: true,
      waMarketingBlockedUntil: true,
      waUndeliverableAt: true,
    },
  });
}

type GateBase = {
  workspaceId: string;
  to: string;
  contactId?: string | null;
  contactName?: string | null;
  category: WaPricingCategory;
  previewBody: string;
  messageType: string;
  templateName?: string | null;
  isTest?: boolean;
  /** Se true, não exige janela 24h (template). */
  allowOutsideWindow?: boolean;
};

async function prepareGate(input: GateBase) {
  const phone = normalizeWaPhone(input.to);
  if (phone.length < 10) throw new WaGateError("NO_PHONE", "Telefone inválido");

  const contact = await loadContactGates(input.workspaceId, input.contactId);
  if (contact?.waOptOutAt && !input.isTest) {
    throw new WaGateError("WA_OPT_OUT", "Contato pediu para não receber WhatsApp");
  }
  if (input.category === "marketing" && !input.isTest) {
    if (contact?.waMarketingOptOutAt) {
      throw new WaGateError("WA_MARKETING_OPT_OUT", "Contato optou out de marketing");
    }
    if (contact?.waMarketingBlockedUntil && contact.waMarketingBlockedUntil > new Date()) {
      throw new WaGateError("META_USER_LIMIT", "Limite de marketing por usuário (131049)", WA_ERROR.USER_MARKETING_LIMIT);
    }
  }

  const conversation = await upsertWaConversation({
    workspaceId: input.workspaceId,
    phone,
    contactId: input.contactId,
    contactName: input.contactName,
  });

  const inWindow = isWithinCustomerWindow(conversation.windowExpiresAt);
  if (!input.allowOutsideWindow && !inWindow) {
    throw new WaGateError("OUTSIDE_WINDOW", "Fora da janela de 24h — use template", WA_ERROR.OUTSIDE_WINDOW);
  }

  const fepActive = isWithinFep(conversation.fepExpiresAt);
  const serviceCount =
    input.category === "service" && !input.isTest
      ? await countServiceDeliveriesThisMonth(input.workspaceId)
      : 0;
  const billableHint = fepActive
    ? false
    : input.category === "service"
      ? serviceCount >= SERVICE_FREE_MONTHLY
      : true;

  const token = newTrackingToken();
  const delivery = await prisma.messageDelivery.create({
    data: {
      clienteId: input.workspaceId,
      channel: "WHATSAPP",
      contactId: input.contactId ?? null,
      toAddress: phone,
      trackingToken: token,
      templateName: input.templateName ?? null,
      status: "QUEUED",
      isTest: Boolean(input.isTest),
      pricingCategory: input.category,
      billable: billableHint,
      contentSnapshot: {
        preview: input.previewBody.slice(0, 500),
        fepActive,
        serviceCount,
        medium: "whatsapp",
      } as object,
    },
  });

  return { phone, conversation, delivery, fepActive, contactId: contact?.id ?? input.contactId ?? null };
}

async function finalizeOk(input: {
  workspaceId: string;
  conversationId: string;
  deliveryId: string;
  contactId: string | null;
  wamid: string | null;
  body: string;
  type: string;
  templateName?: string | null;
  category: WaPricingCategory;
  fepActive: boolean;
}) {
  if (!input.fepActive) {
    await openFepIfEligible(input.conversationId, input.workspaceId);
  }
  await prisma.messageDelivery.update({
    where: { id: input.deliveryId },
    data: { providerMessageId: input.wamid, status: "SENT", sentAt: new Date() },
  });
  await persistOutboundMessage({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    body: input.body,
    wamid: input.wamid,
    type: input.type,
    templateName: input.templateName,
  });
  await prisma.waConversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: new Date(), contactId: input.contactId || undefined },
  });
  if (input.category === "service" && !input.fepActive) {
    const used = await countServiceDeliveriesThisMonth(input.workspaceId);
    if (used === SERVICE_FREE_MONTHLY || used === SERVICE_FREE_MONTHLY + 1) {
      const { notify } = await import("@/lib/notifications");
      await notify({
        clienteId: input.workspaceId,
        role: "ADMIN",
        type: "wa.service_tier",
        title: "WhatsApp: tier de 1.000 mensagens de serviço",
        body: `Este mês já há ${used} mensagens de serviço. Após 1.000 a Meta cobra por mensagem.`,
        href: "/relacionamento",
        severity: "aviso",
        dedupeKey: `wa-service-tier:${input.workspaceId}:${new Date().toISOString().slice(0, 7)}:${used >= SERVICE_FREE_MONTHLY ? "over" : "at"}`,
        email: false,
      }).catch(() => null);
    }
  }
  return { conversationId: input.conversationId, wamid: input.wamid, deliveryId: input.deliveryId };
}

async function finalizeFail(input: {
  deliveryId: string;
  contactId: string | null;
  err: unknown;
}) {
  const code = input.err instanceof WaSendError ? input.err.code : input.err instanceof WaGateError ? input.err.metaCode : null;
  const msg = input.err instanceof Error ? input.err.message : String(input.err);
  const effect = await applyWaErrorToContact(input.contactId, code);
  await prisma.messageDelivery.update({
    where: { id: input.deliveryId },
    data: {
      status: effect.blocked ? "BLOCKED" : "FAILED",
      failedAt: new Date(),
      error: msg.slice(0, 500),
      errorCode: code,
    },
  });
  if (input.err instanceof WaGateError) throw input.err;
  throw new WaGateError(effect.blocked ? "BLOCKED" : "SEND_FAILED", msg, code);
}

export async function gateSendText(input: {
  workspaceId: string;
  to: string;
  body: string;
  contactId?: string | null;
  contactName?: string | null;
  isTest?: boolean;
}) {
  const prepared = await prepareGate({
    workspaceId: input.workspaceId,
    to: input.to,
    contactId: input.contactId,
    contactName: input.contactName,
    category: "service",
    previewBody: input.body,
    messageType: "text",
    isTest: input.isTest,
  });
  try {
    const { wamid } = await sendWhatsAppText({
      workspaceId: input.workspaceId,
      to: prepared.phone,
      body: input.body,
    });
    return finalizeOk({
      workspaceId: input.workspaceId,
      conversationId: prepared.conversation.id,
      deliveryId: prepared.delivery.id,
      contactId: prepared.contactId,
      wamid,
      body: input.body,
      type: "text",
      category: "service",
      fepActive: prepared.fepActive,
    });
  } catch (err) {
    await finalizeFail({ deliveryId: prepared.delivery.id, contactId: prepared.contactId, err });
    throw err;
  }
}

export async function gateSendCta(input: {
  workspaceId: string;
  to: string;
  body: string;
  buttonText: string;
  url: string;
  contactId?: string | null;
  contactName?: string | null;
  isTest?: boolean;
}) {
  const prepared = await prepareGate({
    workspaceId: input.workspaceId,
    to: input.to,
    contactId: input.contactId,
    contactName: input.contactName,
    category: "service",
    previewBody: `${input.body}\n${input.url}`,
    messageType: "interactive",
    isTest: input.isTest,
  });
  try {
    const { wamid } = await sendWhatsAppCtaUrl({
      workspaceId: input.workspaceId,
      to: prepared.phone,
      body: input.body,
      buttonText: input.buttonText,
      url: input.url,
    });
    return finalizeOk({
      workspaceId: input.workspaceId,
      conversationId: prepared.conversation.id,
      deliveryId: prepared.delivery.id,
      contactId: prepared.contactId,
      wamid,
      body: `${input.body}\n${input.url}`,
      type: "interactive",
      category: "service",
      fepActive: prepared.fepActive,
    });
  } catch (err) {
    await finalizeFail({ deliveryId: prepared.delivery.id, contactId: prepared.contactId, err });
    throw err;
  }
}

export async function gateSendReplyButtons(input: {
  workspaceId: string;
  to: string;
  body: string;
  buttons: ReplyButton[];
  contactId?: string | null;
  contactName?: string | null;
  isTest?: boolean;
}) {
  const prepared = await prepareGate({
    workspaceId: input.workspaceId,
    to: input.to,
    contactId: input.contactId,
    contactName: input.contactName,
    category: "service",
    previewBody: `${input.body} [${input.buttons.map((b) => b.title).join(" | ")}]`,
    messageType: "interactive",
    isTest: input.isTest,
  });
  try {
    const { wamid } = await sendWhatsAppReplyButtons({
      workspaceId: input.workspaceId,
      to: prepared.phone,
      body: input.body,
      buttons: input.buttons,
    });
    return finalizeOk({
      workspaceId: input.workspaceId,
      conversationId: prepared.conversation.id,
      deliveryId: prepared.delivery.id,
      contactId: prepared.contactId,
      wamid,
      body: `${input.body} [${input.buttons.map((b) => b.title).join(" | ")}]`,
      type: "interactive",
      category: "service",
      fepActive: prepared.fepActive,
    });
  } catch (err) {
    await finalizeFail({ deliveryId: prepared.delivery.id, contactId: prepared.contactId, err });
    throw err;
  }
}

export async function gateSendList(input: {
  workspaceId: string;
  to: string;
  body: string;
  buttonText: string;
  sectionTitle?: string;
  rows: ListRow[];
  contactId?: string | null;
  contactName?: string | null;
  isTest?: boolean;
}) {
  const prepared = await prepareGate({
    workspaceId: input.workspaceId,
    to: input.to,
    contactId: input.contactId,
    contactName: input.contactName,
    category: "service",
    previewBody: `${input.body} [${input.rows.map((r) => r.title).join(" | ")}]`,
    messageType: "interactive",
    isTest: input.isTest,
  });
  try {
    const { wamid } = await sendWhatsAppList({
      workspaceId: input.workspaceId,
      to: prepared.phone,
      body: input.body,
      buttonText: input.buttonText,
      sectionTitle: input.sectionTitle,
      rows: input.rows,
    });
    return finalizeOk({
      workspaceId: input.workspaceId,
      conversationId: prepared.conversation.id,
      deliveryId: prepared.delivery.id,
      contactId: prepared.contactId,
      wamid,
      body: `${input.body} [${input.rows.map((r) => r.title).join(" | ")}]`,
      type: "interactive",
      category: "service",
      fepActive: prepared.fepActive,
    });
  } catch (err) {
    await finalizeFail({ deliveryId: prepared.delivery.id, contactId: prepared.contactId, err });
    throw err;
  }
}

export async function gateSendTemplate(input: {
  workspaceId: string;
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
  buttonUrlSuffix?: string;
  contactId?: string | null;
  contactName?: string | null;
  previewBody?: string;
  category?: WaPricingCategory;
  components?: Array<Record<string, unknown>>;
  marketingApi?: boolean;
  isTest?: boolean;
}) {
  const category = input.category ?? "marketing";
  const prepared = await prepareGate({
    workspaceId: input.workspaceId,
    to: input.to,
    contactId: input.contactId,
    contactName: input.contactName,
    category,
    previewBody: input.previewBody || `[template:${input.templateName}]`,
    messageType: "template",
    templateName: input.templateName,
    allowOutsideWindow: true,
    isTest: input.isTest,
  });
  try {
    const result = input.components
      ? await sendWhatsAppTemplateComponents({
          workspaceId: input.workspaceId,
          to: prepared.phone,
          templateName: input.templateName,
          languageCode: input.languageCode,
          components: input.components,
          marketingApi: input.marketingApi,
        })
      : await sendWhatsAppTemplate({
          workspaceId: input.workspaceId,
          to: prepared.phone,
          templateName: input.templateName,
          languageCode: input.languageCode,
          bodyParams: input.bodyParams,
          buttonUrlSuffix: input.buttonUrlSuffix,
        });
    return finalizeOk({
      workspaceId: input.workspaceId,
      conversationId: prepared.conversation.id,
      deliveryId: prepared.delivery.id,
      contactId: prepared.contactId,
      wamid: result.wamid,
      body: input.previewBody || `[template:${input.templateName}]`,
      type: "template",
      templateName: input.templateName,
      category,
      fepActive: prepared.fepActive,
    });
  } catch (err) {
    await finalizeFail({ deliveryId: prepared.delivery.id, contactId: prepared.contactId, err });
    throw err;
  }
}

/** Estima custo em micros após webhook (service usa tabela utility). */
export async function resolveServiceRateMicros() {
  const row = await waRateFor("utility");
  return row?.priceMicros ?? 35_000;
}
