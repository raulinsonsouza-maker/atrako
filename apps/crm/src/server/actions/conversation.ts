"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { assertTenantAccess } from "@/lib/dashboard-context";
import { sendMessage } from "@/lib/integrations/whatsapp-channel";
import type { WhatsAppChannelConfig } from "@/lib/integrations/whatsapp-channel";

export async function listConversations(tenantId: string) {
  await assertTenantAccess(tenantId);

  return db.conversation.findMany({
    where: { tenantId },
    include: {
      lead: { select: { id: true, name: true, phone: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, direction: true, createdAt: true },
      },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });
}

export async function listMessages(conversationId: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  return db.message.findMany({
    where: { conversation: { id: conversationId, tenantId } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
}

export async function getConversation(conversationId: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  return db.conversation.findFirst({
    where: { id: conversationId, tenantId },
    include: { lead: { select: { id: true, name: true, phone: true } } },
  });
}

export async function getConversationByLeadId(leadId: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  return db.conversation.findFirst({
    where: { tenantId, leadId },
    include: { lead: { select: { id: true, name: true, phone: true } } },
  });
}

export async function sendWhatsAppMessage(tenantId: string, conversationId: string, text: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  await assertTenantAccess(tenantId);

  const conv = await db.conversation.findFirst({
    where: { id: conversationId, tenantId },
    include: { lead: true },
  });
  if (!conv?.lead?.phone) throw new Error("Conversa ou telefone não encontrado.");

  const integration = await db.integration.findFirst({
    where: { tenantId, type: "WHATSAPP", status: "ACTIVE" },
  });
  if (!integration?.config) throw new Error("Integração WhatsApp não configurada.");
  const cfg = integration.config as WhatsAppChannelConfig;
  const hasWhatsApp = cfg.provider === "wweb" || cfg.wwebServiceUrl || cfg.evolutionInstance || cfg.zapiInstanceId;
  if (!hasWhatsApp) {
    throw new Error("Configure WhatsApp em Configurações (QR Code, Z-API ou Evolution API).");
  }

  const { ok, error } = await sendMessage(cfg, conv.lead.phone, text, tenantId);
  if (!ok) throw new Error(error || "Falha ao enviar.");

  await db.message.create({
    data: { conversationId, direction: "OUT", content: text },
  });
  await db.activity.create({
    data: {
      tenantId,
      leadId: conv.leadId,
      userId: (session.user as { id?: string }).id ?? null,
      type: "WHATSAPP",
      content: text.slice(0, 500),
    },
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });
}
