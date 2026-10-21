/**
 * Motor de qualificação WhatsApp — do cadastro até a equipe assumir.
 * Abertura por modelo aprovado (janela fechada) → perguntas faltantes → A/B: horário + equipe; C: nutrição.
 */

import { prisma } from "@/lib/db";
import {
  sendAndPersistText,
  sendAndPersistReplyButtons,
  sendAndPersistList,
  handoffConversation,
  isWithinCustomerWindow,
  upsertWaConversation,
} from "@/lib/whatsapp/domain";
import { missingFieldKeys, type QualifyAnswers, type QualifyFieldKey, WA_ASK_ORDER } from "./fields";
import { loadQualificationPrefs } from "./playbook";
import { matchChoice } from "./choices";
import {
  answerFromRaw,
  parseConversationQualify,
  parseLeadQualification,
  saveConversationQualify,
  snapshotFromAnswers,
  writeLeadAnswers,
  type ConversationQualifyState,
} from "./store";
import {
  LATER_COPY,
  QUALIFY_REPLY,
  START_ANYWAY,
  bestTimeCopy,
  handoffCopy,
  invalidChoiceCopy,
  numberedPrompt,
  nurtureCopy,
  openCopy,
  presentationCopy,
  reaskCopy,
} from "./messages";
import { exitFranchiseNurture, moveLeadToPriorityStage, notifyHandoff, notifyNurture } from "./routing";
import { classifyLead, type Priority } from "./classify";
import { leadBrief, type HandoffReason } from "./journey";

const HUMAN_RE =
  /(quero|preciso|pode|chama).{0,30}(atendente|pessoa|humano|consultor)|falar com (algu[eé]m|uma pessoa|atendente|consultor|vendedor)|atendente humano/i;
const MEETING_RE = /quero (conversar|falar|agendar)|marcar (uma )?conversa/i;
const START_RE = /^(come[cç]ar|sim|ok|bora|pode|vamos|claro|s)\b/i;
const LATER_RE = /^(depois|agora n[aã]o|mais tarde)\b/i;

type MsgOut = { body: string; buttons?: { id: string; title: string }[]; list?: { buttonText: string; rows: { id: string; title: string }[] } };

type Ctx = {
  workspaceId: string;
  conversationId: string;
  leadId: string;
  phone: string;
  contactId: string;
  contactName: string | null;
  playbookId: string;
  askKeys: QualifyFieldKey[];
  state: ConversationQualifyState;
};

async function send(ctx: Pick<Ctx, "workspaceId" | "phone" | "contactId" | "contactName">, msg: MsgOut | string) {
  const base = { workspaceId: ctx.workspaceId, to: ctx.phone, contactId: ctx.contactId, contactName: ctx.contactName };
  if (typeof msg === "string") return sendAndPersistText({ ...base, body: msg });
  if (msg.buttons?.length) return sendAndPersistReplyButtons({ ...base, body: msg.body, buttons: msg.buttons });
  if (msg.list?.rows.length) {
    return sendAndPersistList({ ...base, body: msg.body, buttonText: msg.list.buttonText, rows: msg.list.rows });
  }
  return sendAndPersistText({ ...base, body: msg.body });
}

async function saveState(ctx: Ctx, patch: Partial<ConversationQualifyState>, lead?: Parameters<typeof writeLeadAnswers>[0]["patch"], leadOpts?: { cadenceStatus?: "running" | "done" | "paused"; forcePriority?: Priority | null }) {
  ctx.state = { ...ctx.state, ...patch };
  await saveConversationQualify(ctx.conversationId, ctx.workspaceId, ctx.state);
  return writeLeadAnswers({
    workspaceId: ctx.workspaceId,
    leadId: ctx.leadId,
    playbookId: ctx.playbookId,
    patch: lead ?? {},
    currentState: ctx.state.currentState,
    ...(leadOpts?.cadenceStatus ? { cadenceStatus: leadOpts.cadenceStatus } : {}),
    ...(leadOpts?.forcePriority !== undefined ? { forcePriority: leadOpts.forcePriority } : {}),
  });
}

