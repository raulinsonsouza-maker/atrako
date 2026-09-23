import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  FileText,
  Instagram,
  Megaphone,
  Percent,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

export type CriarVia = "assistente" | "manual";
export type CriarMode = "ai" | "manual";
export type CriarFilter =
  | "todos"
  | "vendas"
  | "captura"
  | "agenda"
  | "instagram"
  | "anuncios";

export type CriarModuleId =
  | "oferta"
  | "formulario"
  | "automacao"
  | "servico"
  | "cupom"
  | "upsell"
  | "campanha-meta";

export type CriarModuleDef = {
  id: CriarModuleId;
  filter: Exclude<CriarFilter, "todos">;
  title: string;
  desc: string;
  icon: LucideIcon;
};

export const CRIAR_MODULES: CriarModuleDef[] = [
  {
    id: "oferta",
    filter: "vendas",
    title: "Oferta",
    desc: "Página de venda com checkout e Mercado Pago.",
    icon: ShoppingBag,
  },
  {
    id: "upsell",
    filter: "vendas",
    title: "Upsell",
    desc: "Oferta extra no checkout ou logo após a compra.",
    icon: Sparkles,
  },
  {
    id: "cupom",
    filter: "vendas",
    title: "Cupom",
    desc: "Código de desconto para usar no checkout.",
    icon: Percent,
  },
  {
    id: "formulario",
    filter: "captura",
    title: "Formulário",
    desc: "Perguntas em sequência. O lead entra no CRM.",
    icon: FileText,
  },
  {
    id: "servico",
    filter: "agenda",
    title: "Agenda",
    desc: "Página pública, serviços e horários.",
    icon: CalendarDays,
  },
  {
    id: "automacao",
    filter: "instagram",
    title: "Automação",
    desc: "Comentário ou palavra-chave dispara o Direct.",
    icon: Instagram,
  },
  {
    id: "campanha-meta",
    filter: "anuncios",
    title: "Campanha Meta",
    desc: "Anúncios no Facebook e Instagram.",
    icon: Megaphone,
  },
];

export const CRIAR_FILTERS: { id: CriarFilter; label: string }[] = [
  { id: "todos", label: "Tudo" },
  { id: "vendas", label: "Páginas" },
  { id: "captura", label: "Captura" },
  { id: "agenda", label: "Agenda" },
  { id: "instagram", label: "Instagram" },
  { id: "anuncios", label: "Anúncios" },
];

export function viaToMode(via: CriarVia): CriarMode {
  return via === "assistente" ? "ai" : "manual";
}

export function modeToVia(mode: CriarMode): CriarVia {
  return mode === "ai" ? "assistente" : "manual";
}

export function moduleHref(id: CriarModuleId, mode: CriarMode) {
  return `/criar/${id}?mode=${mode}`;
}
