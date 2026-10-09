/**
 * Registro único de módulos do Atrako.
 * Duas camadas: release global (PlatformModule, /admin/modulos) + escolha do
 * workspace (WorkspaceSettings.modulesEnabled, /config/modulos).
 * Doc: docs/CONFIG.md#módulos
 */

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  CalendarDays,
  FileText,
  HeartHandshake,
  Instagram,
  MessageSquare,
  ShoppingBag,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import type { CriarPlatformId } from "@/lib/criar/catalog";
import type { CriarModuleId } from "@/lib/criar/modules";

export const MODULE_KEYS = [
  "assistente",
  "crm",
  "insights",
  "relacionamento",
  "whatsapp",
  "social",
  "agenda",
  "commerce",
  "food",
  "finance",
  "forms",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_RELEASES = ["AVAILABLE", "BETA", "HIDDEN"] as const;
export type ModuleRelease = (typeof MODULE_RELEASES)[number];

export const MODULE_RELEASE_LABELS: Record<ModuleRelease, string> = {
  AVAILABLE: "Disponível",
  BETA: "Beta",
  HIDDEN: "Oculto",
};

export type ModuleDef = {
  key: ModuleKey;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Núcleo: sempre ligado, não aparece como toggle. */
  core?: boolean;
  defaultRelease: ModuleRelease;
  /** Item no menu lateral (ordem = ordem do array). */
  nav?: boolean;
  routes: string[];
  apiPrefixes: string[];
  criarPlatforms?: CriarPlatformId[];
  criarModules?: CriarModuleId[];
  /**
   * Categorias de /config/conexoes. Loja própria/Marketplaces/Pagamentos não entram:
   * alimentam atribuição de vendas e Agenda, não só a Loja nativa.
   */
  connectionCategories?: string[];
  /** Providers individuais de /config/conexoes (quando a categoria é compartilhada). */
  connectionProviders?: string[];
  /** Tools do Assistente (prefixo do nome, ex.: "forms."). */
  agentTools?: string[];
  /** Aviso mostrado antes de desligar. */
  disableWarning?: string;
};

/** Tela inicial quando o Assistente está desligado: dashboard do workspace (Insights é núcleo). */
export function homeFallback(workspaceId?: string | null): string {
  return workspaceId ? `/clientes/${workspaceId}` : "/insights";
}

export const MODULES: ModuleDef[] = [
  {
    key: "assistente",
    label: "Assistente",
    description: "Pergunte e execute",
    icon: Bot,
    defaultRelease: "AVAILABLE",
    // Fica no bloco "Início" da sidebar, fora do `nav` de Operação.
    routes: ["/assistente", "/agent"],
    apiPrefixes: ["/api/atrako/agent", "/api/atrako/assistant"],
  },
  {
    key: "crm",
    label: "Leads",
    description: "Funil até o fechamento",
    icon: Users,
    core: true,
    defaultRelease: "AVAILABLE",
    nav: true,
    routes: ["/crm"],
    apiPrefixes: ["/api/atrako/crm"],
  },
  {
    key: "insights",
    label: "Insights",
    description: "Mídia, analytics e atribuição",
    icon: BarChart3,
    core: true,
    defaultRelease: "AVAILABLE",
    routes: ["/insights"],
    apiPrefixes: [],
  },
  {
    key: "relacionamento",
    label: "Relacionamento",
    description: "E-mail e WhatsApp por etapa",
    icon: HeartHandshake,
    defaultRelease: "AVAILABLE",
    nav: true,
    routes: ["/relacionamento"],
    apiPrefixes: ["/api/atrako/relacionamento"],
  },
  {
    key: "whatsapp",
    label: "Atendimento",
    description: "Conversas no WhatsApp",
    icon: MessageSquare,
    defaultRelease: "AVAILABLE",
    nav: true,
    routes: ["/whatsapp"],
    apiPrefixes: ["/api/atrako/whatsapp"],
    criarPlatforms: ["whatsapp"],
    agentTools: ["automations.send_whatsapp"],
  },
  {
    key: "social",
    label: "Instagram",
    description: "Conteúdo e automações",
    icon: Instagram,
    defaultRelease: "HIDDEN",
    nav: true,
    routes: ["/social"],
    apiPrefixes: ["/api/symbius"],
    criarPlatforms: ["instagram"],
    criarModules: ["automacao"],
    connectionProviders: ["INSTAGRAM"],
    disableWarning: "As automações de comentário e Direct param de responder.",
  },
  {
    key: "agenda",
    label: "Agenda",
    description: "Calendário de reservas",
    icon: CalendarDays,
    defaultRelease: "BETA",
    nav: true,
    routes: ["/agenda"],
    apiPrefixes: ["/api/atrako/agenda"],
    criarPlatforms: ["agenda"],
    criarModules: ["servico"],
    connectionCategories: ["agenda"],
    disableWarning: "As páginas públicas de agendamento ficam indisponíveis para seus clientes.",
  },
  {
    key: "commerce",
    label: "Loja",
    description: "Produtos e pedidos",
    icon: ShoppingBag,
    defaultRelease: "BETA",
    nav: true,
    // O editor de Páginas (/criar/oferta, /p/*) também serve LPs de captura: só checkout/vendas são da Loja.
    routes: ["/commerce", "/checkout"],
    apiPrefixes: ["/api/atrako/commerce/checkout"],
    criarModules: ["upsell", "cupom"],
    disableWarning: "Páginas de venda e checkouts publicados ficam indisponíveis. Landing pages de captura continuam no ar.",
  },
  {
    key: "food",
    label: "Food",
    description: "Cardápio e pedidos",
    icon: UtensilsCrossed,
    defaultRelease: "BETA",
    nav: true,
    routes: ["/food"],
    apiPrefixes: ["/api/atrako/food"],
    disableWarning: "O cardápio público deixa de receber pedidos. Os pedidos já feitos continuam na fila.",
  },
  {
    key: "finance",
    label: "Caixa",
    description: "Entradas e saídas",
    icon: Wallet,
    defaultRelease: "AVAILABLE",
    nav: true,
    routes: ["/finance"],
    apiPrefixes: ["/api/atrako/finance"],
  },
  {
    key: "forms",
    label: "Formulários",
    description: "Captura que entra no CRM",
    icon: FileText,
    defaultRelease: "AVAILABLE",
    routes: ["/forms"],
    apiPrefixes: ["/api/atrako/forms"],
    criarPlatforms: ["captura"],
    criarModules: ["formulario"],
    agentTools: ["forms."],
    disableWarning: "Formulários publicados param de receber respostas.",
  },
];

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value);
}