async function brandOf(workspaceId: string) {
  const c = await prisma.cliente.findUnique({ where: { id: workspaceId }, select: { nome: true } });
  return c?.nome || "nossa empresa";
}

async function loadAnswers(ctx: Ctx): Promise<{ answers: QualifyAnswers; priority: Priority | null } | null> {
  const lead = await prisma.nativeLead.findFirst({
    where: { id: ctx.leadId, clienteId: ctx.workspaceId },
    select: { metadata: true },
  });
  if (!lead) return null;
  const q = parseLeadQualification(lead.metadata);
  return { answers: q.answers, priority: q.priority };
}

async function askNext(ctx: Ctx, answers: QualifyAnswers) {
  const missing = missingFieldKeys(answers, ctx.askKeys);
  if (!missing.length) return finishQuestions(ctx, answers);
  const next = missing[0]!;
  const total = Math.max(ctx.state.totalQuestions ?? missing.length, missing.length);
  await send(ctx, numberedPrompt(next, total - missing.length + 1, total));
  await saveState(ctx, { automationStatus: "active", currentState: `awaiting_${next}`, awaitingField: next, invalidCount: 0 }, undefined, {
    cadenceStatus: "running",
  });
  return true;
}

async function finishQuestions(ctx: Ctx, answers: QualifyAnswers) {
  const priority = classifyLead(snapshotFromAnswers(answers));
  const qualifiedAt = new Date().toISOString();
  if (priority === "C") {
    await send(ctx, nurtureCopy(ctx.contactName));
    await saveState(ctx, { currentState: "nurture", awaitingField: null, qualifiedAt }, undefined, {
      cadenceStatus: "done",
      forcePriority: "C",
    });
    await moveLeadToPriorityStage({ workspaceId: ctx.workspaceId, leadId: ctx.leadId, priority: "C" });
    await notifyNurture({ workspaceId: ctx.workspaceId, leadId: ctx.leadId, contactName: ctx.contactName });
    return true;
  }
  if (!answers.best_contact_time?.code) {
    await send(ctx, bestTimeCopy(ctx.contactName, priority === "A"));
    await saveState(ctx, { currentState: "awaiting_best_time", awaitingField: "best_contact_time", qualifiedAt, handoffReason: "qualified" }, undefined, {
      cadenceStatus: "running",
      forcePriority: priority,
    });
    await moveLeadToPriorityStage({ workspaceId: ctx.workspaceId, leadId: ctx.leadId, priority });
    return true;
  }
  ctx.state = { ...ctx.state, qualifiedAt };
  return handoff(ctx, answers, priority, "qualified");
}

/** Pedido de conversa: pergunta o horário (1 toque) se faltar, depois passa para a equipe. */
async function requestMeeting(ctx: Ctx, answers: QualifyAnswers, priority: Priority | null, reason: HandoffReason) {
  if (!answers.best_contact_time?.code) {
    await send(ctx, bestTimeCopy(ctx.contactName, false));
    await saveState(ctx, { currentState: "awaiting_best_time", awaitingField: "best_contact_time", handoffReason: reason }, undefined, {
      cadenceStatus: "running",
    });
    return true;
  }
  return handoff(ctx, answers, priority, reason);
}

