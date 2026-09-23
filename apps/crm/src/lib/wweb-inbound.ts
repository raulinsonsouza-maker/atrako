/**
 * Lógica compartilhada para mensagens recebidas do WhatsApp Web.
 * Usada pelo webhook (serviço externo) e pelo wweb-manager (integrado).
 */

import { db } from "@/lib/db";

async function getFirstStageId(tenantId: string): Promise<string | null> {
  const p = await db.pipeline.findFirst({
    where: { tenantId, isDefault: true },
    include: { stages: { orderBy: { order: "asc" }, take: 1 } },
  });
  return p?.stages[0]?.id ?? null;
}

export type InboundWwebParams = {
  phone: string;
  content: string;
  type?: string;
  externalId?: string;
};

export async function processInboundWwebMessage(
  tenantId: string,
  params: InboundWwebParams
): Promise<void> {
  const { phone, content, type, externalId } = params;
  const norm = String(phone).replace(/\D/g, "");
  if (!norm) return;

  const text = (content != null ? String(content) : "").slice(0, 4000) || "[mensagem]";

  let lead = await db.lead.findFirst({
    where: { tenantId, deletedAt: null, phone: norm },
  });
  if (!lead) {
    const firstStageId = await getFirstStageId(tenantId);
    lead = await db.lead.create({
      data: {
        tenantId,
        name: `Contato ${norm}`,
        email: `wa-${norm}@placeholder.local`,
        phone: norm,
        source: "WHATSAPP",
        status: "NEW",
        stageId: firstStageId,
      },
    });
  }

  let conv = await db.conversation.findFirst({
    where: { tenantId, leadId: lead.id, channel: "WHATSAPP" },
  });
  if (!conv) {
    conv = await db.conversation.create({
      data: {
        tenantId,
        leadId: lead.id,
        channel: "WHATSAPP",
        externalId: externalId || `wweb-${norm}`,
        status: "open",
      },
    });
  }

  await db.message.create({
    data: {
      conversationId: conv.id,
      direction: "IN",
      content: text,
      metadata: type ? { type: String(type) } : undefined,
    },
  });

  await db.activity.create({
    data: {
      tenantId,
      leadId: lead.id,
      type: "WHATSAPP",
      content: text.slice(0, 500),
    },
  });

  await db.conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: new Date() },
  });
}
