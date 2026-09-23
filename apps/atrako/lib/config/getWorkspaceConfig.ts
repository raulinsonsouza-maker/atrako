/**
 * Config central do workspace — fonte única para todos os módulos.
 * Doc: docs/CONFIG.md
 * Nunca duplicar brand/tracking/tokens fora daqui.
 */

import { prisma } from "@/lib/db";
import { listWorkspaceConnections } from "@/lib/atrako/workspace-connections";

export type ModulesEnabled = {
  crm: boolean;
  agenda: boolean;
  commerce: boolean;
  social: boolean;
  finance: boolean;
  forms: boolean;
  insights: boolean;
};

const DEFAULT_MODULES: ModulesEnabled = {
  crm: true,
  agenda: true,
  commerce: true,
  social: true,
  finance: true,
  forms: true,
  insights: true,
};

export async function ensureWorkspaceSettings(clienteId: string) {
  return prisma.workspaceSettings.upsert({
    where: { clienteId },
    create: { clienteId, modulesEnabled: DEFAULT_MODULES },
    update: {},
  });
}

/** Carrega settings + conexões (sem secrets) + dados do Cliente. */
export async function getWorkspaceConfig(workspaceId: string) {
  const cliente = await prisma.cliente.findUnique({ where: { id: workspaceId } });
  if (!cliente) return null;

  const settings = await ensureWorkspaceSettings(workspaceId);
  const connections = await listWorkspaceConnections(workspaceId);

  const modulesEnabled = {
    ...DEFAULT_MODULES,
    ...(typeof settings.modulesEnabled === "object" && settings.modulesEnabled
      ? (settings.modulesEnabled as Partial<ModulesEnabled>)
      : {}),
  };

  return {
    workspace: {
      id: cliente.id,
      name: cliente.nome,
      slug: cliente.slug,
      logoUrl: cliente.logoUrl,
      active: cliente.ativo,
    },
    settings: {
      timezone: settings.timezone,
      currency: settings.currency,
      locale: settings.locale,
      primaryColor: settings.primaryColor,
      customDomain: settings.customDomain,
      modulesEnabled,
      tracking: (settings.tracking as Record<string, unknown>) ?? {},
      financePrefs: (settings.financePrefs as Record<string, unknown>) ?? {},
      notifyPrefs: (settings.notifyPrefs as Record<string, unknown>) ?? {},
      formsPrefs: (settings.formsPrefs as Record<string, unknown>) ?? {},
      onboardingStep: settings.onboardingStep,
    },
    connections,
  };
}

export async function patchWorkspaceSettings(
  workspaceId: string,
  patch: {
    timezone?: string;
    currency?: string;
    locale?: string;
    primaryColor?: string | null;
    customDomain?: string | null;
    modulesEnabled?: Partial<ModulesEnabled>;
    tracking?: Record<string, unknown>;
    financePrefs?: Record<string, unknown>;
    notifyPrefs?: Record<string, unknown>;
    formsPrefs?: Record<string, unknown>;
    onboardingStep?: string;
    nome?: string;
    logoUrl?: string | null;
  },
) {
  await ensureWorkspaceSettings(workspaceId);

  if (patch.nome != null || patch.logoUrl !== undefined) {
    await prisma.cliente.update({
      where: { id: workspaceId },
      data: {
        ...(patch.nome != null ? { nome: patch.nome } : {}),
        ...(patch.logoUrl !== undefined ? { logoUrl: patch.logoUrl } : {}),
      },
    });
  }

  const current = await prisma.workspaceSettings.findUniqueOrThrow({
    where: { clienteId: workspaceId },
  });

  return prisma.workspaceSettings.update({
    where: { clienteId: workspaceId },
    data: {
      timezone: patch.timezone ?? undefined,
      currency: patch.currency ?? undefined,
      locale: patch.locale ?? undefined,
      primaryColor: patch.primaryColor === undefined ? undefined : patch.primaryColor,
      customDomain: patch.customDomain === undefined ? undefined : patch.customDomain,
      onboardingStep: patch.onboardingStep ?? undefined,
      modulesEnabled: patch.modulesEnabled
        ? { ...DEFAULT_MODULES, ...(current.modulesEnabled as object), ...patch.modulesEnabled }
        : undefined,
      tracking: patch.tracking
        ? { ...(current.tracking as object), ...patch.tracking }
        : undefined,
      financePrefs: patch.financePrefs
        ? { ...(current.financePrefs as object), ...patch.financePrefs }
        : undefined,
      notifyPrefs: patch.notifyPrefs
        ? { ...(current.notifyPrefs as object), ...patch.notifyPrefs }
        : undefined,
      formsPrefs: patch.formsPrefs
        ? { ...(current.formsPrefs as object), ...patch.formsPrefs }
        : undefined,
    },
  });
}

export function resolveBrand(config: NonNullable<Awaited<ReturnType<typeof getWorkspaceConfig>>>) {
  return {
    name: config.workspace.name,
    slug: config.workspace.slug,
    logoUrl: config.workspace.logoUrl,
    primaryColor: config.settings.primaryColor,
    timezone: config.settings.timezone,
    currency: config.settings.currency,
  };
}

export function resolveTracking(config: NonNullable<Awaited<ReturnType<typeof getWorkspaceConfig>>>) {
  const t = config.settings.tracking;
  return {
    pixelId: typeof t.pixelId === "string" ? t.pixelId : null,
    capiToken: typeof t.capiToken === "string" ? t.capiToken : null,
  };
}
