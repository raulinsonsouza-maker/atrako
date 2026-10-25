/**
 * Motor de qualificação WhatsApp — do cadastro até a equipe assumir.
 * Abertura por modelo aprovado (janela fechada) → perguntas do roteiro → A/B: horário + equipe; C: nutrição.
 * Textos, opções, ordem e regras vêm do roteiro (script.ts) do workspace.
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
import { CHOICE_MAP, matchChoice } from "./choices";
import { missingFieldKeys, type QualifyAnswers, type QualifyFieldKey } from "./fields";
import { loadQualificationPrefs, type QualificationPrefs } from "./playbook";
import {
  answerFromChoice,
  answerFromRaw,
  parseConversationQualify,
  parseLeadQualification,
  saveConversationQualify,
  writeLeadAnswers,
  type ConversationQualifyState,
} from "./store";
import { LATER_COPY, QUALIFY_REPLY, START_ANYWAY, invalidChoiceCopy, presentationCopy } from "./messages";
import {
  bestTimeMessage,
  classifyWithRules,
  followUpOf,
  handoffMessage,
  nurtureMessage,
  openingMessage,
  questionMessage,
  questionOf,
  renderText,
  type QualifyScript,
  type ScriptMessage,
  type ScriptVars,
} from "./script";
import { exitFranchiseNurture, moveLeadToPriorityStage, notifyHandoff, notifyNurture } from "./routing";
import type { Priority } from "./classify";
import { leadBrief, type HandoffReason } from "./journey";

const HUMAN_RE =
  /(quero|preciso|pode|chama).{0,30}(atendente|pessoa|humano|consultor)|falar com (algu[eé]m|uma pessoa|atendente|consultor|vendedor)|atendente humano/i;
const MEETING_RE = /quero (conversar|falar|agendar)|marcar (uma )?conversa/i;
const START_RE = /^(come[cç]ar|sim|ok|bora|pode|vamos|claro|s)\b/i;
const LATER_RE = /^(depois|agora n[aã]o|mais tarde)\b/i;

type Ctx = {
  workspaceId: string;
  conversationId: string;
  leadId: string;
  phone: string;
  contactId: string;
  contactName: string | null;
  playbookId: string;
  askKeys: QualifyFieldKey[];
  script: QualifyScript;
  brand: string;
  state: ConversationQualifyState;
};

async function send(ctx: Pick<Ctx, "workspaceId" | "phone" | "contactId" | "contactName">, msg: ScriptMessage | string) {
  const base = { workspaceId: ctx.workspaceId, to: ctx.phone, contactId: ctx.contactId, contactName: ctx.contactName };
  if (typeof msg === "string") return sendAndPersistText({ ...base, body: msg });
  if (msg.buttons?.length) return sendAndPersistReplyButtons({ ...base, body: msg.body, buttons: msg.buttons });
  if (msg.list?.rows.length) {
    return sendAndPersistList({ ...base, body: msg.body, buttonText: msg.list.buttonText, rows: msg.list.rows });
  }
  return sendAndPersistText({ ...base, body: msg.body });
}

function classifier(ctx: Ctx) {
  return (answers: QualifyAnswers) => classifyWithRules(answers, ctx.script.rules, ctx.askKeys);
}

async function writeAnswers(ctx: Ctx, patch: Parameters<typeof writeLeadAnswers>[0]["patch"]) {
  return writeLeadAnswers({
    workspaceId: ctx.workspaceId,
    leadId: ctx.leadId,
    playbookId: ctx.playbookId,
    patch,
    askKeys: ctx.askKeys,
    classify: classifier(ctx),
  });
}

async function saveState(
  ctx: Ctx,
  patch: Partial<ConversationQualifyState>,
  leadOpts?: { cadenceStatus?: "running" | "done" | "paused"; forcePriority?: Priority | null },
) {
  ctx.state = { ...ctx.state, ...patch };
  await saveConversationQualify(ctx.conversationId, ctx.workspaceId, ctx.state);
  return writeLeadAnswers({
    workspaceId: ctx.workspaceId,
    leadId: ctx.leadId,
    playbookId: ctx.playbookId,
    patch: {},
    currentState: ctx.state.currentState,
    askKeys: ctx.askKeys,
    classify: classifier(ctx),
    ...(leadOpts?.cadenceStatus ? { cadenceStatus: leadOpts.cadenceStatus } : {}),
    ...(leadOpts?.forcePriority !== undefined ? { forcePriority: leadOpts.forcePriority } : {}),
  });
}

async function brandOf(workspaceId: string) {
  const c = await prisma.cliente.findUnique({ where: { id: workspaceId }, select: { nome: true } });
  return c?.nome || "nossa empresa";
}

function varsOf(ctx: Ctx, answers?: QualifyAnswers): ScriptVars {
  return {
    nome: ctx.contactName,
    empresa: ctx.brand,
    cidade: answers?.city?.label ?? null,
    horario: answers?.best_contact_time?.code ?? null,
  };
}

async function ctxFor(
  prefs: QualificationPrefs,
  base: Omit<Ctx, "playbookId" | "askKeys" | "script" | "brand">,
): Promise<Ctx> {
  return {
    ...base,
    playbookId: prefs.playbookId,
    askKeys: prefs.askKeys,
    script: prefs.script,
    brand: await brandOf(base.workspaceId),
  };
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

function progressOf(ctx: Ctx, answers: QualifyAnswers) {
  const missing = missingFieldKeys(answers, ctx.askKeys);
  const total = Math.max(ctx.state.totalQuestions ?? missing.length, missing.length);
  return { missing, total, index: total - missing.length + 1 };
}

/** Próxima pergunta que falta; `prefix` vai no mesmo balão (uma mensagem por vez mantém o ritmo). */
async function askNext(ctx: Ctx, answers: QualifyAnswers, prefix?: string) {
  const { missing, total, index } = progressOf(ctx, answers);
  if (!missing.length) return finishQuestions(ctx, answers);
  const next = missing[0]!;
  await send(ctx, questionMessage(ctx.script, next, index, total, varsOf(ctx, answers), prefix));
  await saveState(ctx, { automationStatus: "active", currentState: `awaiting_${next}`, awaitingField: next, invalidCount: 0 }, {
    cadenceStatus: "running",
  });
  return true;
}

