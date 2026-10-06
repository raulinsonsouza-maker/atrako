import "server-only";

import { cache } from "react";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getInternalUser } from "@/lib/internalUsers";
import {
  MODULES,
  getModuleDef,
  isModuleKey,
  isModuleRelease,
  readExplicitModules,
  resolveModuleState,
  type ModuleKey,
  type ModuleRelease,
  type ModuleState,
  type ModulesMap,
} from "@/lib/modules/registry";

/** Releases globais (DB sobrescreve o defaultRelease do registro). */
export const getModuleReleases = cache(async (): Promise<Record<ModuleKey, ModuleRelease>> => {
  let rows: Array<{ key: string; release: string }> = [];
  try {
    rows = await prisma.platformModule.findMany();
  } catch (err) {
    console.warn("[modules] PlatformModule indisponível — usando defaultRelease do registro", err);
  }
  const fromDb = new Map(rows.map((r) => [r.key, r.release]));
  return Object.fromEntries(
    MODULES.map((m) => {
      const r = fromDb.get(m.key);
      return [m.key, r && isModuleRelease(r) ? r : m.defaultRelease];
    }),
  ) as Record<ModuleKey, ModuleRelease>;
});

export async function setModuleRelease(key: ModuleKey, release: ModuleRelease) {
  return prisma.platformModule.upsert({
    where: { key },
    create: { key, release },
    update: { release },
  });
}

/** Staff ADMIN real (não o usuário fake do dev open access) vê módulos ocultos em preview. */
export const isModuleStaff = cache(async (): Promise<boolean> => {
  const internal = await getInternalUser();
  return Boolean(internal && internal.id !== "atrako-open-access" && internal.role === "ADMIN");
});

async function loadExplicit(workspaceId: string) {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { clienteId: workspaceId },
    select: { modulesEnabled: true },
  });
  return readExplicitModules(settings?.modulesEnabled);
}

async function buildMap(workspaceId: string, isStaff: boolean): Promise<ModulesMap> {
  const [releases, explicit] = await Promise.all([getModuleReleases(), loadExplicit(workspaceId)]);
  return Object.fromEntries(
    MODULES.map((m) => [m.key, resolveModuleState(m, releases[m.key], explicit[m.key], isStaff)]),
  ) as ModulesMap;
}

/** Mapa efetivo para o usuário da request (staff ganha preview dos ocultos). */
export const resolveModules = cache(async (workspaceId: string): Promise<ModulesMap> => {
  return buildMap(workspaceId, await isModuleStaff());
});

/** Mapa efetivo para visitantes de páginas públicas (sem preview de staff). */
export const resolvePublicModules = cache(async (workspaceId: string): Promise<ModulesMap> => {
  return buildMap(workspaceId, false);
});

export async function isModuleEnabled(workspaceId: string, key: ModuleKey): Promise<boolean> {
  return (await resolveModules(workspaceId))[key].enabled;
}

export async function isPublicModuleEnabled(workspaceId: string, key: ModuleKey): Promise<boolean> {
  return (await resolvePublicModules(workspaceId))[key].enabled;
}

/** Guard de API (depois do requireWorkspaceAccess). Retorna 403 quando desligado. */
export async function requireModuleApi(
  workspaceId: string,
  key: ModuleKey,
): Promise<NextResponse | null> {
  if (await isModuleEnabled(workspaceId, key)) return null;
  return NextResponse.json(
    { error: "module_disabled", module: key, message: `${getModuleDef(key).label} está desativado neste workspace.` },
    { status: 403 },
  );
}

export type ModulesPatchResult =
  | { ok: true; patch: Partial<Record<ModuleKey, boolean>> }
  | { ok: false; error: string };

/** Valida `modulesEnabled` do PATCH: só chaves do registro, sem núcleo nem ocultos. */
export async function sanitizeModulesPatch(raw: unknown): Promise<ModulesPatchResult> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "modulesEnabled inválido" };
  }
  const releases = await getModuleReleases();
  const patch: Partial<Record<ModuleKey, boolean>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isModuleKey(k)) return { ok: false, error: `Módulo desconhecido: ${k}` };
    if (typeof v !== "boolean") return { ok: false, error: `Valor inválido para ${k}` };
    const def = getModuleDef(k);
    if (def.core) return { ok: false, error: `${def.label} faz parte do núcleo e não pode ser desligado` };
    if (releases[k] === "HIDDEN") return { ok: false, error: `${def.label} não está disponível` };
    patch[k] = v;
  }
  return { ok: true, patch };
}

export type { ModuleState, ModulesMap };
