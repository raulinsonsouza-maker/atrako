/**
 * Handler do job SDR: carrega dados, chama orquestrador, aplica delay + typing + envio, persiste.
 * Chamado pelo worker (job sdr-reply) ou por API interna; não usa sessão.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { mergeWithDefaults } from "@/lib/sdr/types";
import type { TenantSdrConfig, SdrConversationState } from "@/lib/sdr/types";
import { decideSdrResponse, getDelayMs } from "@/lib/sdr/orchestrator";
import { sendMessage, sendTyping } from "@/lib/integrations/whatsapp-channel";
import type { WhatsAppChannelConfig } from "@/lib/integrations/whatsapp-channel";

const MESSAGES_LIMIT = 30;
const DELAY_ENTRE_MENSAGENS_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Carrega config SDR do tenant (sem sessão). */
async function loadSdrConfig(tenantId: string): Promise<TenantSdrConfig | null> {
  const t = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  const config = t?.config as Record<string, unknown> | null | undefined;
  const sdr = (config?.sdr as Partial<TenantSdrConfig> | undefined) ?? null;
  if (!sdr || (Object.keys(sdr).length === 0)) return null;
  return mergeWithDefaults(sdr);
}

/**
 * Processa uma resposta SDR: carrega contexto, decide copy, envia typing + delay + mensagem(s), atualiza estado.
 * Retorna { ok: true } ou { ok: false, error: string }.
 */
export async function processSdrReply(
  tenantId: string,
  conversationId: string,
  leadId: string
): Promise<{ ok: boolean; error?: string }> {
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, tenantId, leadId },
    include: { lead: true },
  });
  if (!conv?.lead?.phone) {
    return { ok: false, error: "Conversa ou lead não encontrado." };
  }

  const integration = await db.integration.findFirst({
    where: { tenantId, type: "WHATSAPP", status: "ACTIVE" },
  });
  if (!integration?.config) {
    return { ok: false, error: "Integração WhatsApp não configurada." };
  }
  const cfg = integration.config as WhatsAppChannelConfig;
  const hasWhatsApp = cfg.provider === "wweb" || cfg.wwebServiceUrl || cfg.evolutionInstance || cfg.zapiInstanceId;
  if (!hasWhatsApp) {
    return { ok: false, error: "WhatsApp não configurado." };
  }

  const config = await loadSdrConfig(tenantId);
  if (!config) {
    return { ok: true }; // Sem config SDR: não responde, não é erro
  }

  const messages = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: MESSAGES_LIMIT,
    select: { direction: true, content: true },
  });
  const lastIn = messages.filter((m) => m.direction === "IN").pop();
  const lastLeadMessage = lastIn?.content ?? "";

  const metadata = (conv as { metadata?: unknown }).metadata as Record<string, unknown> | null | undefined;
  const sdrState = (metadata?.sdr as SdrConversationState | undefined) ?? null;

  const decision = decideSdrResponse({
    config,
    sdrState,
    messages: messages.map((m) => ({ direction: m.direction, content: m.content })),
    lastLeadMessage,
  });

  if (!decision) {
    return { ok: true };
  }

  const delayMs = getDelayMs(config, decision.delayType);
  const phone = conv.lead.phone;

  // Typing
  await sendTyping(cfg, phone, tenantId).catch(() => {});

  // Delay
  await sleep(delayMs);

  // Mensagens quebradas (por \n\n) com delay curto entre elas
  const partes = decision.copy.split(/\n\n+/).filter((p) => p.trim());
  const delayEntre = config.regras?.delay_entre_mensagens_quebradas_ms ?? DELAY_ENTRE_MENSAGENS_MS;

  for (let i = 0; i < partes.length; i++) {
    if (i > 0) {
      await sendTyping(cfg, phone, tenantId).catch(() => {});
      await sleep(delayEntre);
    }
    const text = partes[i].trim();
    const { ok, error } = await sendMessage(cfg, phone, text, tenantId);
    if (!ok) {
      return { ok: false, error: error ?? "Falha ao enviar." };
    }
    await db.message.create({
      data: { conversationId, direction: "OUT", content: text },
    });
    await db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
  }

  await db.activity.create({
    data: {
      tenantId,
      leadId: conv.leadId,
      type: "WHATSAPP",
      content: decision.copy.slice(0, 500),
    },
  });

  const newMetadata = { ...metadata, sdr: decision.newSdrState } as Record<string, unknown>;
  await db.conversation.update({
    where: { id: conversationId },
    data: { metadata: newMetadata as Prisma.InputJsonValue, lastMessageAt: new Date() },
  });

  return { ok: true };
}
