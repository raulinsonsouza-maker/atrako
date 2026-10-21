/**
 * Jornada do lead no WhatsApp (franchise_regicenter): etapas, conversa de exemplo e ficha para a equipe.
 * Puro — usado pelo motor, pela API e pela tela de Mensagens.
 */

import { FIELD_DEFS, type QualifyAnswers, type QualifyFieldKey } from "./fields";
import type { Priority } from "./classify";
import {
  QUALIFY_REPLY,
  bestTimeCopy,
  handoffCopy,
  numberedPrompt,
  nurtureCopy,
  openCopy,
} from "./messages";

export type JourneyStageKey = "entrada" | "abertura" | "perguntas" | "horario" | "equipe" | "nutricao";

export type JourneyStage = {
  key: JourneyStageKey;
  title: string;
  /** Quando acontece, em poucas palavras. */
  when: string;
  channel: "form" | "whatsapp" | "email" | "team";
};

export const JOURNEY_STAGES: JourneyStage[] = [
  { key: "entrada", title: "Cadastro", when: "Formulário da LP", channel: "form" },
  { key: "abertura", title: "Primeiro contato", when: "Na hora", channel: "whatsapp" },
  { key: "perguntas", title: "Qualificação", when: "≈ 1 minuto", channel: "whatsapp" },
  { key: "horario", title: "Horário", when: "Se não veio no cadastro", channel: "whatsapp" },
  { key: "equipe", title: "Equipe assume", when: "Com a ficha pronta", channel: "team" },
];

export const NURTURE_STAGE: JourneyStage = {
  key: "nutricao",
  title: "Nutrição",
  when: "Em avaliação ou sem resposta",
  channel: "email",
};

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

/** Recados de cadência para quem para de responder (o e-mail da nutrição segue à parte). */
export const NO_REPLY_STEPS = [
  { after: "2 h", what: "Repete a pergunta pendente", channel: "whatsapp" as const },
  { after: "1 dia", what: "Lembrete com botão para continuar", channel: "whatsapp" as const },
  { after: "3 dias", what: "Avisa a equipe para um toque manual", channel: "team" as const },
];

const PRIORITY_LABEL: Record<Priority, string> = { A: "A · quente", B: "B · interessado", C: "C · nutrição" };

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

export type JourneyChatItem =
  | { kind: "system"; id: string; stage: JourneyStageKey; text: string }
  | { kind: "received"; id: string; stage: JourneyStageKey; text: string; buttons: string[]; list?: string; template?: boolean }
  | { kind: "sent"; id: string; stage: JourneyStageKey; text: string };

const EXAMPLE_ANSWER: Partial<Record<QualifyFieldKey, string>> = {
  city: "Curitiba",
  niche: "Advocacia",
  business_objective: "Operar a unidade",
  start_timeline: "Em até 30 dias",
  main_question: "Condições da franquia",
  investment_status: "Tenho o valor",
};

/** Conversa de exemplo de um lead quente, do cadastro até a equipe. */
export function journeyConversation(input: { brand: string; askKeys: QualifyFieldKey[]; lpKeys: QualifyFieldKey[] }) {
  const questions = input.askKeys.filter((k) => !input.lpKeys.includes(k));
  const name = "Maria Souza";
  const items: JourneyChatItem[] = [
    { kind: "system", id: "entrada", stage: "entrada", text: "Maria preencheu o formulário da LP" },
  ];
  const open = openCopy({ name, brand: input.brand, city: "Curitiba", questions: questions.length });
  items.push({
    kind: "received",
    id: "abertura",
    stage: "abertura",
    text: open.body,
    buttons: open.buttons.map((b) => b.title),
    template: true,
  });
  items.push({ kind: "sent", id: "abertura-r", stage: "abertura", text: "Começar" });
  questions.forEach((field, i) => {
    const p = numberedPrompt(field, i + 1, questions.length);
    items.push({
      kind: "received",
      id: `q-${field}`,
      stage: "perguntas",
      text: p.body,
      buttons: p.buttons?.map((b) => b.title) ?? [],
      list: p.list?.buttonText,
    });
    items.push({ kind: "sent", id: `q-${field}-r`, stage: "perguntas", text: EXAMPLE_ANSWER[field] ?? "…" });
  });
  items.push({ kind: "system", id: "classificado", stage: "horario", text: "Classificada como A · quente" });
  const time = bestTimeCopy(name, true);
  items.push({ kind: "received", id: "horario", stage: "horario", text: time.body, buttons: time.buttons.map((b) => b.title) });
  items.push({ kind: "sent", id: "horario-r", stage: "horario", text: "Manhã" });
  items.push({ kind: "received", id: "equipe", stage: "equipe", text: handoffCopy(name, "MORNING"), buttons: [] });
  items.push({ kind: "system", id: "equipe-s", stage: "equipe", text: "Consultor assume a conversa com a ficha" });
  return items;
}

/** Desvio de quem ainda está avaliando (C). */
export function nurtureConversation(): JourneyChatItem[] {
  const n = nurtureCopy("Maria Souza");
  return [
    { kind: "system", id: "nutricao-s", stage: "nutricao", text: "Classificada como C · em avaliação" },
    { kind: "received", id: "nutricao", stage: "nutricao", text: n.body, buttons: n.buttons.map((b) => b.title) },
    { kind: "system", id: "nutricao-e", stage: "nutricao", text: "Segue recebendo os e-mails da nutrição" },
  ];
}

export const MEETING_REPLY = QUALIFY_REPLY.meeting;