export function isModuleRelease(value: string): value is ModuleRelease {
  return (MODULE_RELEASES as readonly string[]).includes(value);
}

export function getModuleDef(key: ModuleKey): ModuleDef {
  const def = MODULES.find((m) => m.key === key);
  if (!def) throw new Error(`Módulo desconhecido: ${key}`);
  return def;
}

export type ModuleState = {
  key: ModuleKey;
  enabled: boolean;
  release: ModuleRelease;
  /** Núcleo ou oculto: o workspace não pode alterar. */
  locked: boolean;
  /** Staff vendo um módulo oculto para clientes. */
  preview: boolean;
};

export type ModulesMap = Record<ModuleKey, ModuleState>;

/**
 * Regra de resolução:
 * - núcleo → sempre ligado
 * - HIDDEN → desligado (staff ADMIN entra em preview)
 * - escolha explícita do workspace vence
 * - sem escolha: AVAILABLE liga, BETA desliga
 */
export function resolveModuleState(
  def: ModuleDef,
  release: ModuleRelease,
  explicit: boolean | undefined,
  isStaff: boolean,
): ModuleState {
  if (def.core) {
    return { key: def.key, enabled: true, release: "AVAILABLE", locked: true, preview: false };
  }
  if (release === "HIDDEN") {
    return { key: def.key, enabled: isStaff, release, locked: true, preview: isStaff };
  }
  const enabled = typeof explicit === "boolean" ? explicit : release === "AVAILABLE";
  return { key: def.key, enabled, release, locked: false, preview: false };
}

/** Lê `WorkspaceSettings.modulesEnabled` descartando chaves/valores fora do registro. */
export function readExplicitModules(raw: unknown): Partial<Record<ModuleKey, boolean>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<ModuleKey, boolean>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isModuleKey(k) && typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** Módulo dono de um pathname (página ou API), se houver. */
export function moduleForPath(pathname: string): ModuleDef | null {
  const matches = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  return (
    MODULES.find((m) => m.routes.some(matches) || m.apiPrefixes.some(matches)) ?? null
  );
}

export function moduleForCriarPlatform(platform: string): ModuleDef | null {
  return MODULES.find((m) => m.criarPlatforms?.includes(platform as CriarPlatformId)) ?? null;
}

export function moduleForCriarModule(id: string): ModuleDef | null {
  return MODULES.find((m) => m.criarModules?.includes(id as CriarModuleId)) ?? null;
}

export function moduleForAgentTool(toolName: string): ModuleDef | null {
  return MODULES.find((m) => m.agentTools?.some((p) => toolName.startsWith(p))) ?? null;
}

export function moduleForConnection(category: string, provider?: string): ModuleDef | null {
  if (provider) {
    const byProvider = MODULES.find((m) => m.connectionProviders?.includes(provider));
    if (byProvider) return byProvider;
  }
  return MODULES.find((m) => m.connectionCategories?.includes(category)) ?? null;
}
