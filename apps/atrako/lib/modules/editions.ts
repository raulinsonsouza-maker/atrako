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
    enable: ["agenda", "relacionamento", "whatsapp", "finance", "assistente"],
    disable: ["food", "commerce"],
  },
  inside_sales: {
    enable: ["forms", "whatsapp", "relacionamento", "finance", "assistente"],
    disable: ["food", "agenda", "commerce"],
  },
  ecommerce: {
    enable: ["commerce", "relacionamento", "whatsapp", "finance", "assistente"],
    disable: ["food", "agenda"],
  },
};

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
