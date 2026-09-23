import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  FileText,
  Instagram,
  LayoutTemplate,
  Megaphone,
  MessageCircle,
} from "lucide-react";
import {
  FLOW_TEMPLATES,
  type FlowTemplate,
} from "@/lib/symbius/flowTemplates";
import {
  OBJECTIVE_CONFIG,
  type UiObjective,
} from "@/lib/integrations/meta/campaign-builder/objective-config";
import type { CriarMode } from "@/lib/criar/modules";

export type CriarPlatformId =
  | "instagram"
  | "anuncios"
  | "loja"
  | "captura"
  | "agenda"
  | "whatsapp";

export type CriarRecipeBadge =
  | "popular"
  | "quick"
  | "recommended"
  | "soon"
  | "ai"
  | "pro";

export type CriarRecipeGroup = "meta" | "outras" | "default";

export type CriarRecipe = {
  id: string;
  platform: CriarPlatformId;
  title: string;
  description: string;
  badges: CriarRecipeBadge[];
  /** null = em breve / não clicável */
  href: string | null;
  group?: CriarRecipeGroup;
  recommended?: boolean;
  /** Instagram filters */
  igObjectives?: FlowTemplate["objectives"];
  igTriggers?: FlowTemplate["triggers"];
};

export type CriarPlatformDef = {
  id: CriarPlatformId;
  title: string;
  desc: string;
  icon: LucideIcon;
};

export const CRIAR_PLATFORMS: CriarPlatformDef[] = [
  {
    id: "instagram",
    title: "Instagram",
    desc: "Automações de comentário, story e DM",
    icon: Instagram,
  },
  {
    id: "anuncios",
    title: "Anúncios",
    desc: "Meta, Google, TikTok e LinkedIn",
    icon: Megaphone,
  },
  {
    id: "loja",
    title: "Páginas",
    desc: "Landing de venda ou leads, upsell e cupom",
    icon: LayoutTemplate,
  },
  {
    id: "captura",
    title: "Captura",
    desc: "Formulários que entram no CRM",
    icon: FileText,
  },
  {
    id: "agenda",
    title: "Agenda",
    desc: "Agenda pública com serviços e horários",
    icon: CalendarDays,
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    desc: "Templates, automações e broadcasts",
    icon: MessageCircle,
  },
];

const META_RECIPE_COPY: Record<
  UiObjective,
  { id: string; title: string; description: string; recommended?: boolean }
> = {
  ENGAGEMENT: {
    id: "meta-engagement",
    title: "Engajamento",
    description: "Curtidas, ThruPlay e interação com a publicação",
    recommended: true,
  },
  LEADS: {
    id: "meta-leads",
    title: "Leads",
    description: "Formulário no anúncio ou conversões no site",
    recommended: true,
  },
  AWARENESS: {
    id: "meta-alcance",
    title: "Alcance",
    description: "Mostre o anúncio para o máximo de pessoas possíveis",
    recommended: true,
  },
  SALES: {
    id: "meta-sales",
    title: "Vendas",
    description: "Conversões e valor de compra no site",
    recommended: true,
  },
  TRAFFIC: {
    id: "meta-traffic",
    title: "Tráfego",
    description: "Leve pessoas ao site ou ao WhatsApp",
  },
  APP: {
    id: "meta-app",
    title: "App",
    description: "Instalações e aberturas do aplicativo",
  },
};

function modeQuery(mode: CriarMode) {
  return `mode=${mode}`;
}

function igRecipeHref(t: FlowTemplate, mode: CriarMode): string | null {
  if (t.action === "soon" || t.kind === "soon") return null;
  const q = new URLSearchParams({ recipe: t.id });
  if (mode === "ai") q.set("mode", "ai");
  return `/social/flows/new?${q.toString()}`;
}

function buildInstagramRecipes(mode: CriarMode): CriarRecipe[] {
  return FLOW_TEMPLATES.map((t) => {
    const badges: CriarRecipeBadge[] = [];
    if (t.popular) badges.push("popular");
    if (t.kind === "quick") badges.push("quick");
    if (t.recommended) badges.push("recommended");
    if (t.kind === "soon" || t.action === "soon") badges.push("soon");
    if (t.ai) badges.push("ai");
    if (t.pro) badges.push("pro");
    return {
      id: `ig-${t.id}`,
      platform: "instagram" as const,
      title: t.title,
      description: t.description,
      badges,
      href: igRecipeHref(t, mode),
      recommended: Boolean(t.recommended),
      igObjectives: t.objectives,
      igTriggers: t.triggers,
    };
  });
}

function buildAnunciosRecipes(mode: CriarMode): CriarRecipe[] {
  const meta: CriarRecipe[] = (Object.keys(META_RECIPE_COPY) as UiObjective[]).map(
    (ui) => {
      const copy = META_RECIPE_COPY[ui];
      const q = new URLSearchParams({
        mode,
        objective: ui,
      });
      if (ui === "AWARENESS") q.set("optimizationGoal", "REACH");
      return {
        id: copy.id,
        platform: "anuncios" as const,
        title: copy.title,
        description: copy.description,
        badges: copy.recommended
          ? (["recommended"] as CriarRecipeBadge[])
          : [],
        href: `/criar/campanha-meta?${q.toString()}`,
        group: "meta" as const,
        recommended: Boolean(copy.recommended),
      };
    },
  );

  const outras: CriarRecipe[] = [
    {
      id: "ads-google",
      platform: "anuncios",
      title: "Google Ads",
      description: "Campanhas de pesquisa, display e YouTube",
      badges: ["soon"],
      href: null,
      group: "outras",
    },
    {
      id: "ads-tiktok",
      platform: "anuncios",
      title: "TikTok Ads",
      description: "Anúncios no feed e nos vídeos do TikTok",
      badges: ["soon"],
      href: null,
      group: "outras",
    },
    {
      id: "ads-linkedin",
      platform: "anuncios",
      title: "LinkedIn Ads",
      description: "Campanhas B2B no LinkedIn",
      badges: ["soon"],
      href: null,
      group: "outras",
    },
  ];

  return [...meta, ...outras];
}

