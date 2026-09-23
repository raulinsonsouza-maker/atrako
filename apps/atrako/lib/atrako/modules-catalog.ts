/**
 * Catálogo de módulos nativos do Atrako (shell único).
 * Config/conexões: /config — nunca silos por módulo.
 */

export type ModuleStatus = "live" | "absorbing" | "planned";

export type ModuleLink = {
  label: string;
  href: string;
  description: string;
  external?: boolean;
};

export type AtrakoModule = {
  id: string;
  name: string;
  tagline: string;
  status: ModuleStatus;
  path: string;
  liveInShell: ModuleLink[];
};

export const ATRAKO_MODULES: AtrakoModule[] = [
  {
    id: "insights",
    name: "Insights",
    tagline: "Mídia, analytics e atribuição até a receita",
    status: "live",
    path: "/insights",
    liveInShell: [
      {
        label: "Dashboards por workspace",
        href: "/insights",
        description: "Análise de contas do cliente",
      },
    ],
  },
  {
    id: "crm",
    name: "CRM",
    tagline: "Pipeline, leads e automações",
    status: "live",
    path: "/crm",
    liveInShell: [
      { label: "Pipeline", href: "/crm", description: "Leads nativos do workspace" },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    tagline: "Cloud API — inbox, recuperação e handoff",
    status: "live",
    path: "/whatsapp",
    liveInShell: [
      { label: "Inbox", href: "/whatsapp", description: "Conversas Cloud API" },
      { label: "Conexão", href: "/config/conexoes", description: "WABA no Config" },
    ],
  },
  {
    id: "social",
    name: "Social",
    tagline: "Comment → DM, inbox e fluxos Instagram",
    status: "live",
    path: "/social",
    liveInShell: [
      { label: "Home Social", href: "/social", description: "Operação IG" },
      { label: "Inbox", href: "/social/inbox", description: "Conversas" },
      { label: "Fluxos", href: "/social/flows", description: "Automações" },
    ],
  },
  {
    id: "agenda",
    name: "Agenda",
    tagline: "Calendário de reservas",
    status: "live",
    path: "/agenda",
    liveInShell: [
      { label: "Calendário", href: "/agenda", description: "Reservas da semana" },
    ],
  },
  {
    id: "commerce",
    name: "Commerce",
    tagline: "LPs, ofertas e Mercado Pago",
    status: "live",
    path: "/commerce",
    liveInShell: [
      { label: "Produtos", href: "/commerce", description: "Ofertas e pedidos" },
    ],
  },
  {
    id: "criar",
    name: "Criar",
    tagline: "Tudo que você publica na plataforma",
    status: "live",
    path: "/criar",
    liveInShell: [
      { label: "Hub", href: "/criar", description: "Plataformas" },
      { label: "Instagram", href: "/criar/p/instagram", description: "Automações" },
      { label: "Anúncios", href: "/criar/p/anuncios", description: "Meta e outras" },
      { label: "Páginas", href: "/criar/oferta?mode=manual", description: "Landing, leads e vendas no mesmo editor" },
      { label: "Captura", href: "/criar/p/captura", description: "Formulários" },
      { label: "Agenda", href: "/criar/p/agenda", description: "Página, serviços e horários" },
      { label: "WhatsApp", href: "/criar/p/whatsapp", description: "Em breve" },
    ],
  },
  {
    id: "finance",
    name: "Financeiro",
    tagline: "Ledger único: Commerce, Agenda, CRM e manual",
    status: "live",
    path: "/finance",
    liveInShell: [
      { label: "Ledger", href: "/finance", description: "Receitas e despesas" },
      {
        label: "Prefs",
        href: "/config/financeiro",
        description: "Moeda e categorias no Config",
      },
    ],
  },
  {
    id: "config",
    name: "Config",
    tagline: "Fonte única: empresa, membros, conexões, tracking",
    status: "live",
    path: "/config",
    liveInShell: [
      { label: "Home Config", href: "/config", description: "Checklist" },
      { label: "Conexões", href: "/config/conexoes", description: "MP, IG, Ads" },
    ],
  },
];

export function statusLabel(status: ModuleStatus): string {
  if (status === "live") return "No Atrako";
  if (status === "absorbing") return "Absorvendo";
  return "Em breve";
}
