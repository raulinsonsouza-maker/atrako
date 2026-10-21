/**
 * Jornada do lead no WhatsApp: etapa atual e ficha para a equipe.
 * Puro — usado pelo motor, pela API e pela tela de Mensagens.
 */

import { FIELD_DEFS, type QualifyAnswers, type QualifyFieldKey } from "./fields";
import type { Priority } from "./classify";

export type JourneyStageKey = "entrada" | "abertura" | "perguntas" | "horario" | "equipe" | "nutricao";

/** Etapa atual do lead a partir de `metadata.qualification.currentState`. */
export function journeyStageOf(currentState: string | null | undefined): JourneyStageKey | null {
  const s = currentState ?? "";
  if (!s || s === "pending") return null;
  if (s === "captured") return "entrada";
  if (s === "awaiting_start_choice" || s === "awaiting_post_form_engagement") return "abertura";
  if (s === "awaiting_best_time") return "horario";
  if (s === "meeting_requested" || s === "human_handoff") return "equipe";
  if (s === "nurture") return "nutricao";
  if (s.startsWith("awaiting_")) return "perguntas";
  return null;
}

export const PRIORITY_LABEL: Record<Priority, string> = { A: "A · quente", B: "B · interessado", C: "C · nutrição" };

export const HANDOFF_REASON_LABEL = {
  qualified: "Concluiu a qualificação",
  asked_consultant: "Pediu para falar com um consultor",
  asked_human: "Pediu atendimento humano",
  free_text: "Escreveu fora do roteiro",
  nurture_reply: "Respondeu na nutrição",
} as const;

export type HandoffReason = keyof typeof HANDOFF_REASON_LABEL;

/** Ficha que o consultor lê antes de responder (vira nota no lead). */
export function leadBrief(input: {
  answers: QualifyAnswers;
  priority: Priority | null;
  reason: HandoffReason;
}): string {
  const a = input.answers;
  const place = [a.city?.label, a.state?.label].filter(Boolean).join("/");
  const lines = [
    `Ficha do WhatsApp · ${HANDOFF_REASON_LABEL[input.reason]}`,
    input.priority ? `Prioridade: ${PRIORITY_LABEL[input.priority]}` : null,
    place ? `Local: ${place}` : null,
  ];
  const order: QualifyFieldKey[] = [
    "niche",
    "business_objective",
    "start_timeline",
    "investment_status",
    "main_question",
    "best_contact_time",
  ];
  for (const key of order) {
    const label = a[key]?.label;
    if (!label) continue;
    const def = FIELD_DEFS.find((d) => d.key === key);
    lines.push(`${def?.crmLabel ?? key}: ${label}`);
  }
  return lines.filter(Boolean).join("\n");
}
