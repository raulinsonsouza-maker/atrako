/** Tipos de seção que o designer marca com data-section. A extração da biblioteca depende disso. */
export const LP_SECTION_KINDS = [
  "hero",
  "dor",
  "beneficios",
  "como-funciona",
  "oferta",
  "form",
  "checkout",
  "faq",
  "cta-final",
  "rodape",
  "diferenciais",
] as const;

export type LpSectionKind = (typeof LP_SECTION_KINDS)[number];

const KIND_SET = new Set<string>(LP_SECTION_KINDS);

export function isLpSectionKind(value: string): value is LpSectionKind {
  return KIND_SET.has(value);
}
