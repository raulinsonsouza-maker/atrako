/**
 * Motivos manuais de lead perdido — configuráveis por workspace em crmPrefs.
 */

import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import {
  DEFAULT_MANUAL_LOST_REASONS,
  RESERVED_LOST_REASON_IDS,
  normalizeManualLostReasons,
  parseManualLostReasons,
  type ManualLostReasonItem,
} from "@/lib/crm/lost-reasons-shared";

export type { ManualLostReasonItem };
export {
  DEFAULT_MANUAL_LOST_REASONS,
  RESERVED_LOST_REASON_IDS,
  normalizeManualLostReasons,
  parseManualLostReasons,
  slugifyLostReasonId,
  uniqueLostReasonId,
} from "@/lib/crm/lost-reasons-shared";

export async function getManualLostReasons(workspaceId: string): Promise<ManualLostReasonItem[]> {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { clienteId: workspaceId },
    select: { crmPrefs: true },
  });
  return parseManualLostReasons(settings?.crmPrefs) ?? [...DEFAULT_MANUAL_LOST_REASONS];
}

export async function setManualLostReasons(
  workspaceId: string,
  reasons: ManualLostReasonItem[],
): Promise<ManualLostReasonItem[]> {
  const normalized = normalizeManualLostReasons(reasons);
  const existing = await prisma.workspaceSettings.findUnique({
    where: { clienteId: workspaceId },
    select: { crmPrefs: true },
  });
  const prefs = {
    ...(existing?.crmPrefs && typeof existing.crmPrefs === "object" && !Array.isArray(existing.crmPrefs)
      ? (existing.crmPrefs as Record<string, unknown>)
      : {}),
    lostReasons: normalized,
  };
  await prisma.workspaceSettings.upsert({
    where: { clienteId: workspaceId },
    create: {
      clienteId: workspaceId,
      crmPrefs: prefs as Prisma.InputJsonValue,
    },
    update: {
      crmPrefs: prefs as Prisma.InputJsonValue,
    },
  });
  return normalized;
}

export async function isAllowedManualLostReason(
  workspaceId: string,
  value: string,
): Promise<boolean> {
  const id = value.trim();
  if (!id || RESERVED_LOST_REASON_IDS.has(id)) return false;
  const list = await getManualLostReasons(workspaceId);
  return list.some((r) => r.id === id);
}

export async function resolveManualLostReasonLabel(
  workspaceId: string,
  id: string,
): Promise<string | null> {
  const list = await getManualLostReasons(workspaceId);
  return list.find((r) => r.id === id)?.label ?? null;
}