function buildLojaRecipes(mode: CriarMode): CriarRecipe[] {
  const m = modeQuery(mode);
  return [
    {
      id: "loja-landing",
      platform: "loja",
      title: "Landing page",
      description: "Página de venda com produto e link público",
      badges: ["recommended", "popular"],
      href: `/criar/oferta?${m}&new=1&focus=page`,
      recommended: true,
    },
    {
      id: "loja-checkout",
      platform: "loja",
      title: "Checkout",
      description: "Modelo de página de vendas com checkout",
      badges: ["recommended"],
      href: `/criar/oferta?${m}&new=1&entry=template&filter=sales`,
      recommended: true,
    },
    {
      id: "loja-upsell",
      platform: "loja",
      title: "Upsell",
      description: "Oferta extra no checkout ou após a compra",
      badges: [],
      href: `/criar/upsell?${m}`,
    },
    {
      id: "loja-cupom",
      platform: "loja",
      title: "Cupom",
      description: "Código de desconto para o checkout",
      badges: [],
      href: `/criar/cupom?${m}`,
    },
  ];
}

function buildCapturaRecipes(mode: CriarMode): CriarRecipe[] {
  const m = modeQuery(mode);
  return [
    {
      id: "captura-landing",
      platform: "captura",
      title: "Landing de captura",
      description: "Página com formulário Atrako — lead no CRM",
      badges: ["recommended", "popular"],
      href: `/criar/oferta?${m}&new=1&entry=template&filter=leads`,
      recommended: true,
    },
    {
      id: "captura-formulario",
      platform: "captura",
      title: "Formulário",
      description: "Perguntas em sequência. O lead entra no CRM",
      badges: ["recommended"],
      href: `/criar/formulario?${m}`,
      recommended: true,
    },
  ];
}

function buildAgendaRecipes(mode: CriarMode): CriarRecipe[] {
  return [
    {
      id: "agenda-setup",
      platform: "agenda",
      title: "Agenda",
      description: "Página pública, serviços e horários",
      badges: ["recommended"],
      href: `/criar/agenda?${modeQuery(mode)}`,
      recommended: true,
    },
    {
      id: "agenda-servico",
      platform: "agenda",
      title: "Serviço",
      description: "Adicionar um serviço à agenda pública",
      badges: ["quick"],
      href: `/criar/servico?${modeQuery(mode)}`,
    },
  ];
}

function buildWhatsappRecipes(): CriarRecipe[] {
  return [
    {
      id: "wa-template",
      platform: "whatsapp",
      title: "Template de mensagem",
      description: "Mensagens aprovadas para iniciar conversas",
      badges: ["soon"],
      href: null,
    },
    {
      id: "wa-automacao",
      platform: "whatsapp",
      title: "Automação",
      description: "Respostas e fluxos no WhatsApp Business",
      badges: ["soon"],
      href: null,
    },
    {
      id: "wa-broadcast",
      platform: "whatsapp",
      title: "Broadcast",
      description: "Envio em massa para sua base",
      badges: ["soon"],
      href: null,
    },
  ];
}

export function recipesForPlatform(
  platform: CriarPlatformId,
  mode: CriarMode = "manual",
): CriarRecipe[] {
  switch (platform) {
    case "instagram":
      return buildInstagramRecipes(mode);
    case "anuncios":
      return buildAnunciosRecipes(mode);
    case "loja":
      return buildLojaRecipes(mode);
    case "captura":
      return buildCapturaRecipes(mode);
    case "agenda":
      return buildAgendaRecipes(mode);
    case "whatsapp":
      return buildWhatsappRecipes();
    default:
      return [];
  }
}

export function platformCounts(platform: CriarPlatformId) {
  const all = recipesForPlatform(platform, "manual");
  const available = all.filter((r) => r.href != null).length;
  const soon = all.filter((r) => r.href == null).length;
  return { available, soon, total: all.length };
}

export function getPlatform(id: string): CriarPlatformDef | undefined {
  return CRIAR_PLATFORMS.find((p) => p.id === id);
}

export function isCriarPlatformId(id: string): id is CriarPlatformId {
  return CRIAR_PLATFORMS.some((p) => p.id === id);
}

export function platformHref(id: CriarPlatformId, mode?: CriarMode) {
  /** Loja → hub Minhas páginas (sem galeria intermediária). */
  if (id === "loja") {
    return mode === "ai" ? "/criar/oferta?mode=ai" : "/criar/oferta?mode=manual";
  }
  if (mode === "ai") return `/criar/p/${id}?mode=ai`;
  return `/criar/p/${id}`;
}
