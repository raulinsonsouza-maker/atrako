/**
 * Registry de campos canônicos do playbook inside sales.
 * fieldKey estável = id do CaptureForm = chave no card CRM.
 */

export const QUALIFY_FIELD_KEYS = [
  "name",
  "email",
  "phone",
  "city",
  "niche",
  "start_timeline",
  "business_objective",
  "main_question",
  "investment_status",
  "wa_opt_in",
  "best_contact_time",
] as const;

export type QualifyFieldKey = (typeof QUALIFY_FIELD_KEYS)[number];

export type QualifyAnswer = {
  value: string;
  label: string;
  code?: string;
  source: "lp" | "typeform" | "whatsapp" | "email" | "form" | "manual";
  at: string;
};

export type QualifyAnswers = Partial<Record<QualifyFieldKey, QualifyAnswer>>;

export type FieldDef = {
  key: QualifyFieldKey;
  crmLabel: string;
  /** Ordem na fila WhatsApp (investment_status sempre por último entre os de score). */
  waOrder: number;
  askOnWhatsApp: boolean;
  requiredForScore: boolean;
};

/** Campos que o bot WhatsApp pode perguntar (só se vazios). */
export const WA_ASK_ORDER: QualifyFieldKey[] = [
  "city",
  "niche",
  "start_timeline",
  "business_objective",
  "main_question",
  "investment_status",
];

export const FIELD_DEFS: FieldDef[] = [
  { key: "name", crmLabel: "Nome", waOrder: 0, askOnWhatsApp: false, requiredForScore: false },
  { key: "email", crmLabel: "E-mail", waOrder: 0, askOnWhatsApp: false, requiredForScore: false },
  { key: "phone", crmLabel: "WhatsApp", waOrder: 0, askOnWhatsApp: false, requiredForScore: true },
  { key: "city", crmLabel: "Cidade", waOrder: 1, askOnWhatsApp: true, requiredForScore: true },
  { key: "niche", crmLabel: "Área / nicho", waOrder: 2, askOnWhatsApp: true, requiredForScore: true },
  { key: "start_timeline", crmLabel: "Quando começar", waOrder: 3, askOnWhatsApp: true, requiredForScore: true },
  { key: "business_objective", crmLabel: "Objetivo", waOrder: 4, askOnWhatsApp: true, requiredForScore: true },
  { key: "main_question", crmLabel: "Principal dúvida", waOrder: 5, askOnWhatsApp: true, requiredForScore: true },
  { key: "investment_status", crmLabel: "Momento do investimento", waOrder: 6, askOnWhatsApp: true, requiredForScore: true },
  { key: "wa_opt_in", crmLabel: "Opt-in WhatsApp", waOrder: 0, askOnWhatsApp: false, requiredForScore: false },
  { key: "best_contact_time", crmLabel: "Melhor horário", waOrder: 0, askOnWhatsApp: false, requiredForScore: false },
];

export function missingFieldKeys(answers: QualifyAnswers, keys: QualifyFieldKey[] = WA_ASK_ORDER): QualifyFieldKey[] {
  return keys.filter((k) => {
    const a = answers[k];
    return !a || !String(a.value || "").trim();
  });
}

export function mergeAnswer(
  answers: QualifyAnswers,
  key: QualifyFieldKey,
  next: QualifyAnswer,
): QualifyAnswers {
  const prev = answers[key];
  if (prev && String(prev.value || "").trim() && !String(next.value || "").trim()) return answers;
  return { ...answers, [key]: next };
}

export function filledPercent(answers: QualifyAnswers, keys: QualifyFieldKey[] = WA_ASK_ORDER) {
  if (!keys.length) return 0;
  const n = keys.filter((k) => answers[k]?.value).length;
  return Math.round((n / keys.length) * 100);
}
