/**
 * Aplica a versão escolhida pela equipe. Não apaga dados do cliente.
 */

import { prisma } from "@/lib/db";
import { ensureWorkspaceSettings } from "@/lib/config/getWorkspaceConfig";
import { readExplicitModules, type ModuleKey } from "@/lib/modules/registry";
import { isWorkspaceEdition, modulesForEdition, type WorkspaceEdition } from "@/lib/modules/editions";
import { ensureFoodWorkspace } from "@/lib/food/catalog";

export async function applyWorkspaceEdition(clienteId: string, edition: WorkspaceEdition) {
  const settings = await ensureWorkspaceSettings(clienteId);
  const current = readExplicitModules(settings.modulesEnabled);
  const modulesEnabled = modulesForEdition(edition, current);
  await prisma.workspaceSettings.update({
    where: { clienteId },
    data: {
      edition,
      modulesEnabled: modulesEnabled as Record<string, boolean>,
    },
  });

  if (edition === "food") {
    await ensureFoodWorkspace(clienteId);
    const { ensureDefaultFlows } = await import("@/lib/flows/playbooks");
    await ensureDefaultFlows(clienteId).catch((err) => console.warn("[food] flows", err));
    const { ensureDefaultWaTemplates } = await import("@/lib/flows/wa-templates");
    await ensureDefaultWaTemplates(clienteId).catch((err) => console.warn("[food] wa templates", err));
  }

  return { edition, modulesEnabled: modulesEnabled as Partial<Record<ModuleKey, boolean>> };
}

export function parseEdition(value: unknown): WorkspaceEdition | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return isWorkspaceEdition(v) ? v : null;
}
