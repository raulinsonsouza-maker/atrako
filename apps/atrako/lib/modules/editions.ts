/**
 * Versão do workspace: um pacote por cliente, escolhido pela equipe na implantação.
 * Trocar a versão só altera módulos ligados. Não apaga cardápio, pedido nem lead.
 */

import type { ModuleKey } from "@/lib/modules/registry";

export const WORKSPACE_EDITIONS = ["food", "stay", "inside_sales", "ecommerce", "custom"] as const;
export type WorkspaceEdition = (typeof WORKSPACE_EDITIONS)[number];

export const EDITION_LABELS: Record<WorkspaceEdition, string> = {
  food: "Food",
  stay: "Aluguel por temporada",
  inside_sales: "Inside sales",
  ecommerce: "E-commerce",
  custom: "Personalizado",
};

type EditionBundle = { enable: ModuleKey[]; disable: ModuleKey[] };

/** Pacotes fechados. Personalizado não mexe nos módulos. */
export const EDITION_BUNDLES: Record<Exclude<WorkspaceEdition, "custom">, EditionBundle> = {
  food: {
    enable: ["food", "relacionamento", "whatsapp", "finance", "assistente"],
    disable: ["agenda", "commerce", "social"],
  },
  stay: {
    enable: ["hospedagem", "relacionamento", "whatsapp", "finance", "assistente"],
    disable: ["agenda", "food", "commerce"],
  },
  inside_sales: {
    enable: ["forms", "whatsapp", "relacionamento", "finance", "assistente"],
    disable: ["food", "agenda", "commerce", "social"],
  },
  ecommerce: {
    enable: ["commerce", "relacionamento", "whatsapp", "finance", "assistente"],
    disable: ["food", "agenda"],
  },
};

const INSIDE_SALES_CHANNELS = ["geral", "meta", "google", "linkedin", "crm", "relacionamento"] as const;
const FOOD_CHANNELS = ["geral", "meta", "google", "crm", "relacionamento"] as const;
const STAY_CHANNELS = ["geral", "crm", "relacionamento"] as const;

const INSIDE_SALES_CONNECTORS = ["META_ADS", "GOOGLE_ADS", "LINKEDIN_ADS", "WHATSAPP", "RESEND"] as const;
const FOOD_CONNECTORS = ["WHATSAPP", "MERCADO_PAGO", "META_ADS", "GOOGLE_ADS", "RESEND"] as const;
const STAY_CONNECTORS = ["WHATSAPP", "MERCADO_PAGO", "RESEND"] as const;

const INSIDE_SALES_LEDGER = ["manual", "crm", "whatsapp", "forms"] as const;
const FOOD_LEDGER = ["manual", "food", "crm", "whatsapp", "forms"] as const;
const STAY_LEDGER = ["manual", "stay", "crm", "whatsapp"] as const;

/** Abas do dashboard que a edição mostra. As outras edições mostram todas. */
export function editionAllowsDashboardChannel(edition: string | null | undefined, channel: string) {
  if (edition === "inside_sales") return (INSIDE_SALES_CHANNELS as readonly string[]).includes(channel);
  if (edition === "food") return (FOOD_CHANNELS as readonly string[]).includes(channel);
  if (edition === "stay") return (STAY_CHANNELS as readonly string[]).includes(channel);
  return true;
}

/** Conectores oferecidos em Config → Integrações. */
export function editionAllowsConnector(edition: string | null | undefined, provider: string) {
  if (edition === "inside_sales") return (INSIDE_SALES_CONNECTORS as readonly string[]).includes(provider);
  if (edition === "food") return (FOOD_CONNECTORS as readonly string[]).includes(provider);
  if (edition === "stay") return (STAY_CONNECTORS as readonly string[]).includes(provider);
  return true;
}

/** Origens sugeridas no filtro do caixa. */
export function editionLedgerSources(edition: string | null | undefined): readonly string[] | null {
  if (edition === "inside_sales") return INSIDE_SALES_LEDGER;
  if (edition === "food") return FOOD_LEDGER;
  if (edition === "stay") return STAY_LEDGER;
  return null;
}

export function isWorkspaceEdition(value: string): value is WorkspaceEdition {
  return (WORKSPACE_EDITIONS as readonly string[]).includes(value);
}

/** Próximo mapa de módulos. `custom` devolve o mapa atual. */
export function modulesForEdition(
  edition: WorkspaceEdition,
  current: Partial<Record<ModuleKey, boolean>>,
): Partial<Record<ModuleKey, boolean>> {
  if (edition === "custom") return { ...current };
  const bundle = EDITION_BUNDLES[edition];
  const next: Partial<Record<ModuleKey, boolean>> = { ...current };
  for (const key of bundle.disable) next[key] = false;
  for (const key of bundle.enable) next[key] = true;
  return next;
}
