/**
 * Webhook WhatsApp → fluxos:
 * - statuses: timestamps/custo em MessageDelivery, erros 131049/131050/132015 (fallback e-mail / re-fila);
 * - entrada: "parar/sair", botão atk_optout, dúvida → handoff, resposta pausa fluxos de venda;
 * - templates: status/qualidade/categoria/componentes → WaTemplateRef + WaTemplateEvent + aviso;
 * - conta: user_preferences, business_capability_update, account_update, phone_number_quality_update.
 */

import { prisma } from "@/lib/db";
import { applyDeliveryEvent, type DeliveryEventType } from "@/lib/flows/delivery-status";
import { applyWaErrorToContact, patchWhatsAppMetadata, refreshWaAccountInfo, tierToLimit, waRateFor } from "@/lib/flows/wa-limits";
import { exitEnrollments, handleAsyncWaFailure, pauseContactFlows } from "@/lib/flows/engine";
import { promoteApprovedVersion } from "@/lib/flows/wa-templates";
import { parseBirthdayReply, upsertContactBirthday } from "@/lib/flows/important-dates";
import { sendWhatsAppText } from "@/lib/integrations/whatsapp/messages";
import { notify } from "@/lib/notifications";

export const OPTOUT_PAYLOAD = "atk_optout";
export const HELP_PAYLOAD = "atk_help";
const OPTOUT_RE = /^\s*(parar|pare|sair|stop|cancelar|descadastrar|n[aã]o quero (mais )?receber)\s*[.!]*\s*$/i;

type WaStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  pricing?: { billable?: boolean; category?: string; pricing_model?: string; type?: string };
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
};

const STATUS_EVENT: Record<string, DeliveryEventType> = {
  sent: "sent",
  delivered: "delivered",
  read: "opened",
  failed: "failed",
};

async function priceMicros(category: string | undefined, billable: boolean | undefined) {
  if (!category || billable === false) return 0;
  const rate = await waRateFor(category);
  return rate?.priceMicros ?? null;
}

export async function handleFlowStatuses(workspaceId: string, statuses: WaStatus[]) {
  for (const s of statuses) {
    if (!s.id || !s.status) continue;
    const delivery = await prisma.messageDelivery.findFirst({
      where: { clienteId: workspaceId, channel: "WHATSAPP", providerMessageId: s.id },
      select: { id: true, contactId: true, costMicros: true },
    });
    if (!delivery) continue;
    const event = STATUS_EVENT[s.status];
    if (!event) continue;
    const at = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date();
    const err = s.errors?.[0];
    const extra: Record<string, unknown> = {};
    if (s.pricing?.category) {
      extra.pricingCategory = s.pricing.category.toLowerCase().slice(0, 20);
      extra.billable = s.pricing.billable ?? null;
      if (delivery.costMicros == null) extra.costMicros = await priceMicros(s.pricing.category, s.pricing.billable);
    }
    if (err) {
      extra.errorCode = err.code ?? null;
      extra.error = `${err.code ?? ""} ${err.title ?? err.message ?? ""} ${err.error_data?.details ?? ""}`.trim().slice(0, 500);
    }
    const fresh = await applyDeliveryEvent({
      deliveryId: delivery.id,
      clienteId: workspaceId,
      contactId: delivery.contactId,
      event,
      at,
      meta: { status: s.status, ...(err ? { errorCode: err.code } : {}) },
      providerEventId: `wa:${s.id}:${s.status}`,
      extra,
    });
    if (fresh && (event === "delivered" || event === "opened") && delivery.contactId) {
      await prisma.nativeContact.updateMany({
        where: { id: delivery.contactId, waUndeliverableAt: { not: null } },
        data: { waUndeliverableAt: null },
      });
    }
    if (fresh && event === "failed" && err?.code) {
      const effect = await applyWaErrorToContact(delivery.contactId, err.code);
      if (effect.fallbackEmail || effect.requeue) await handleAsyncWaFailure(delivery.id, effect);
    }
  }
}

type WaInbound = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: { button_reply?: { id?: string; title?: string } };
};

