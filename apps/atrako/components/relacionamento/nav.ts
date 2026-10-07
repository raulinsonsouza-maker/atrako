export const REL_TABS = [
  { key: "inicio", label: "Início" },
  { key: "fluxos", label: "Fluxos" },
  { key: "campanhas", label: "Campanhas" },
] as const;

export type RelTab = (typeof REL_TABS)[number]["key"] | "ajustes";

export const AJUSTES_SECTIONS = [
  { value: "email", label: "Visual do e-mail" },
  { value: "whatsapp", label: "Modelos de WhatsApp" },
  { value: "contatos", label: "Contatos" },
  { value: "datas", label: "Datas" },
] as const;

export type AjustesSection = (typeof AJUSTES_SECTIONS)[number]["value"];

/** Abas antigas (links de notificações e favoritos) → aba nova + sub-seção, ou o painel da Central de clientes. */
export const LEGACY_TABS: Record<string, { tab: RelTab; sub?: string } | { dashboard: true }> = {
  visao: { tab: "inicio" },
  conteudo: { tab: "ajustes", sub: "email" },
  modelos: { tab: "ajustes", sub: "whatsapp" },
  tema: { tab: "ajustes", sub: "email" },
  contatos: { tab: "ajustes", sub: "contatos" },
  publicos: { tab: "ajustes", sub: "contatos" },
  desempenho: { dashboard: true },
  resultados: { dashboard: true },
  envios: { dashboard: true },
};

export type RelNav = (tab: RelTab, sub?: string) => void;

export function relHref(tab: RelTab, sub?: string) {
  return `/relacionamento?tab=${tab}${sub ? `&sub=${sub}` : ""}`;
}

/** Resultados do Relacionamento ficam na Central de clientes. */
export function relResultsHref(workspaceId: string) {
  return `/clientes/${workspaceId}?canal=relacionamento`;
}