async function askBestTime(ctx: Ctx, answers: QualifyAnswers, patch: Partial<ConversationQualifyState>, priority?: Priority) {
  await send(ctx, bestTimeMessage(ctx.script, varsOf(ctx, answers)));
  await saveState(ctx, { ...patch, currentState: "awaiting_best_time", awaitingField: "best_contact_time" }, {
    cadenceStatus: "running",
    ...(priority ? { forcePriority: priority } : {}),
  });
  return true;
}

async function finishQuestions(ctx: Ctx, answers: QualifyAnswers) {
  const priority = classifier(ctx)(answers);
  const qualifiedAt = new Date().toISOString();
  if (priority === "C") {
    await send(ctx, nurtureMessage(ctx.script, varsOf(ctx, answers)));
    await saveState(ctx, { currentState: "nurture", awaitingField: null, qualifiedAt }, {
      cadenceStatus: "done",
      forcePriority: "C",
    });
    await moveLeadToPriorityStage({ workspaceId: ctx.workspaceId, leadId: ctx.leadId, priority: "C" });
    await notifyNurture({ workspaceId: ctx.workspaceId, leadId: ctx.leadId, contactName: ctx.contactName });
    return true;
  }
  if (ctx.script.bestTime.enabled && !answers.best_contact_time?.code) {
    await askBestTime(ctx, answers, { qualifiedAt, handoffReason: "qualified" }, priority);
    await moveLeadToPriorityStage({ workspaceId: ctx.workspaceId, leadId: ctx.leadId, priority });
    return true;
  }
  ctx.state = { ...ctx.state, qualifiedAt };
  return handoff(ctx, answers, priority, "qualified");
}

/** Pedido de conversa: pergunta o horário (1 toque) se faltar, depois passa para a equipe. */
async function requestMeeting(ctx: Ctx, answers: QualifyAnswers, priority: Priority | null, reason: HandoffReason) {
  if (ctx.script.bestTime.enabled && !answers.best_contact_time?.code) {
    return askBestTime(ctx, answers, { handoffReason: reason });
  }
  return handoff(ctx, answers, priority, reason);
}

