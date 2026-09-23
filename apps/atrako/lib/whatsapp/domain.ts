/**
 * Domínio WhatsApp — conversas, mensagens, handoff e envio com persistência.
 */

import { prisma } from "@/lib/db";
import {
  sendWhatsAppText,
  sendWhatsAppCtaUrl,
  sendWhatsAppTemplate,
} from "@/lib/integrations/whatsapp/messages";

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
}) {
  const phone = normalizeWaPhone(input.phone);
  const windowExpiresAt = input.openWindow ? new Date(Date.now() + WINDOW_MS) : undefined;

  return prisma.waConversation.upsert({
    where: { clienteId_phone: { clienteId: input.workspaceId, phone } },
    create: {
      clienteId: input.workspaceId,
      phone,
      contactName: input.contactName ?? null,
      contactId: input.contactId ?? null,
      status: "OPEN",
      windowExpiresAt: windowExpiresAt ?? null,
      lastMessageAt: new Date(),
    },
    update: {
      contactName: input.contactName ?? undefined,
      contactId: input.contactId ?? undefined,
      lastMessageAt: new Date(),
      ...(windowExpiresAt ? { windowExpiresAt, status: "OPEN" } : {}),
    },
  });
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
    if (existing) return existing;
  }
  return prisma.waMessage.create({
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
  const conversation = await upsertWaConversation({
    workspaceId: input.workspaceId,
    phone: input.to,
    contactId,
    contactName,
  });
  const { wamid } = await sendWhatsAppText({
    workspaceId: input.workspaceId,
    to: input.to,
    body: input.body,
  });
  await persistOutboundMessage({
    workspaceId: input.workspaceId,
    conversationId: conversation.id,
    body: input.body,
    wamid,
    type: "text",
  });
  await prisma.waConversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), contactId: contactId || undefined },
  });
  return { conversationId: conversation.id, wamid, contactId };
}

export async function sendAndPersistCta(input: {
  workspaceId: string;
  to: string;
  body: string;
  buttonText: string;
  url: string;
  contactId?: string | null;
}) {
  const conversation = await upsertWaConversation({
    workspaceId: input.workspaceId,
    phone: input.to,
    contactId: input.contactId,
  });
  const { wamid } = await sendWhatsAppCtaUrl(input);
  await persistOutboundMessage({
    workspaceId: input.workspaceId,
    conversationId: conversation.id,
    body: `${input.body}\n${input.url}`,
    wamid,
    type: "interactive",
  });
  return { conversationId: conversation.id, wamid };
}

export async function sendAndPersistTemplate(input: {
  workspaceId: string;
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
  buttonUrlSuffix?: string;
  contactId?: string | null;
  previewBody?: string;
}) {
  const conversation = await upsertWaConversation({
    workspaceId: input.workspaceId,
    phone: input.to,
    contactId: input.contactId,
  });
  const { wamid, templateName } = await sendWhatsAppTemplate(input);
  await persistOutboundMessage({
    workspaceId: input.workspaceId,
    conversationId: conversation.id,
    body: input.previewBody || `[template:${templateName}]`,
    wamid,
    type: "template",
    templateName,
  });
  return { conversationId: conversation.id, wamid };
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