async function handoff(ctx: Ctx, answers: QualifyAnswers, priority: Priority | null, reason: HandoffReason) {
  // A equipe assume mesmo se a última mensagem ao lead falhar.
  await send(ctx, handoffCopy(ctx.contactName, answers.best_contact_time?.code)).catch((err) =>
    console.warn("[qualification] handoff copy", err instanceof Error ? err.message : err),
  );
  await handoffConversation(ctx.conversationId, ctx.workspaceId);
  await saveState(ctx, { automationStatus: "done", currentState: "meeting_requested", awaitingField: null, handoffAt: new Date().toISOString(), handoffReason: reason }, undefined, {
    cadenceStatus: "done",
    ...(priority ? { forcePriority: priority } : {}),
  });
  await moveLeadToPriorityStage({ workspaceId: ctx.workspaceId, leadId: ctx.leadId, priority: priority === "A" ? "A" : "B" });
  await exitFranchiseNurture(ctx.workspaceId, ctx.leadId, "meeting_requested");
  const brief = leadBrief({ answers, priority, reason });
  const { addLeadNote } = await import("@/lib/modules/crm");
  await addLeadNote({ workspaceId: ctx.workspaceId, leadId: ctx.leadId, text: brief }).catch((err) =>
    console.warn("[qualification] brief", err instanceof Error ? err.message : err),
  );
  await notifyHandoff({
    workspaceId: ctx.workspaceId,
    leadId: ctx.leadId,
    priority,
    contactName: ctx.contactName,
    brief,
  });
  return true;
}

export async function startQualificationFlow(input: {
  workspaceId: string;
  leadId: string;
  contactId: string;
  phone: string;
  contactName?: string | null;
  /** Reenvio pela cadência quando a abertura ficou retida. */
  retry?: boolean;
}) {
  const prefs = await loadQualificationPrefs(input.workspaceId);
  if (!prefs.enabled) return { started: false as const, reason: "disabled" };
  const { resolveWhatsApp } = await import("@/lib/config/resolveConnection");
  if (!(await resolveWhatsApp(input.workspaceId))) return { started: false as const, reason: "whatsapp_not_connected" };

  const [lead, contact, cliente] = await Promise.all([
    prisma.nativeLead.findFirst({ where: { id: input.leadId, clienteId: input.workspaceId }, select: { metadata: true } }),
    prisma.nativeContact.findFirst({ where: { id: input.contactId, clienteId: input.workspaceId } }),
    prisma.cliente.findUnique({ where: { id: input.workspaceId }, select: { nome: true } }),
  ]);
  if (!lead || !contact) return { started: false as const, reason: "no_lead" };

  const askKeys = prefs.askKeys.length ? prefs.askKeys : WA_ASK_ORDER;
  const q = parseLeadQualification(lead.metadata);
  const missing = missingFieldKeys(q.answers, askKeys);

  const conversation = await upsertWaConversation({
    workspaceId: input.workspaceId,
    phone: input.phone,
    contactId: input.contactId,
    contactName: input.contactName,
  });
  const existing = parseConversationQualify(conversation.qualification);
  if (existing?.automationStatus === "done" || existing?.automationStatus === "paused") {
    return { started: false as const, reason: "already_closed" };
  }
  if (input.retry && existing?.openedAt) return { started: false as const, reason: "already_open" };

  const ctx: Ctx = {
    workspaceId: input.workspaceId,
    conversationId: conversation.id,
    leadId: input.leadId,
    phone: input.phone,
    contactId: input.contactId,
    contactName: input.contactName ?? contact.name,
    playbookId: prefs.playbookId,
    askKeys,
    state: existing ?? {
      playbookId: prefs.playbookId,
      automationStatus: "active",
      currentState: "awaiting_start_choice",
      awaitingField: null,
      startedAt: new Date().toISOString(),
      followUpCount: 0,
    },
  };

  let opened = false;
  if (isWithinCustomerWindow(conversation.windowExpiresAt)) {
    const open = openCopy({
      name: ctx.contactName,
      brand: cliente?.nome || "nossa empresa",
      city: q.answers.city?.label,
      questions: missing.length,
    });
    opened = Boolean(await send(ctx, open).then(() => true).catch(() => false));
  } else {
    const { sendWhatsAppMessage } = await import("@/lib/flows/send");
    const { loadMessagingPrefs } = await import("@/lib/flows/prefs");
    const { prefs: msgPrefs } = await loadMessagingPrefs(input.workspaceId);
    const result = await sendWhatsAppMessage({
      clienteId: input.workspaceId,
      contact,
      content: { purpose: "qualify_open" },
      data: {},
      origin: { flowKey: "qualify_open" },
      automatic: true,
      reservePercent: msgPrefs.waAutoReservePercent,
    });
    opened = result.status === "SENT";
    if (result.status !== "SENT" && result.reason.startsWith("template_")) {
      const { notify } = await import("@/lib/notifications");
      await notify({
        clienteId: input.workspaceId,
        role: "ADMIN",
        type: "wa.template",
        title: "Qualificação no WhatsApp parada",
        body: "O modelo de primeiro contato (qualify_open) ainda não está aprovado na Meta.",
        href: "/crm",
        severity: "aviso",
        dedupeKey: `wa-template:qualify_open:${input.workspaceId}`,
        email: false,
      });
    }
  }

  await saveState(
    ctx,
    {
      automationStatus: "active",
      currentState: missing.length ? "awaiting_start_choice" : "awaiting_post_form_engagement",
      awaitingField: null,
      totalQuestions: missing.length,
      openedAt: opened ? new Date().toISOString() : null,
    },
    undefined,
    { cadenceStatus: "running" },
  );
  return { started: opened, conversationId: conversation.id, complete: false };
}

