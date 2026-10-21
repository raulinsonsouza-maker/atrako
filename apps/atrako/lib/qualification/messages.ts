/**
 * Ids de resposta e copy fixa do WhatsApp — o texto editável vive em script.ts.
 * Ids são estáveis: chegam de botões interativos e de botões de modelo (payload).
 */

import type { QualifyFieldKey } from "./fields";
import { CHOICE_MAP, REGICENTER_FRANCHISE_INVESTMENT } from "./choices";
import type { ReplyButton } from "@/lib/integrations/whatsapp/messages";

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

/** Opções criadas pelo operador ganham código OPT_*. */
export function isQualifyReplyId(id: string | null | undefined) {
  return !!id && (QUALIFY_REPLY_IDS.has(id) || id.startsWith("OPT_"));
}

export function firstName(name: string | null | undefined) {
  return (name || "").trim().split(/\s+/)[0] || "olá";
}

const START_BUTTONS: ReplyButton[] = [
  { id: QUALIFY_REPLY.start, title: "Começar" },
  { id: QUALIFY_REPLY.meeting, title: "Falar com consultor" },
];

/** Texto livre no lugar do botão de início: começa direto. */
export const START_ANYWAY = "Claro! Vou te fazer as perguntas por aqui.";

export function presentationCopy(brand: string) {
  return {
    body: `A ${brand} é uma franquia de registro de marcas e patentes, com operação e suporte jurídico pela matriz. Investimento inicial ${REGICENTER_FRANCHISE_INVESTMENT}. Vamos às perguntas rápidas?`,
    buttons: START_BUTTONS,
  };
}

export function invalidChoiceCopy(field: QualifyFieldKey) {
  return field === "city" ? "Pode me dizer a cidade? Ex.: Curitiba." : "Toque em uma das opções abaixo, por favor.";
}

export const LATER_COPY = "Sem problema. Quando quiser, é só mandar uma mensagem por aqui.";
