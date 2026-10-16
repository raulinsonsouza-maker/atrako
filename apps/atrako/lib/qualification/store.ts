/**
 * Persistência de answers no NativeLead.metadata.qualification + WaConversation.qualification.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import {
  type QualifyAnswer,
  type QualifyAnswers,
  type QualifyFieldKey,
  mergeAnswer,
  missingFieldKeys,
  filledPercent,
  WA_ASK_ORDER,
} from "./fields";
import { resolveChoice } from "./choices";
import {
  classifyLead,
  mapInvestmentCode,
  mapObjectiveCode,
  mapTimelineCode,
  type Priority,
} from "./classify";

export type ConversationQualifyState = {
  playbookId: string;
  automationStatus: "active" | "paused" | "done";
  currentState: string;
  awaitingField: QualifyFieldKey | null;
  startedAt?: string;
  qualifiedAt?: string | null;
  presentationSentAt?: string | null;
  followUpCount?: number;
  city_missing?: boolean;
};

export type LeadQualification = {
  playbookId: string;
  answers: QualifyAnswers;
  priority: Priority | null;
  currentState: string;
  missing: QualifyFieldKey[];
  cadenceStatus: "idle" | "running" | "paused" | "done";
  filledPercent: number;
};

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function parseLeadQualification(metadata: unknown): LeadQualification {
  const meta = asRecord(metadata);
  const q = asRecord(meta.qualification);
  const answers = (q.answers && typeof q.answers === "object" ? q.answers : {}) as QualifyAnswers;
  const missing = missingFieldKeys(answers);
  return {
    playbookId: typeof q.playbookId === "string" ? q.playbookId : "franchise_regicenter",
    answers,
    priority: q.priority === "A" || q.priority === "B" || q.priority === "C" ? q.priority : null,
    currentState: typeof q.currentState === "string" ? q.currentState : "pending",
    missing,
    cadenceStatus:
      q.cadenceStatus === "running" || q.cadenceStatus === "paused" || q.cadenceStatus === "done"
        ? q.cadenceStatus
        : "idle",
    filledPercent: filledPercent(answers),
  };
}

export function parseConversationQualify(raw: unknown): ConversationQualifyState | null {
  const q = asRecord(raw);
  if (!q.playbookId || typeof q.playbookId !== "string") return null;
  return {
    playbookId: q.playbookId,
    automationStatus:
      q.automationStatus === "paused" || q.automationStatus === "done" ? q.automationStatus : "active",
    currentState: typeof q.currentState === "string" ? q.currentState : "pending_initial_contact",
    awaitingField: typeof q.awaitingField === "string" ? (q.awaitingField as QualifyFieldKey) : null,
    startedAt: typeof q.startedAt === "string" ? q.startedAt : undefined,
    qualifiedAt: typeof q.qualifiedAt === "string" ? q.qualifiedAt : null,
    presentationSentAt: typeof q.presentationSentAt === "string" ? q.presentationSentAt : null,
    followUpCount: typeof q.followUpCount === "number" ? q.followUpCount : 0,
    city_missing: q.city_missing === true,
  };
}

export function snapshotFromAnswers(answers: QualifyAnswers) {
  return {
    investmentStatus: mapInvestmentCode(answers.investment_status?.code || answers.investment_status?.value),
    timeline: mapTimelineCode(answers.start_timeline?.code || answers.start_timeline?.value),
    objective: mapObjectiveCode(answers.business_objective?.code || answers.business_objective?.value),
    nicheCode: answers.niche?.code || null,
    city: answers.city?.value || null,
  };
}

export async function writeLeadAnswers(input: {
  workspaceId: string;
  leadId: string;
  playbookId: string;
  patch: Partial<Record<QualifyFieldKey, QualifyAnswer>>;
  currentState?: string;
  cadenceStatus?: LeadQualification["cadenceStatus"];
  forcePriority?: Priority | null;
}) {
  const lead = await prisma.nativeLead.findFirst({
    where: { id: input.leadId, clienteId: input.workspaceId },
    select: { id: true, metadata: true },
  });
  if (!lead) return null;
  const current = parseLeadQualification(lead.metadata);
  let answers = { ...current.answers };
  for (const [key, ans] of Object.entries(input.patch) as Array<[QualifyFieldKey, QualifyAnswer]>) {
    if (!ans) continue;
    answers = mergeAnswer(answers, key, ans);
  }
  const missing = missingFieldKeys(answers, WA_ASK_ORDER);
  const priority =
    input.forcePriority !== undefined
      ? input.forcePriority
      : missing.length === 0
        ? classifyLead(snapshotFromAnswers(answers))
        : current.priority;
  const qualification = {
    playbookId: input.playbookId,
    answers,
    priority,
    currentState: input.currentState ?? current.currentState,
    missing,
    cadenceStatus: input.cadenceStatus ?? current.cadenceStatus,
    filledPercent: filledPercent(answers),
  };
  const meta = asRecord(lead.metadata);
  await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      metadata: { ...meta, qualification } as Prisma.InputJsonValue,
    },
  });
  return qualification;
}

export function answerFromRaw(
  key: QualifyFieldKey,
  raw: string,
  source: QualifyAnswer["source"],
): QualifyAnswer {
  const choiceKeys: QualifyFieldKey[] = [
    "niche",
    "start_timeline",
    "business_objective",
    "main_question",
    "investment_status",
    "best_contact_time",
  ];
  if (choiceKeys.includes(key)) {
    const { code, label } = resolveChoice(key, raw);
    return { value: label, label, code, source, at: new Date().toISOString() };
  }
  const value = raw.trim();
  return { value, label: value, source, at: new Date().toISOString() };
}

export async function saveConversationQualify(
  conversationId: string,
  workspaceId: string,
  state: ConversationQualifyState,
) {
  await prisma.waConversation.updateMany({
    where: { id: conversationId, clienteId: workspaceId },
    data: { qualification: state as unknown as Prisma.InputJsonValue },
  });
}