export async function handleQualificationInbound(input: {
  workspaceId: string;
  conversationId: string;
  contactId: string;
  leadId: string;
  phone: string;
  body: string | null;
  replyId?: string | null;
}): Promise<boolean> {
  const prefs = await loadQualificationPrefs(input.workspaceId);
  if (!prefs.enabled) return false;

  const conversation = await prisma.waConversation.findFirst({
    where: { id: input.conversationId, clienteId: input.workspaceId },
    select: { status: true, qualification: true, contactName: true },
  });
  if (!conversation || conversation.status === "HANDED_OFF") return false;

  const state = parseConversationQualify(conversation.qualification);
  if (!state || state.automationStatus !== "active") return false;

  const ctx: Ctx = {
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    leadId: input.leadId,
    phone: input.phone,
    contactId: input.contactId,
    contactName: conversation.contactName,
    playbookId: prefs.playbookId,
    askKeys: prefs.askKeys.length ? prefs.askKeys : WA_ASK_ORDER,
    state,
  };
  const loaded = await loadAnswers(ctx);
  if (!loaded) return false;
  const { answers, priority } = loaded;

  const text = (input.body ?? "").trim();
  const replyId = (input.replyId || "").trim();
  const current = state.currentState;

  if (replyId === QUALIFY_REPLY.meeting || (!replyId && MEETING_RE.test(text))) {
    return requestMeeting(ctx, answers, priority, current === "nurture" ? "nurture_reply" : "asked_consultant");
  }
  if (!replyId && HUMAN_RE.test(text)) return handoff(ctx, answers, priority, "asked_human");

  if (current === "awaiting_best_time") {
    const choice = matchChoice("best_contact_time", replyId || text);
    const raw = choice?.code ?? text;
    if (!raw) return true;
    const updated = await writeLeadAnswers({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      playbookId: ctx.playbookId,
      patch: { best_contact_time: answerFromRaw("best_contact_time", raw, "whatsapp") },
    });
    return handoff(ctx, updated?.answers ?? answers, updated?.priority ?? priority, state.handoffReason ?? "qualified");
  }

  if (current === "nurture") {
    if (!text && !replyId) return true;
    return requestMeeting(ctx, answers, priority, "nurture_reply");
  }

  if (current === "awaiting_start_choice" || current === "awaiting_post_form_engagement") {
    if (replyId === QUALIFY_REPLY.later || LATER_RE.test(text)) {
      await send(ctx, LATER_COPY);
      return true;
    }
    if (replyId === QUALIFY_REPLY.presentation || /apresenta/i.test(text)) {
      await send(ctx, presentationCopy(await brandOf(ctx.workspaceId)));
      await saveState(ctx, { presentationSentAt: new Date().toISOString() });
      return true;
    }
    const missing = missingFieldKeys(answers, ctx.askKeys);
    if (!missing.length) return finishQuestions(ctx, answers);
    if (replyId !== QUALIFY_REPLY.start && !START_RE.test(text)) await send(ctx, START_ANYWAY);
    ctx.state = { ...ctx.state, totalQuestions: missing.length };
    return askNext(ctx, answers);
  }

  const field = state.awaitingField;
  if (!field) return true;

  let value: string | null = null;
  if (field === "city") {
    const city = text.replace(/^\[|\]$/g, "").trim();
    value = city.length >= 2 ? city : null;
  } else {
    value = matchChoice(field, replyId || text)?.code ?? null;
  }

  if (!value) {
    const misses = (state.invalidCount ?? 0) + 1;
    if (misses >= 2 && text) return handoff(ctx, answers, priority, "free_text");
    await send(ctx, invalidChoiceCopy(field));
    const missing = missingFieldKeys(answers, ctx.askKeys);
    const total = Math.max(state.totalQuestions ?? missing.length, missing.length);
    await send(ctx, numberedPrompt(field, total - missing.length + 1, total));
    await saveState(ctx, { invalidCount: misses });
    return true;
  }

  const updated = await writeLeadAnswers({
    workspaceId: ctx.workspaceId,
    leadId: ctx.leadId,
    playbookId: ctx.playbookId,
    patch: { [field]: answerFromRaw(field, value, "whatsapp") },
  });
  return askNext(ctx, updated?.answers ?? answers);
}

