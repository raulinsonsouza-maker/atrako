/**
 * Rótulos humanos para o card CRM (sem jargão técnico).
 */

import type { QualifyFieldKey } from "./fields";
import type { Priority } from "./classify";

/** Origem curta para funil / stats — nunca slug técnico. */
export function franchiseSourceLabel(source: string): string | null {
  const s = source.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("franquia-regicenter-qualify") || (s.startsWith("franquia:") && s.includes("qualify"))) {
    return "Qualificação";
  }
  if (s.includes("franquia-regicenter-lp") || (s.startsWith("franquia:") && s.includes("-lp"))) {
    return "Landing page";
  }
  if (s.startsWith("franquia:") || s === "franquia") return "Franquia";
  return null;
}

/** Origem para o modal: formName humano ou fallback curto. */
export function crmOriginDisplay(input: {
  source?: string | null;
  formName?: string | null;
  campaignName?: string | null;
  sourceLabel?: string | null;
}): string {
  const fromSource = input.source ? franchiseSourceLabel(input.source) : null;
  if (fromSource) return fromSource;
  const form = (input.formName || "").trim();
  if (form) {
    // "Franquia Regicenter — Qualificação" → "Qualificação"
    const dash = form.split(/[—–-]/).map((p) => p.trim()).filter(Boolean);
    if (dash.length > 1) return dash[dash.length - 1]!;
    return form;
  }
  return (input.campaignName || input.sourceLabel || "—").trim() || "—";
}

export function priorityHumanLabel(priority: Priority | null | undefined): string | null {
  if (priority === "A") return "Quente";
  if (priority === "B") return "Interessado";
  if (priority === "C") return "Nutrição";
  return null;
}

/** Campos que já aparecem no cabeçalho do lead — não repetir no bloco. */
export const CRM_HIDE_ANSWER_KEYS: QualifyFieldKey[] = ["name", "email", "phone", "wa_opt_in"];

/** Ordem de exibição no card. */
export const CRM_ANSWER_ORDER: QualifyFieldKey[] = [
  "city",
  "niche",
  "start_timeline",
  "business_objective",
  "main_question",
  "investment_status",
  "best_contact_time",
];

export function nextActionHuman(input: {
  priority: Priority | null;
  currentState: string;
  cadenceStatus: string;
  missingCount: number;
}): string {
  const state = input.currentState || "";
  if (state === "meeting_requested" || state === "human_handoff") {
    return "Agendar conversa com o lead";
  }
  if (state === "awaiting_post_form_engagement" || state === "awaiting_start_choice") {
    return "Aguardando resposta no WhatsApp";
  }
  if (state.startsWith("awaiting_")) {
    return "Em conversa no WhatsApp";
  }
  if (input.missingCount > 0) {
    return "Completar perguntas no WhatsApp";
  }
  if (input.cadenceStatus === "running") {
    return "Na cadência — aguardando engajamento";
  }
  if (state === "qualified") {
    return "Acompanhar no WhatsApp";
  }
  if (input.priority === "A" || input.priority === "B") {
    return "Acompanhar no WhatsApp";
  }
  if (input.priority === "C") {
    return "Nutrição — manter contato leve";
  }
  return "Acompanhar no WhatsApp";
}
