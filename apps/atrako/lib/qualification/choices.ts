/** Labels de UI → códigos internos estáveis. */

import type { QualifyFieldKey } from "./fields";

export type ChoiceOpt = { code: string; label: string };

/** Investimento inicial publicado pela Regicenter (regicenter.com/seja-um-franqueado). */
export const REGICENTER_FRANCHISE_INVESTMENT = "R$ 27.900,00";

export const CHOICE_MAP: Partial<Record<QualifyFieldKey, ChoiceOpt[]>> = {
  niche: [
    { code: "NICHE_LAW", label: "Advocacia" },
    { code: "NICHE_ACCOUNTING", label: "Contabilidade" },
    { code: "NICHE_MARKETING", label: "Agência de marketing" },
    { code: "NICHE_INSURANCE", label: "Seguros" },
    { code: "NICHE_SAAS", label: "Programação / SaaS" },
    { code: "NICHE_OTHER", label: "Outro" },
  ],
  start_timeline: [
    { code: "START_30D", label: "Em até 30 dias" },
    { code: "START_60_90D", label: "Em 60–90 dias" },
    { code: "START_LATER", label: "Mais pra frente" },
  ],
  business_objective: [
    { code: "OWNER_OPERATOR", label: "Operar a unidade" },
    { code: "ADDITIONAL_INCOME", label: "Renda extra" },
    { code: "BUILD_TEAM", label: "Montar equipe" },
    { code: "EXPLORING", label: "Só conhecendo" },
  ],
  main_question: [
    { code: "OPERATIONS", label: "Operação" },
    { code: "ACQUISITION", label: "Captação de clientes" },
    { code: "INVESTMENT_TERMS", label: "Condições da franquia" },
    { code: "FINANCIALS", label: "Retorno / números" },
  ],
  investment_status: [
    { code: "CAPITAL_AVAILABLE", label: `Tenho os ${REGICENTER_FRANCHISE_INVESTMENT}` },
    { code: "CAPITAL_PARTIAL", label: "Tenho parte" },
    { code: "CAPITAL_EVALUATING", label: "Ainda estou avaliando" },
  ],
  best_contact_time: [
    { code: "MORNING", label: "Manhã" },
    { code: "AFTERNOON", label: "Tarde" },
    { code: "EVENING", label: "Noite" },
  ],
  how_found: [
    { code: "HOW_AI", label: "ChatGPT / outra IA" },
    { code: "HOW_GOOGLE", label: "Google" },
    { code: "HOW_SOCIAL", label: "Instagram / Facebook" },
    { code: "HOW_YOUTUBE", label: "YouTube" },
    { code: "HOW_REFERRAL", label: "Indicação" },
    { code: "HOW_OTHER", label: "Outro" },
  ],
};

const LABEL_ALIASES: Partial<Record<QualifyFieldKey, Record<string, string>>> = {
  investment_status: {
    "tenho o valor": "CAPITAL_AVAILABLE",
    [`tenho os ${REGICENTER_FRANCHISE_INVESTMENT}`.toLowerCase()]: "CAPITAL_AVAILABLE",
    // Rótulos antigos que ainda podem chegar de respostas e botões já enviados.
    "tenho os r$ 27.999": "CAPITAL_AVAILABLE",
    "tenho os r$ 27.900": "CAPITAL_AVAILABLE",
  },
};

export function resolveChoice(fieldKey: QualifyFieldKey, raw: string): { code: string; label: string } {
  const opts = CHOICE_MAP[fieldKey];
  if (!opts) return { code: raw, label: raw };
  const byCode = opts.find((o) => o.code === raw);
  if (byCode) return byCode;
  const byLabel = opts.find((o) => o.label.toLowerCase() === raw.trim().toLowerCase());
  if (byLabel) return byLabel;
  const aliasCode = LABEL_ALIASES[fieldKey]?.[raw.trim().toLowerCase()];
  if (aliasCode) {
    const hit = opts.find((o) => o.code === aliasCode);
    if (hit) return hit;
  }
  return { code: raw, label: raw };
}

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Resposta digitada no WhatsApp → opção: código, rótulo, número da lista ou trecho único do rótulo. */
const TEXT_HINTS: [RegExp, string][] = [
  [/^sim\b|tenho (o valor|os? |tudo)/, "CAPITAL_AVAILABLE"],
  [/parte|metade|parcial/, "CAPITAL_PARTIAL"],
  [/avalia|ainda n|nao tenho/, "CAPITAL_EVALUATING"],
  [/manh/, "MORNING"],
  [/tarde/, "AFTERNOON"],
  [/noite/, "EVENING"],
  [/chat|gpt|\bia\b|intelig|gemini|claude|perplex|copilot/, "HOW_AI"],
  [/google/, "HOW_GOOGLE"],
  [/insta|face|meta\b/, "HOW_SOCIAL"],
  [/youtube|video/, "HOW_YOUTUBE"],
  [/indica|amig/, "HOW_REFERRAL"],
];

export function matchChoice(fieldKey: QualifyFieldKey, raw: string, options?: ChoiceOpt[]): ChoiceOpt | null {
  const opts = options ?? CHOICE_MAP[fieldKey] ?? [];
  if (!opts.length || !raw.trim()) return null;
  const byCode = opts.find((o) => o.code === raw.trim());
  if (byCode) return byCode;
  const t = norm(raw);
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= opts.length) return opts[n - 1]!;
  const exact = opts.find((o) => norm(o.label) === t);
  if (exact) return exact;
  if (fieldKey === "investment_status" || fieldKey === "best_contact_time" || fieldKey === "how_found") {
    for (const [re, code] of TEXT_HINTS) {
      const hit = re.test(t) ? opts.find((o) => o.code === code) : undefined;
      if (hit) return hit;
    }
  }
  if (t.length < 3) return null;
  const hits = opts.filter((o) => norm(o.label).includes(t) || t.includes(norm(o.label)));
  return hits.length === 1 ? hits[0]! : null;
}

export function labelsFor(fieldKey: QualifyFieldKey): string[] {
  return (CHOICE_MAP[fieldKey] ?? []).map((o) => o.label);
}
