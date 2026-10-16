/**
 * Motor de qualificação WhatsApp — pergunta só fieldKeys faltantes.
 */

import { prisma } from "@/lib/db";
import {
  sendAndPersistText,
  sendAndPersistReplyButtons,
  sendAndPersistList,
  handoffConversation,
} from "@/lib/whatsapp/domain";
import { missingFieldKeys, type QualifyFieldKey, WA_ASK_ORDER } from "./fields";
import { loadQualificationPrefs } from "./playbook";
import {
  answerFromRaw,
  parseConversationQualify,
  parseLeadQualification,
  saveConversationQualify,
  writeLeadAnswers,
  type ConversationQualifyState,
} from "./store";
import { doneCopy, fieldPrompt, followUpCopy, openCopy, presentationCopy } from "./messages";
import { applyPriorityRouting } from "./routing";
import { classifyLead, snapshotFromAnswers } from "./classify";

const HUMAN_RE =
  /(quero|preciso|pode|chama).{0,30}(atendente|pessoa|humano)|falar com (algu[eé]m|uma pessoa|atendente)|atendente humano/i;

async function sendFieldPrompt(input: {
  workspaceId: string;
  phone: string;
  contactId: string;
  contactName?: string | null;
  field: QualifyFieldKey;
  asFollowUp?: boolean;
}) {
  const prompt = fieldPrompt(input.field);
  const body = input.asFollowUp ? followUpCopy(input.field) : prompt.body;
  if (prompt.buttons?.length) {
    await sendAndPersistReplyButtons({
      workspaceId: input.workspaceId,
      to: input.phone,
      body,
      buttons: prompt.buttons,
      contactId: input.contactId,
      contactName: input.contactName,
    });
    return;
  }
  if (prompt.list?.rows.length) {
    await sendAndPersistList({
      workspaceId: input.workspaceId,
      to: input.phone,
      body,
      buttonText: prompt.list.buttonText,
      rows: prompt.list.rows,
      contactId: input.contactId,
      contactName: input.contactName,
    });
    return;
  }
  await sendAndPersistText({
    workspaceId: input.workspaceId,
    to: input.phone,
    body,
    contactId: input.contactId,
    contactName: input.contactName,
  });
}

export async function startQualificationFlow(input: {
  workspaceId: string;
  leadId: string;
  contactId: string;
  phone: string;
  contactName?: string | null;
}) {
  const prefs = await loadQualificationPrefs(input.workspaceId);
  if (!prefs.enabled) return { started: false as const, reason: "disabled" };

  const lead = await prisma.nativeLead.findFirst({
    where: { id: input.leadId, clienteId: input.workspaceId },
    select: { metadata: true },
  });
  if (!lead) return { started: false as const, reason: "no_lead" };

  const q = parseLeadQualification(lead.metadata);
  const missing = missingFieldKeys(q.answers, prefs.askKeys.length ? prefs.askKeys : WA_ASK_ORDER);
  const city = q.answers.city?.value ?? null;

  const { upsertWaConversation } = await import("@/lib/whatsapp/domain");
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

  if (missing.length === 0) {
    const priority = classifyLead(snapshotFromAnswers(q.answers));
    await writeLeadAnswers({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      playbookId: prefs.playbookId,
      patch: {},
      currentState: "qualified",
      cadenceStatus: priority === "C" ? "running" : "done",
      forcePriority: priority,
    });
    await saveConversationQualify(conversation.id, input.workspaceId, {
      playbookId: prefs.playbookId,
      automationStatus: priority === "C" ? "active" : "done",
      currentState: "qualified",
      awaitingField: null,
      startedAt: new Date().toISOString(),
      qualifiedAt: new Date().toISOString(),
    });
    const open = openCopy(input.contactName, city, 0);
    await sendAndPersistText({
      workspaceId: input.workspaceId,
      to: input.phone,
      body: open.body,
      contactId: input.contactId,
      contactName: input.contactName,
    });
    await applyPriorityRouting({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      conversationId: conversation.id,
      priority,
      contactName: input.contactName,
    });
    return { started: true as const, conversationId: conversation.id, complete: true };
  }

  const open = openCopy(input.contactName, city, missing.length);
  await sendAndPersistReplyButtons({
    workspaceId: input.workspaceId,
    to: input.phone,
    body: open.body,
    buttons: open.buttons,
    contactId: input.contactId,
    contactName: input.contactName,
  });

  await saveConversationQualify(conversation.id, input.workspaceId, {
    playbookId: prefs.playbookId,
    automationStatus: "active",
    currentState: "awaiting_start_choice",
    awaitingField: null,
    startedAt: new Date().toISOString(),
    followUpCount: 0,
  });
  await writeLeadAnswers({
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    playbookId: prefs.playbookId,
    patch: {},
    currentState: "awaiting_start_choice",
    cadenceStatus: "running",
  });

  return { started: true as const, conversationId: conversation.id, complete: false };
}

