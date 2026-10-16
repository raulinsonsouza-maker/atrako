/** Labels de UI → códigos internos estáveis. */

import type { QualifyFieldKey } from "./fields";

export type ChoiceOpt = { code: string; label: string };

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
    { code: "CAPITAL_AVAILABLE", label: "Tenho o valor" },
    { code: "CAPITAL_PARTIAL", label: "Tenho parte" },
    { code: "CAPITAL_EVALUATING", label: "Ainda estou avaliando" },
  ],
  best_contact_time: [
    { code: "MORNING", label: "Manhã" },
    { code: "AFTERNOON", label: "Tarde" },
    { code: "EVENING", label: "Noite" },
  ],
};

export function resolveChoice(fieldKey: QualifyFieldKey, raw: string): { code: string; label: string } {
  const opts = CHOICE_MAP[fieldKey];
  if (!opts) return { code: raw, label: raw };
  const byCode = opts.find((o) => o.code === raw);
  if (byCode) return byCode;
  const byLabel = opts.find((o) => o.label.toLowerCase() === raw.trim().toLowerCase());
  if (byLabel) return byLabel;
  return { code: raw, label: raw };
}

export function labelsFor(fieldKey: QualifyFieldKey): string[] {
  return (CHOICE_MAP[fieldKey] ?? []).map((o) => o.label);
}