async function handoff(ctx: Ctx, answers: QualifyAnswers, priority: Priority | null, reason: HandoffReason) {
  // A equipe assume mesmo se a última mensagem ao lead falhar.
  await send(ctx, handoffMessage(ctx.script, varsOf(ctx, answers))).catch((err) =>
    console.warn("[qualification] handoff copy", err instanceof Error ? err.message : err),
  );
  await handoffConversation(ctx.conversationId, ctx.workspaceId);
  await saveState(ctx, { automationStatus: "done", currentState: "meeting_requested", awaitingField: null, handoffAt: new Date().toISOString(), handoffReason: reason }, {
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

  const [lead, contact] = await Promise.all([
    prisma.nativeLead.findFirst({ where: { id: input.leadId, clienteId: input.workspaceId }, select: { metadata: true } }),
    prisma.nativeContact.findFirst({ where: { id: input.contactId, clienteId: input.workspaceId } }),
  ]);
  if (!lead || !contact) return { started: false as const, reason: "no_lead" };

  const q = parseLeadQualification(lead.metadata);
  const missing = missingFieldKeys(q.answers, prefs.askKeys);

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

  const ctx = await ctxFor(prefs, {
    workspaceId: input.workspaceId,
    conversationId: conversation.id,
    leadId: input.leadId,
    phone: input.phone,
    contactId: input.contactId,
    contactName: input.contactName ?? contact.name,
    state: existing ?? {
      playbookId: prefs.playbookId,
      automationStatus: "active",
      currentState: "awaiting_start_choice",
      awaitingField: null,
      startedAt: new Date().toISOString(),
      followUpCount: 0,
    },
  });

  const windowOpen = isWithinCustomerWindow(conversation.windowExpiresAt);
  if (windowOpen && !missing.length) {
    // O cadastro já trouxe tudo: classifica e segue sem pedir "Começar".
    ctx.state = { ...ctx.state, openedAt: new Date().toISOString(), totalQuestions: 0 };
    await finishQuestions(ctx, q.answers);
    return { started: true, conversationId: conversation.id, complete: true };
  }

  let opened = false;
  if (windowOpen) {
    const open = openingMessage(ctx.script, varsOf(ctx, q.answers), missing.length);
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
        body: "A mensagem de abertura ainda não foi aprovada pela Meta.",
        href: "/atendimento/mensagens",
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
    { cadenceStatus: "running" },
  );
  return { started: opened, conversationId: conversation.id, complete: false };
}

function choiceOptions(script: QualifyScript, field: QualifyFieldKey) {
  if (field === "best_contact_time") return CHOICE_MAP.best_contact_time ?? [];
  return questionOf(script, field)?.options ?? [];
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

  const ctx = await ctxFor(prefs, {
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    leadId: input.leadId,
    phone: input.phone,
    contactId: input.contactId,
    contactName: conversation.contactName,
    state,
  });
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
    if (!choice && !text) return true;
    const updated = await writeAnswers(ctx, {
      best_contact_time: choice ? answerFromChoice(choice, "whatsapp") : answerFromRaw("best_contact_time", text, "whatsapp"),
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
      await send(ctx, presentationCopy(ctx.brand));
      await saveState(ctx, { presentationSentAt: new Date().toISOString() });
      return true;
    }
    const missing = missingFieldKeys(answers, ctx.askKeys);
    if (!missing.length) return finishQuestions(ctx, answers);
    ctx.state = { ...ctx.state, totalQuestions: missing.length };
    return askNext(ctx, answers, replyId !== QUALIFY_REPLY.start && !START_RE.test(text) ? START_ANYWAY : undefined);
  }

  const field = state.awaitingField;
  if (!field) return true;

  let patch: Parameters<typeof writeLeadAnswers>[0]["patch"] | null = null;
  if (field === "city") {
    const city = text.replace(/^\[|\]$/g, "").trim();
    if (city.length >= 2) patch = { city: answerFromRaw("city", city, "whatsapp") };
  } else {
    const choice = matchChoice(field, replyId || text, choiceOptions(ctx.script, field));
    if (choice) patch = { [field]: answerFromChoice(choice, "whatsapp") };
  }

  if (!patch) {
    const misses = (state.invalidCount ?? 0) + 1;
    if (misses >= 2 && text) return handoff(ctx, answers, priority, "free_text");
    if (field === "city") {
      await send(ctx, invalidChoiceCopy(field));
    } else {
      const { total, index } = progressOf(ctx, answers);
      await send(ctx, questionMessage(ctx.script, field, index, total, varsOf(ctx, answers), invalidChoiceCopy(field)));
    }
    await saveState(ctx, { invalidCount: misses });
    return true;
  }

  const updated = await writeAnswers(ctx, patch);
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
  /** Toque da cadência que dispara a retomada. */
  touch?: "reask" | "nudge";
}) {
  const prefs = await loadQualificationPrefs(input.workspaceId);
  if (!prefs.enabled) return false;
  if (!followUpOf(prefs.script, input.touch ?? "reask").enabled) return false;
  const reask = followUpOf(prefs.script, "reask");
  const conversation = await prisma.waConversation.findFirst({
    where: { id: input.conversationId, clienteId: input.workspaceId },
    select: { status: true, qualification: true, windowExpiresAt: true },
  });
  if (!conversation || conversation.status === "HANDED_OFF") return false;
  if (!isWithinCustomerWindow(conversation.windowExpiresAt)) return false;
  const state = parseConversationQualify(conversation.qualification);
  if (!state || state.automationStatus !== "active") return false;
  if ((state.followUpCount ?? 0) >= 2) return false;

  const ctx = await ctxFor(prefs, {
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    leadId: input.leadId,
    phone: input.phone,
    contactId: input.contactId,
    contactName: input.contactName ?? null,
    state,
  });
  const loaded = await loadAnswers(ctx);
  if (!loaded) return false;
  const followUpCount = (state.followUpCount ?? 0) + 1;
  const vars = varsOf(ctx, loaded.answers);

  if (state.currentState === "awaiting_best_time") {
    const msg = bestTimeMessage(ctx.script, vars);
    await send(ctx, { ...msg, body: `${renderText(reask.text, vars)} ${msg.body}` });
    await saveState(ctx, { followUpCount });
    return true;
  }
  const { missing, total, index } = progressOf(ctx, loaded.answers);
  if (!missing.length) return false;
  if (state.currentState === "awaiting_start_choice") {
    await send(ctx, openingMessage(ctx.script, vars, missing.length));
    await saveState(ctx, { followUpCount });
    return true;
  }
  const next = missing[0]!;
  await send(ctx, questionMessage(ctx.script, next, index, total, vars, reask.text));
  await saveState(ctx, { awaitingField: next, currentState: `awaiting_${next}`, followUpCount });
  return true;
}
