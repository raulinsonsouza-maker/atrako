export const REL_TABS = [
  { key: "inicio", label: "Início" },
  { key: "fluxos", label: "Fluxos" },
  { key: "campanhas", label: "Campanhas" },
  { key: "conteudo", label: "Conteúdo" },
  { key: "contatos", label: "Contatos" },
  { key: "desempenho", label: "Desempenho" },
] as const;

export type RelTab = (typeof REL_TABS)[number]["key"];

/** Abas antigas (links de notificações e favoritos) → aba nova + sub-seção. */
export const LEGACY_TABS: Record<string, { tab: RelTab; sub?: string }> = {
  visao: { tab: "inicio" },
  modelos: { tab: "conteudo", sub: "whatsapp" },
  tema: { tab: "conteudo", sub: "email" },
  publicos: { tab: "contatos" },
  resultados: { tab: "desempenho" },
  envios: { tab: "desempenho", sub: "envios" },
};

/** Abas que respondem ao filtro de período. */
export const PERIOD_TABS: ReadonlySet<RelTab> = new Set<RelTab>(["inicio", "fluxos", "desempenho"]);

export type RelNav = (tab: RelTab, sub?: string) => void;

export function relHref(tab: RelTab, sub?: string) {
  return `/relacionamento?tab=${tab}${sub ? `&sub=${sub}` : ""}`;
}
