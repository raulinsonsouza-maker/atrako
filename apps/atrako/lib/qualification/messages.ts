/**
 * Copy curta WhatsApp — franchise_regicenter.
 */

import type { QualifyFieldKey } from "./fields";
import { CHOICE_MAP } from "./choices";
import type { ReplyButton, ListRow } from "@/lib/integrations/whatsapp/messages";

export function openCopy(name: string | null | undefined, city: string | null | undefined, missingCount: number) {
  const first = (name || "").trim().split(/\s+/)[0] || "olá";
  const cityBit = city?.trim() ? ` de ${city.trim()}` : "";
  if (missingCount <= 0) {
    return {
      body: `Oi, ${first}. Vi seu cadastro${cityBit}. Suas respostas já estão com a equipe — em breve falamos com você.`,
      buttons: [] as ReplyButton[],
    };
  }
  return {
    body: `Oi, ${first}. Vi seu cadastro${cityBit}. Faltam só ${missingCount} pergunta${missingCount > 1 ? "s" : ""} rápida${missingCount > 1 ? "s" : ""} para te direcionar.`,
    buttons: [
      { id: "START_QUALIFICATION", title: "Começar agora" },
      { id: "SHOW_PRESENTATION", title: "Ver apresentação" },
    ] as ReplyButton[],
  };
}

export function presentationCopy() {
  return {
    body: "A Regicenter é uma franquia de registro de marcas e patentes, com operação e suporte jurídico pela matriz. Quer seguir com as perguntas rápidas?",
    buttons: [{ id: "START_QUALIFICATION", title: "Quero responder" }] as ReplyButton[],
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
        body: "Por último: sobre o investimento inicial da franquia, qual é o seu momento?",
        buttons: opts.map((o) => ({ id: o.code, title: o.label.slice(0, 20) })),
      };
    default:
      return { body: "Pode me contar um pouco mais?", freeText: true };
  }
}

export function doneCopy(name: string | null | undefined) {
  const first = (name || "").trim().split(/\s+/)[0] || "olá";
  return `Pronto, ${first}. Suas respostas já estão com a equipe de expansão. Eles falam com você para a primeira conversa.`;
}

export function followUpCopy(field: QualifyFieldKey) {
  const prompt = fieldPrompt(field);
  return `Ainda estou por aqui. ${prompt.body}`;
}