/** Mensagem recebida de um contato (já resolvido no hub). */
export async function handleFlowInbound(workspaceId: string, contactId: string, msg: WaInbound) {
  const payload = msg.button?.payload || msg.interactive?.button_reply?.id || "";
  const text = (msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || "").trim();
  const now = new Date();

  if (payload === OPTOUT_PAYLOAD || (Boolean(msg.button) && /n[aã]o quero receber/i.test(text))) {
    await prisma.nativeContact.updateMany({ where: { id: contactId, clienteId: workspaceId }, data: { waMarketingOptOutAt: now } });
    await exitEnrollments({ clienteId: workspaceId, contactId, reason: "wa_optout", channel: "WHATSAPP" });
    return { action: "optout_marketing" as const };
  }
  if (OPTOUT_RE.test(text)) {
    await prisma.nativeContact.updateMany({
      where: { id: contactId, clienteId: workspaceId },
      data: { waOptOutAt: now, waMarketingOptOutAt: now },
    });
    await exitEnrollments({ clienteId: workspaceId, contactId, reason: "wa_stop", channel: "WHATSAPP" });
    return { action: "optout_all" as const };
  }
  if (payload === HELP_PAYLOAD || (Boolean(msg.button || msg.interactive) && /d[uú]vida|ajuda|falar com/i.test(text))) {
    await prisma.waConversation.updateMany({
      where: { clienteId: workspaceId, contactId },
      data: { handedOffAt: now, status: "HANDED_OFF" },
    });
    await pauseContactFlows(workspaceId, contactId);
    await notify({
      clienteId: workspaceId,
      type: "wa.handoff",
      title: "Cliente pediu atendimento no WhatsApp",
      body: text.slice(0, 300) || "Cliente tocou em \"Tenho dúvida\".",
      href: "/inbox",
      severity: "aviso",
      dedupeKey: `handoff:${contactId}:${now.toISOString().slice(0, 13)}`,
      email: false,
    });
    return { action: "handoff" as const };
  }
  if (text && (await captureBirthdayReply(workspaceId, contactId, msg.from, text, now))) {
    return { action: "birthday_saved" as const };
  }
  // Qualquer resposta: pausa fluxos de venda (evita mensagem automática no meio da conversa)
  await pauseContactFlows(workspaceId, contactId);
  return { action: "paused" as const };
}

