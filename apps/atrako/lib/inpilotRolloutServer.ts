import "server-only";

import { prisma } from "@/lib/db";
import {
  disabledInPilotConfig,
  hasEffectiveInPilotAccess,
  INPILOT_ROLLOUT_CONFIG_KEY,
  parseInPilotRolloutConfig,
  type InPilotRolloutConfig,
  type InPilotRolloutSelection,
} from "@/lib/inpilotRollout";
import type { InternalUser } from "@/lib/generated/prisma";

export async function getInPilotRolloutConfig(): Promise<InPilotRolloutConfig> {
  const row = await prisma.systemConfig.findUnique({ where: { key: INPILOT_ROLLOUT_CONFIG_KEY } });
  // A missing or malformed record is deliberately indistinguishable from OFF.
  return parseInPilotRolloutConfig(row?.value) ?? disabledInPilotConfig();
}

export function serializeInPilotRolloutConfig(config: InPilotRolloutConfig) {
  return JSON.stringify({
    enabled: config.enabled,
    allowAllClients: config.allowAllClients,
    allowedInternalUserIds: config.allowedInternalUserIds,
    allowedClientIds: config.allowedClientIds,
    revision: config.revision,
  });
}

export function configWithRevision(selection: InPilotRolloutSelection, revision: number): InPilotRolloutConfig {
  return { ...selection, revision };
}

export async function hasEffectiveInPilotAccessFor(
  internalUser: Pick<InternalUser, "id" | "active" | "role">,
  cliente: { id: string; ativo: boolean; inPilotEnabled: boolean },
) {
  const config = await getInPilotRolloutConfig();
  return hasEffectiveInPilotAccess({
    globalEnabled: config.enabled,
    userId: internalUser.id,
    allowedInternalUserIds: config.allowedInternalUserIds,
    clientId: cliente.id,
    allowAllClients: config.allowAllClients,
    allowedClientIds: config.allowedClientIds,
    internalUserActive: internalUser.active,
    internalUserRole: internalUser.role,
    clientActive: cliente.ativo,
    clientInPilotEnabled: cliente.inPilotEnabled,
  });
}