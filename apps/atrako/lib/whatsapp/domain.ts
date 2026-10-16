/**
 * Domínio WhatsApp — conversas, mensagens, handoff e envio com persistência.
 * Envios passam pelo send-gate (janela 24h, opt-out, MessageDelivery).
 */

import { prisma } from "@/lib/db";
import type { ReplyButton, ListRow } from "@/lib/integrations/whatsapp/messages";

export function normalizeWaPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function upsertWaConversation(input: {
  workspaceId: string;
  phone: string;
  contactName?: string | null;
  contactId?: string | null;
  openWindow?: boolean;
  entrySource?: string | null;
}) {
  const phone = normalizeWaPhone(input.phone);
  const windowExpiresAt = input.openWindow ? new Date(Date.now() + WINDOW_MS) : undefined;

  const conversation = await prisma.waConversation.upsert({
    where: { clienteId_phone: { clienteId: input.workspaceId, phone } },
    create: {
      clienteId: input.workspaceId,
      phone,
      contactName: input.contactName ?? null,
      contactId: input.contactId ?? null,
      status: "OPEN",
      windowExpiresAt: windowExpiresAt ?? null,
      entrySource: input.entrySource ?? null,
      lastMessageAt: new Date(),
    },
    update: {
      contactName: input.contactName ?? undefined,
      contactId: input.contactId ?? undefined,
      lastMessageAt: new Date(),
      ...(windowExpiresAt ? { windowExpiresAt } : {}),
      ...(input.entrySource ? { entrySource: input.entrySource } : {}),
    },
  });
  if (windowExpiresAt && conversation.status !== "HANDED_OFF") {
    return prisma.waConversation.update({
      where: { id: conversation.id },
      data: { status: "OPEN", windowExpiresAt },
    });
  }
  return conversation;
}

export async function persistOutboundMessage(input: {
  workspaceId: string;
  conversationId: string;
  body: string;
  wamid?: string | null;
  type?: string;
  templateName?: string | null;
  status?: string;
}) {
  return prisma.waMessage.create({
    data: {
      clienteId: input.workspaceId,
      conversationId: input.conversationId,
      direction: "OUTBOUND",
      type: input.type || "text",
      body: input.body,
      wamid: input.wamid || null,
      status: input.status || "sent",
      templateName: input.templateName ?? null,
    },
  });
}

export async function persistInboundMessage(input: {
  workspaceId: string;
  conversationId: string;
  body: string | null;
  wamid?: string | null;
  type?: string;
}) {
  if (input.wamid) {
    const existing = await prisma.waMessage.findUnique({
      where: { clienteId_wamid: { clienteId: input.workspaceId, wamid: input.wamid } },
    });
    if (existing) return { ...existing, duplicate: true as const };
  }
  const created = await prisma.waMessage.create({
    data: {
      clienteId: input.workspaceId,
      conversationId: input.conversationId,
      direction: "INBOUND",
      type: input.type || "text",
      body: input.body,
      wamid: input.wamid || null,
      status: "received",
    },
  });
  return { ...created, duplicate: false as const };
}

export async function sendAndPersistText(input: {
  workspaceId: string;
  to: string;
  body: string;
  contactId?: string | null;
  contactName?: string | null;
}) {
  let contactId = input.contactId;
  let contactName = input.contactName;
  if (!contactId) {
    const { upsertPersonAndLead } = await import("@/lib/atrako/person");
    const { contact } = await upsertPersonAndLead({
      workspaceId: input.workspaceId,
      phone: input.to,
      name: input.contactName,
      source: "whatsapp",
    });
    contactId = contact.id;
    contactName = contact.name;
  }
  const { gateSendText } = await import("@/lib/whatsapp/send-gate");
  const result = await gateSendText({
    workspaceId: input.workspaceId,
    to: input.to,
    body: input.body,
    contactId,
    contactName,
  });
  return { conversationId: result.conversationId, wamid: result.wamid, contactId };
}

export async function sendAndPersistCta(input: {
  workspaceId: string;
  to: string;
  body: string;
  buttonText: string;
  url: string;
  contactId?: string | null;
  contactName?: string | null;
}) {
  const { gateSendCta } = await import("@/lib/whatsapp/send-gate");
  return gateSendCta(input);
}

export async function sendAndPersistTemplate(input: {
  workspaceId: string;
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
  buttonUrlSuffix?: string;
  contactId?: string | null;
  contactName?: string | null;
  previewBody?: string;
  category?: "marketing" | "utility" | "authentication";
}) {
  const { gateSendTemplate } = await import("@/lib/whatsapp/send-gate");
  return gateSendTemplate(input);
}

export async function sendAndPersistReplyButtons(input: {
  workspaceId: string;
  to: string;
  body: string;
  buttons: ReplyButton[];
  contactId?: string | null;
  contactName?: string | null;
}) {
  const { gateSendReplyButtons } = await import("@/lib/whatsapp/send-gate");
  return gateSendReplyButtons(input);
}

export async function sendAndPersistList(input: {
  workspaceId: string;
  to: string;
  body: string;
  buttonText: string;
  sectionTitle?: string;
  rows: ListRow[];
  contactId?: string | null;
  contactName?: string | null;
}) {
  const { gateSendList } = await import("@/lib/whatsapp/send-gate");
  return gateSendList(input);
}

export async function resumeAgentConversation(conversationId: string, workspaceId: string) {
  return prisma.waConversation.updateMany({
    where: { id: conversationId, clienteId: workspaceId, status: "HANDED_OFF" },
    data: { status: "OPEN", handedOffAt: null },
  });
}

export async function handoffConversation(conversationId: string, workspaceId: string) {
  return prisma.waConversation.updateMany({
    where: { id: conversationId, clienteId: workspaceId },
    data: { status: "HANDED_OFF", handedOffAt: new Date() },
  });
}

export function isWithinCustomerWindow(windowExpiresAt: Date | null | undefined) {
  if (!windowExpiresAt) return false;
  return windowExpiresAt.getTime() > Date.now();
}