/** Resposta ao template `birthday_ask` (últimos 7 dias) com uma data → ContactImportantDate. */
async function captureBirthdayReply(workspaceId: string, contactId: string, from: string | undefined, text: string, now: Date) {
  const raw = parseBirthdayReply(text);
  if (!raw) return false;
  const last = await prisma.messageDelivery.findFirst({
    where: { clienteId: workspaceId, contactId, channel: "WHATSAPP", isTest: false, sentAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
    orderBy: { sentAt: "desc" },
    select: { templateName: true },
  });
  if (!last?.templateName) return false;
  const ref = await prisma.waTemplateRef.findFirst({
    where: { clienteId: workspaceId, name: last.templateName },
    select: { purpose: true },
  });
  if (ref?.purpose !== "birthday_ask") return false;
  const saved = await upsertContactBirthday({ workspaceId, contactId, raw, source: "whatsapp" });
  if (!saved) return false;
  if (from) {
    await sendWhatsAppText({
      workspaceId,
      to: from,
      body: `Anotado: ${String(saved.day).padStart(2, "0")}/${String(saved.month).padStart(2, "0")}. Obrigado! No dia, você recebe um presente da gente.`,
    }).catch(() => null);
  }
  return true;
}

async function findWorkspaceByWaba(wabaId: string) {
  if (!wabaId) return null;
  const rows = await prisma.workspaceConnection.findMany({
    where: { provider: "WHATSAPP", status: "ACTIVE" },
    select: { clienteId: true, metadata: true },
  });
  const hit = rows.find((r) => (r.metadata as Record<string, unknown> | null)?.wabaId === wabaId);
  if (hit) return hit.clienteId;
  // wabaId pode estar só nas credenciais (conexão manual)
  const { resolveWhatsApp } = await import("@/lib/config/resolveConnection");
  for (const r of rows) {
    const wa = await resolveWhatsApp(r.clienteId).catch(() => null);
    if (wa?.wabaId === wabaId) return r.clienteId;
  }
  return null;
}

type TemplateValue = {
  event?: string;
  message_template_id?: number | string;
  message_template_name?: string;
  message_template_language?: string;
  reason?: string;
  previous_quality_score?: string;
  new_quality_score?: string;
  previous_category?: string;
  new_category?: string;
  correct_category?: string;
  other_info?: { title?: string; description?: string };
};

const TEMPLATE_STATUS_LABEL: Record<string, string> = {
  APPROVED: "aprovado",
  REJECTED: "rejeitado",
  PAUSED: "pausado",
  DISABLED: "desativado",
  FLAGGED: "sinalizado",
  IN_APPEAL: "em recurso",
  REINSTATED: "reativado",
  PENDING_DELETION: "em exclusão",
  ARCHIVED: "arquivado",
  LIMIT_EXCEEDED: "limite excedido",
};

async function templateRefFor(workspaceId: string, v: TemplateValue) {
  const metaId = v.message_template_id != null ? String(v.message_template_id) : null;
  if (metaId) {
    const r = await prisma.waTemplateRef.findFirst({ where: { clienteId: workspaceId, metaTemplateId: metaId } });
    if (r) return r;
  }
  if (v.message_template_name) {
    return prisma.waTemplateRef.findFirst({
      where: {
        clienteId: workspaceId,
        name: v.message_template_name,
        ...(v.message_template_language ? { language: v.message_template_language } : {}),
      },
    });
  }
  return null;
}

async function handleTemplateChange(workspaceId: string, field: string, v: TemplateValue, raw: unknown) {
  const ref = await templateRefFor(workspaceId, v);
  const metaId = v.message_template_id != null ? String(v.message_template_id) : null;
  let detail: string | null = null;

  if (field === "message_template_status_update" && v.event) {
    const status = v.event === "REINSTATED" ? "APPROVED" : v.event;
    detail = v.reason && v.reason !== "NONE" ? v.reason : v.other_info?.description ?? null;
    if (ref) {
      const pausing = status === "PAUSED";
      await prisma.waTemplateRef.update({
        where: { id: ref.id },
        data: {
          status,
          rejectedReason: status === "REJECTED" ? (detail ?? "Rejeitado").slice(0, 500) : ref.rejectedReason,
          ...(pausing
            ? { pauseCount: { increment: 1 }, pausedUntil: new Date(Date.now() + (ref.pauseCount ? 6 : 3) * 3_600_000) }
            : {}),
        },
      });
      if (status === "APPROVED") await promoteApprovedVersion(ref.id);
    }
    const label = TEMPLATE_STATUS_LABEL[v.event] ?? v.event.toLowerCase();
    const bad = ["REJECTED", "PAUSED", "DISABLED", "FLAGGED", "LIMIT_EXCEEDED"].includes(v.event);
    await notify({
      clienteId: workspaceId,
      type: `wa.template.${v.event.toLowerCase()}`,
      title: `Template WhatsApp ${v.message_template_name ?? ""} ${label}`.trim(),
      body: bad
        ? `${detail ? `Motivo: ${detail}. ` : ""}Os passos que usam este template enviam o e-mail alternativo até uma nova versão ser aprovada.`
        : v.event === "APPROVED"
          ? "Os fluxos que usam este template já podem enviar pelo WhatsApp."
          : null,
      href: "/relacionamento?tab=ajustes&sub=whatsapp",
      severity: v.event === "DISABLED" ? "urgente" : bad ? "aviso" : "info",
      dedupeKey: `tpl:${metaId ?? v.message_template_name}:${v.event}:${new Date().toISOString().slice(0, 10)}`,
    });
  } else if (field === "message_template_quality_update") {
    detail = `${v.previous_quality_score ?? "?"} → ${v.new_quality_score ?? "?"}`;
    if (ref) await prisma.waTemplateRef.update({ where: { id: ref.id }, data: { qualityScore: v.new_quality_score ?? null } });
    if (v.new_quality_score === "RED" || v.new_quality_score === "YELLOW") {
      await notify({
        clienteId: workspaceId,
        type: "wa.template.quality",
        title: `Qualidade do template ${v.message_template_name ?? ""} caiu (${v.new_quality_score})`,
        body: "Muitos bloqueios ou denúncias. Revise o texto e a frequência antes que a Meta pause o template.",
        href: "/relacionamento?tab=ajustes&sub=whatsapp",
        severity: v.new_quality_score === "RED" ? "urgente" : "aviso",
        dedupeKey: `tplq:${metaId}:${v.new_quality_score}:${new Date().toISOString().slice(0, 10)}`,
      });
    }
  } else if (field === "template_category_update") {
    const next = v.new_category ?? v.correct_category ?? null;
    detail = `${v.previous_category ?? "?"} → ${next ?? "?"}`;
    if (ref && next) await prisma.waTemplateRef.update({ where: { id: ref.id }, data: { category: next } });
    if (ref?.requestedCategory === "UTILITY" && next === "MARKETING") {
      await notify({
        clienteId: workspaceId,
        type: "wa.template.category",
        title: `Template ${v.message_template_name ?? ""} recategorizado para Marketing`,
        body: "O custo por mensagem subiu e passa a contar no limite de marketing. Crie uma versão estritamente transacional se quiser voltar a Utilidade.",
        href: "/relacionamento?tab=ajustes&sub=whatsapp",
        severity: "aviso",
        dedupeKey: `tplc:${metaId}:${next}`,
      });
    }
  } else if (field === "message_template_components_update") {
    detail = "Componentes atualizados";
  }

  await prisma.waTemplateEvent.create({
    data: {
      clienteId: workspaceId,
      templateRefId: ref?.id ?? null,
      metaTemplateId: metaId,
      field: field.slice(0, 60),
      event: (v.event ?? v.new_quality_score ?? v.new_category ?? null)?.slice(0, 60) ?? null,
      detail: detail?.slice(0, 500) ?? null,
      payload: raw as object,
    },
  });
}

type AccountValue = {
  event?: string;
  user_preferences?: Array<{ wa_id?: string; category?: string; value?: string; detail?: string }>;
  max_daily_conversation_per_phone?: number | string;
  max_daily_conversations_per_business?: number | string;
  current_limit?: string;
  old_limit?: string;
  display_phone_number?: string;
};

async function handleAccountChange(workspaceId: string, field: string, v: AccountValue) {
  if (field === "user_preferences") {
    for (const p of v.user_preferences ?? []) {
      if (!p.wa_id || p.category !== "marketing_messages") continue;
      const digits = p.wa_id.replace(/\D/g, "");
      const contacts = await prisma.nativeContact.findMany({
        where: { clienteId: workspaceId, OR: [{ phoneE164: `+${digits}` }, { phoneE164: digits }, { phone: { endsWith: digits.slice(-10) } }] },
        select: { id: true },
        take: 5,
      });
      for (const c of contacts) {
        await prisma.nativeContact.update({
          where: { id: c.id },
          data: { waMarketingOptOutAt: p.value === "stop" ? new Date() : null },
        });
      }
    }
    return;
  }
  if (field === "business_capability_update") {
    const limit = v.max_daily_conversations_per_business ?? v.max_daily_conversation_per_phone;
    if (limit != null) await patchWhatsAppMetadata(workspaceId, { messagingLimit: String(limit) });
    return;
  }
  if (field === "phone_number_quality_update") {
    const patch: Record<string, unknown> = { phoneQualityEvent: v.event ?? null };
    if (v.current_limit) patch.messagingLimit = v.current_limit;
    await patchWhatsAppMetadata(workspaceId, patch);
    if (v.event === "FLAGGED" || v.event === "DOWNGRADE") {
      await notify({
        clienteId: workspaceId,
        type: "wa.phone.quality",
        title: v.event === "FLAGGED" ? "Número do WhatsApp sinalizado pela Meta" : "Limite de envio do WhatsApp reduzido",
        body: `Novo limite: ${tierToLimit(v.current_limit) ?? "ilimitado"} destinatários/24h. Reduza campanhas de marketing até a qualidade voltar.`,
        href: "/relacionamento",
        severity: "urgente",
        dedupeKey: `waq:${v.event}:${new Date().toISOString().slice(0, 10)}`,
      });
    }
    return;
  }
  if (field === "account_update") {
    await refreshWaAccountInfo(workspaceId).catch(() => null);
  }
}

const TEMPLATE_FIELDS = new Set([
  "message_template_status_update",
  "message_template_quality_update",
  "template_category_update",
  "message_template_components_update",
]);
const ACCOUNT_FIELDS = new Set(["user_preferences", "business_capability_update", "phone_number_quality_update", "account_update"]);

/** Campos sem phone_number_id (templates/conta): resolve workspace pela WABA (entry.id). */
export async function handleWabaLevelChange(entryId: string, field: string, value: unknown) {
  if (!TEMPLATE_FIELDS.has(field) && !ACCOUNT_FIELDS.has(field)) return false;
  const workspaceId = await findWorkspaceByWaba(entryId);
  if (!workspaceId) return true;
  if (TEMPLATE_FIELDS.has(field)) await handleTemplateChange(workspaceId, field, (value ?? {}) as TemplateValue, value);
  else await handleAccountChange(workspaceId, field, (value ?? {}) as AccountValue);
  return true;
}
