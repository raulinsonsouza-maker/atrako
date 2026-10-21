/**
 * Copy curta WhatsApp — franchise_regicenter.
 * Ids de resposta são estáveis: chegam de botões interativos e de botões de modelo (payload).
 */

import type { QualifyFieldKey } from "./fields";
import { CHOICE_MAP, REGICENTER_FRANCHISE_INVESTMENT } from "./choices";
import type { ReplyButton, ListRow } from "@/lib/integrations/whatsapp/messages";

export const QUALIFY_REPLY = {
  start: "START_QUALIFICATION",
  meeting: "WANT_MEETING",
  presentation: "SHOW_PRESENTATION",
  later: "LATER_OK",
} as const;

export const QUALIFY_REPLY_IDS = new Set<string>([
  ...Object.values(QUALIFY_REPLY),
  ...Object.values(CHOICE_MAP).flatMap((opts) => (opts ?? []).map((o) => o.code)),
]);

export function firstName(name: string | null | undefined) {
  return (name || "").trim().split(/\s+/)[0] || "olá";
}

const START_BUTTONS: ReplyButton[] = [
  { id: QUALIFY_REPLY.start, title: "Começar" },
  { id: QUALIFY_REPLY.meeting, title: "Falar com consultor" },
];

export function openCopy(input: { name?: string | null; brand: string; city?: string | null; questions: number }) {
  const cityBit = input.city?.trim() ? ` de ${input.city.trim()}` : "";
  const n = input.questions;
  return {
    body:
      n > 0
        ? `Oi, ${firstName(input.name)}! Recebi seu cadastro${cityBit} na ${input.brand}. São ${n} pergunta${n > 1 ? "s" : ""} rápida${n > 1 ? "s" : ""}, menos de 1 minuto, para te conectar ao consultor certo.`
        : `Oi, ${firstName(input.name)}! Recebi seu cadastro${cityBit} na ${input.brand}. Quer falar agora com um consultor?`,
    buttons: n > 0 ? START_BUTTONS : [{ id: QUALIFY_REPLY.meeting, title: "Falar com consultor" }],
  };
}

/** Texto livre no lugar do botão de início: começa direto. */
export const START_ANYWAY = "Claro! Vou te fazer as perguntas por aqui.";

export function presentationCopy(brand: string) {
  return {
    body: `A ${brand} é uma franquia de registro de marcas e patentes, com operação e suporte jurídico pela matriz. Investimento inicial ${REGICENTER_FRANCHISE_INVESTMENT}. Vamos às perguntas rápidas?`,
    buttons: START_BUTTONS,
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
      return { body: "Em qual cidade você quer atuar?", freeText: true };
    case "niche":
      return {
        body: "Em qual área você atua hoje?",
        list: { buttonText: "Escolher área", rows: opts.map((o) => ({ id: o.code, title: o.label.slice(0, 24) })) },
      };
    case "start_timeline":
      return {
        body: "Se fizer sentido, quando quer começar?",
        buttons: opts.map((o) => ({ id: o.code, title: o.label.slice(0, 20) })),
      };
    case "business_objective":
      return {
        body: "Qual seu principal objetivo com a franquia?",
        list: { buttonText: "Escolher", rows: opts.map((o) => ({ id: o.code, title: o.label.slice(0, 24) })) },
      };
    case "main_question":
      return {
        body: "O que você mais quer entender na conversa com o consultor?",
        list: { buttonText: "Escolher", rows: opts.map((o) => ({ id: o.code, title: o.label.slice(0, 24) })) },
      };
    case "investment_status":
      return {
        body: `Por último: o investimento inicial é ${REGICENTER_FRANCHISE_INVESTMENT}. Qual é o seu momento?`,
        buttons: [
          { id: "CAPITAL_AVAILABLE", title: "Tenho o valor" },
          { id: "CAPITAL_PARTIAL", title: "Tenho parte" },
          { id: "CAPITAL_EVALUATING", title: "Ainda avaliando" },
        ],
      };
    case "best_contact_time":
      return {
        body: "Qual o melhor horário para o consultor te chamar?",
        buttons: opts.map((o) => ({ id: o.code, title: o.label })),
      };
    default:
      return { body: "Pode me contar um pouco mais?", freeText: true };
  }
}

/** Pergunta numerada ("2 de 5 · …"); `index` começa em 1. */
export function numberedPrompt(field: QualifyFieldKey, index: number, total: number) {
  const prompt = fieldPrompt(field);
  return total > 1 ? { ...prompt, body: `${index} de ${total} · ${prompt.body}` } : prompt;
}

export function reaskCopy(field: QualifyFieldKey, index: number, total: number) {
  const prompt = numberedPrompt(field, index, total);
  return { ...prompt, body: `Ainda estou por aqui. ${prompt.body}` };
}

export function invalidChoiceCopy(field: QualifyFieldKey) {
  return field === "city" ? "Pode me dizer a cidade? Ex.: Curitiba." : "Toque em uma das opções abaixo, por favor.";
}

export function bestTimeCopy(name: string | null | undefined, hot: boolean) {
  const prompt = fieldPrompt("best_contact_time");
  return {
    body: `${hot ? "Seu perfil tem tudo a ver com a franquia" : "Ótimo"}, ${firstName(name)}! ${prompt.body}`,
    buttons: prompt.buttons ?? [],
  };
}

const TIME_PHRASE: Record<string, string> = {
  MORNING: "pela manhã",
  AFTERNOON: "à tarde",
  EVENING: "à noite",
};

export function handoffCopy(name: string | null | undefined, timeCode: string | null | undefined) {
  const when = timeCode && TIME_PHRASE[timeCode] ? `, de preferência ${TIME_PHRASE[timeCode]}` : "";
  return `Combinado, ${firstName(name)}! Um consultor de expansão vai falar com você por aqui${when}. Se quiser adiantar, já pode mandar sua dúvida.`;
}

export function nurtureCopy(name: string | null | undefined) {
  return {
    body: `Obrigado, ${firstName(name)}! Vou te mandar por e-mail um material completo da franquia para ver com calma. Quando quiser falar com um consultor, é só tocar abaixo.`,
    buttons: [{ id: QUALIFY_REPLY.meeting, title: "Quero conversar" }] as ReplyButton[],
  };
}

export const LATER_COPY = "Sem problema. Quando quiser, é só mandar uma mensagem por aqui.";
