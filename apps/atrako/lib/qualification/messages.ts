/**
 * Copy curta WhatsApp — franchise_regicenter.
 */

import type { QualifyFieldKey } from "./fields";
import { CHOICE_MAP, REGICENTER_FRANCHISE_INVESTMENT } from "./choices";
import type { ReplyButton, ListRow } from "@/lib/integrations/whatsapp/messages";

export function openCopy(name: string | null | undefined, city: string | null | undefined, missingCount: number) {
  const first = (name || "").trim().split(/\s+/)[0] || "olá";
  const cityBit = city?.trim() ? ` de ${city.trim()}` : "";
  if (missingCount <= 0) {
    return postFormOpenCopy(name, city);
  }
  return {
    body: `Oi, ${first}. Vi seu cadastro${cityBit}. Faltam só ${missingCount} pergunta${missingCount > 1 ? "s" : ""} rápida${missingCount > 1 ? "s" : ""} para te direcionar.`,
    buttons: [
      { id: "START_QUALIFICATION", title: "Começar agora" },
      { id: "SHOW_PRESENTATION", title: "Ver apresentação" },
    ] as ReplyButton[],
  };
}

/** Após form completo: abre conversa, não fecha o funil. */
export function postFormOpenCopy(name: string | null | undefined, city: string | null | undefined) {
  const first = (name || "").trim().split(/\s+/)[0] || "olá";
  const cityBit = city?.trim() ? ` de ${city.trim()}` : "";
  return {
    body: `Oi, ${first}. Recebi seu cadastro${cityBit}. Quer ver um resumo da franquia ou já prefere conversar com a equipe?`,
    buttons: [
      { id: "SHOW_PRESENTATION", title: "Ver apresentação" },
      { id: "WANT_MEETING", title: "Quero conversar" },
    ] as ReplyButton[],
  };
}

export function presentationCopy() {
  return {
    body: "A Regicenter é uma franquia de registro de marcas e patentes, com operação e suporte jurídico pela matriz. Quer seguir com as perguntas rápidas?",
    buttons: [{ id: "START_QUALIFICATION", title: "Quero responder" }] as ReplyButton[],
  };
}

export function postFormPresentationCopy() {
  return {
    body: `A Regicenter registra marcas e patentes com suporte da matriz. Investimento inicial ${REGICENTER_FRANCHISE_INVESTMENT}. Quer marcar uma conversa com a equipe?`,
    buttons: [
      { id: "WANT_MEETING", title: "Quero conversar" },
      { id: "LATER_OK", title: "Depois" },
    ] as ReplyButton[],
  };
}

export function postFormFollowUpCopy(name: string | null | undefined) {
  const first = (name || "").trim().split(/\s+/)[0] || "olá";
  return {
    body: `${first}, ainda estou por aqui. Quer ver a apresentação da franquia ou conversar com a equipe?`,
    buttons: [
      { id: "SHOW_PRESENTATION", title: "Ver apresentação" },
      { id: "WANT_MEETING", title: "Quero conversar" },
    ] as ReplyButton[],
  };
}

export function fieldPrompt(field: QualifyFieldKey): {
  body: string;
  buttons?: ReplyButton[];
  list?: { buttonText: string; rows: ListRow[] };
  freeText?: boolean;
} {
  const opts = CHOICE_MAP[field] ?? [];
  switch (field) {
    case "city":
      return { body: "Em qual cidade você está?", freeText: true };
    case "niche":
      return {
        body: "Em qual área você atua hoje?",
        list: {
          buttonText: "Escolher área",
          rows: opts.map((o) => ({ id: o.code, title: o.label.slice(0, 24) })),
        },
      };
    case "start_timeline":
      return {
        body: "Quando gostaria de começar?",
        buttons: opts.map((o) => ({ id: o.code, title: o.label.slice(0, 20) })),
      };
    case "business_objective":
      return {
        body: "Qual seu principal objetivo com a franquia?",
        list: {
          buttonText: "Escolher",
          rows: opts.map((o) => ({ id: o.code, title: o.label.slice(0, 24) })),
        },
      };
    case "main_question":
      return {
        body: "O que você mais precisa entender agora?",
        list: {
          buttonText: "Escolher",
          rows: opts.map((o) => ({ id: o.code, title: o.label.slice(0, 24) })),
        },
      };
    case "investment_status":
      return {
        body: `Por último: o investimento inicial da franquia é ${REGICENTER_FRANCHISE_INVESTMENT}. Qual é o seu momento?`,
        buttons: [
          { id: "CAPITAL_AVAILABLE", title: "Tenho o valor" },
          { id: "CAPITAL_PARTIAL", title: "Tenho parte" },
          { id: "CAPITAL_EVALUATING", title: "Ainda avaliando" },
        ],
      };
    default:
      return { body: "Pode me contar um pouco mais?", freeText: true };
  }
}

export function doneCopy(name: string | null | undefined) {
  const first = (name || "").trim().split(/\s+/)[0] || "olá";
  return `Perfeito, ${first}. Vou chamar alguém da equipe de expansão para continuar com você.`;
}

export function followUpCopy(field: QualifyFieldKey) {
  const prompt = fieldPrompt(field);
  return `Ainda estou por aqui. ${prompt.body}`;
}