async function askNext(input: {
  workspaceId: string;
  conversationId: string;
  leadId: string;
  phone: string;
  contactId: string;
  contactName?: string | null;
  playbookId: string;
  answers: ReturnType<typeof parseLeadQualification>["answers"];
  askKeys: QualifyFieldKey[];
  state: ConversationQualifyState;
}) {
  const missing = missingFieldKeys(input.answers, input.askKeys);
  if (!missing.length) {
    const priority = classifyLead(snapshotFromAnswers(input.answers));
    await sendAndPersistText({
      workspaceId: input.workspaceId,
      to: input.phone,
      body: doneCopy(input.contactName),
      contactId: input.contactId,
      contactName: input.contactName,
    });
    await writeLeadAnswers({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      playbookId: input.playbookId,
      patch: {},
      currentState: "qualified",
      cadenceStatus: priority === "C" ? "running" : "done",
      forcePriority: priority,
    });
    await saveConversationQualify(input.conversationId, input.workspaceId, {
      ...input.state,
      automationStatus: priority === "C" ? "active" : "done",
      currentState: "qualified",
      awaitingField: null,
      qualifiedAt: new Date().toISOString(),
    });
    await applyPriorityRouting({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      conversationId: input.conversationId,
      priority,
      contactName: input.contactName,
    });
    return { handled: true as const, done: true };
  }

  const next = missing[0]!;
  await sendFieldPrompt({
    workspaceId: input.workspaceId,
    phone: input.phone,
    contactId: input.contactId,
    contactName: input.contactName,
    field: next,
  });
  await saveConversationQualify(input.conversationId, input.workspaceId, {
    ...input.state,
    automationStatus: "active",
    currentState: `awaiting_${next}`,
    awaitingField: next,
  });
  await writeLeadAnswers({
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    playbookId: input.playbookId,
    patch: {},
    currentState: `awaiting_${next}`,
    cadenceStatus: "running",
  });
  return { handled: true as const, done: false };
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

  const text = (input.body ?? "").trim();
  const replyId = (input.replyId || "").trim();

  if (HUMAN_RE.test(text)) {
    await handoffConversation(input.conversationId, input.workspaceId);
    await saveConversationQualify(input.conversationId, input.workspaceId, {
      ...state,
      automationStatus: "paused",
      currentState: "human_handoff",
      awaitingField: null,
    });
    await sendAndPersistText({
      workspaceId: input.workspaceId,
      to: input.phone,
      body: "Vou chamar alguém da equipe para continuar com você.",
      contactId: input.contactId,
      contactName: conversation.contactName,
    });
    return true;
  }

  const lead = await prisma.nativeLead.findFirst({
    where: { id: input.leadId, clienteId: input.workspaceId },
    select: { metadata: true },
  });
  if (!lead) return false;
  let q = parseLeadQualification(lead.metadata);
  const askKeys = prefs.askKeys.length ? prefs.askKeys : WA_ASK_ORDER;
  const contactName = conversation.contactName;

  if (state.currentState === "awaiting_start_choice" || replyId === "START_QUALIFICATION" || replyId === "SHOW_PRESENTATION") {
    if (replyId === "SHOW_PRESENTATION" || /apresenta/i.test(text)) {
      const p = presentationCopy();
      await sendAndPersistReplyButtons({
        workspaceId: input.workspaceId,
        to: input.phone,
        body: p.body,
        buttons: p.buttons,
        contactId: input.contactId,
        contactName,
      });
      await saveConversationQualify(input.conversationId, input.workspaceId, {
        ...state,
        currentState: "awaiting_start_choice",
        presentationSentAt: new Date().toISOString(),
        awaitingField: null,
      });
      return true;
    }
    if (replyId === "START_QUALIFICATION" || /come[cç]ar|sim|ok|bora/i.test(text)) {
      return (await askNext({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        leadId: input.leadId,
        phone: input.phone,
        contactId: input.contactId,
        contactName,
        playbookId: prefs.playbookId,
        answers: q.answers,
        askKeys,
        state,
      })).handled;
    }
    return true;
  }

  const field = state.awaitingField;
  if (!field) return true;

  if (field === "city") {
    const city = text.replace(/^\[|\]$/g, "").trim();
    if (!city || city.length < 2) {
      await sendAndPersistText({
        workspaceId: input.workspaceId,
        to: input.phone,
        body: "Pode me dizer a cidade? Ex.: Curitiba.",
        contactId: input.contactId,
        contactName,
      });
      return true;
    }
    const updated = await writeLeadAnswers({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      playbookId: prefs.playbookId,
      patch: { city: answerFromRaw("city", city, "whatsapp") },
    });
    q = { ...q, answers: updated?.answers ?? q.answers };
  } else {
    const raw = replyId || text;
    if (!raw) return true;
    const updated = await writeLeadAnswers({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      playbookId: prefs.playbookId,
      patch: { [field]: answerFromRaw(field, raw, "whatsapp") },
    });
    q = { ...q, answers: updated?.answers ?? q.answers };
  }

  return (await askNext({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    leadId: input.leadId,
    phone: input.phone,
    contactId: input.contactId,
    contactName,
    playbookId: prefs.playbookId,
    answers: q.answers,
    askKeys,
    state,
  })).handled;
}

/** Retomada conservadora da próxima pergunta missing. */
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
    select: { status: true, qualification: true },
  });
  if (!conversation || conversation.status === "HANDED_OFF") return false;
  const state = parseConversationQualify(conversation.qualification);
  if (!state || state.automationStatus !== "active") return false;
  if ((state.followUpCount ?? 0) >= 2) return false;

  const lead = await prisma.nativeLead.findFirst({
    where: { id: input.leadId, clienteId: input.workspaceId },
    select: { metadata: true },
  });
  if (!lead) return false;
  const q = parseLeadQualification(lead.metadata);
  const missing = missingFieldKeys(q.answers, prefs.askKeys.length ? prefs.askKeys : WA_ASK_ORDER);
  if (!missing.length) return false;

  const next = missing[0]!;
  await sendFieldPrompt({
    workspaceId: input.workspaceId,
    phone: input.phone,
    contactId: input.contactId,
    contactName: input.contactName,
    field: next,
    asFollowUp: true,
  });
  await saveConversationQualify(input.conversationId, input.workspaceId, {
    ...state,
    awaitingField: next,
    currentState: `awaiting_${next}`,
    followUpCount: (state.followUpCount ?? 0) + 1,
  });
  return true;
}
