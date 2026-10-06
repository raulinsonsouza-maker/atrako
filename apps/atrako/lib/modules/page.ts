import "server-only";

import { assertCanManageConfig, getActiveWorkspaceId } from "@/lib/tenancy/workspace";
import {
  getModuleReleases,
  isModuleStaff,
  resolveModules,
  type ModuleState,
} from "@/lib/modules/resolve";
import { getModuleDef, resolveModuleState, type ModuleKey } from "@/lib/modules/registry";

export type ModulePageGate =
  | { ok: true; workspaceId: string; state: ModuleState }
  | { ok: false; workspaceId: string | null; state: ModuleState | null; canManage: boolean };

/** Gate de página: resolve o workspace ativo e diz se o módulo pode ser exibido. */
export async function requireModulePage(key: ModuleKey): Promise<ModulePageGate> {
  const workspaceId = await getActiveWorkspaceId();
  // Sem workspace a própria página trata o onboarding; só o release global vale.
  if (!workspaceId) {
    const def = getModuleDef(key);
    const state = resolveModuleState(def, (await getModuleReleases())[key], true, await isModuleStaff());
    return state.enabled
      ? { ok: true, workspaceId: "", state }
      : { ok: false, workspaceId: null, state, canManage: false };
  }

  const state = (await resolveModules(workspaceId))[key];
  if (state.enabled) return { ok: true, workspaceId, state };

  let canManage = false;
  try {
    await assertCanManageConfig(workspaceId);
    canManage = true;
  } catch {
    canManage = false;
  }
  return { ok: false, workspaceId, state, canManage };
}

/** Módulo ligado no workspace ativo (cookie) — para áreas sem workspaceId explícito (Social). */
export async function isActiveModuleEnabled(key: ModuleKey): Promise<boolean> {
  return (await requireModulePage(key)).ok;
}