/** Retomada pela cadência: repete a pergunta pendente (só com a janela de 24h aberta). */
export async function followUpQualification(input: {
  workspaceId: string;
  conversationId: string;
  leadId: string;
  phone: string;
  contactId: string;
  contactName?: string | null;
}) {
  const prefs = await loadQualificationPrefs(input.workspaceId);
  if (!prefs.enabled) return false;
  const conversation = await prisma.waConversation.findFirst({
    where: { id: input.conversationId, clienteId: input.workspaceId },
    select: { status: true, qualification: true, windowExpiresAt: true },
  });
  if (!conversation || conversation.status === "HANDED_OFF") return false;
  if (!isWithinCustomerWindow(conversation.windowExpiresAt)) return false;
  const state = parseConversationQualify(conversation.qualification);
  if (!state || state.automationStatus !== "active") return false;
  if ((state.followUpCount ?? 0) >= 2) return false;

  const ctx: Ctx = {
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    leadId: input.leadId,
    phone: input.phone,
    contactId: input.contactId,
    contactName: input.contactName ?? null,
    playbookId: prefs.playbookId,
    askKeys: prefs.askKeys.length ? prefs.askKeys : WA_ASK_ORDER,
    state,
  };
  const loaded = await loadAnswers(ctx);
  if (!loaded) return false;
  const followUpCount = (state.followUpCount ?? 0) + 1;

  if (state.currentState === "awaiting_best_time") {
    await send(ctx, bestTimeCopy(ctx.contactName, false));
    await saveState(ctx, { followUpCount });
    return true;
  }
  const missing = missingFieldKeys(loaded.answers, ctx.askKeys);
  if (!missing.length) return false;
  if (state.currentState === "awaiting_start_choice") {
    await send(ctx, openCopy({ name: ctx.contactName, brand: await brandOf(ctx.workspaceId), questions: missing.length }));
    await saveState(ctx, { followUpCount });
    return true;
  }
  const next = missing[0]!;
  const total = Math.max(state.totalQuestions ?? missing.length, missing.length);
  await send(ctx, reaskCopy(next, total - missing.length + 1, total));
  await saveState(ctx, { awaitingField: next, currentState: `awaiting_${next}`, followUpCount });
  return true;
}
