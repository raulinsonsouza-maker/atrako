/**
 * Config do playbook em messagingPrefs.qualification.
 */

import { attendanceFromPrefs } from "@/lib/attendance/profile";
import { prisma } from "@/lib/db";
import type { QualifyFieldKey } from "./fields";
import { WA_ASK_ORDER } from "./fields";

export type QualificationPrefs = {
  enabled: boolean;
  playbookId: string;
  /** Sources que disparam o playbook (substring match em lead.source / formSlug). */
  sourceTags: string[];
  qualifyFormSlug: string;
  lpFormSlug: string;
  templateName: string | null;
  askKeys: QualifyFieldKey[];
};

const DEFAULTS: QualificationPrefs = {
  enabled: false,
  playbookId: "franchise_regicenter",
  sourceTags: ["franquia", "franchise_regicenter", "franquia-regicenter"],
  qualifyFormSlug: "franquia-regicenter-qualify",
  lpFormSlug: "franquia-regicenter-lp",
  templateName: null,
  askKeys: [...WA_ASK_ORDER],
};

export function parseQualificationPrefs(raw: unknown): QualificationPrefs {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const q = row.qualification && typeof row.qualification === "object" ? (row.qualification as Record<string, unknown>) : {};
  return {
    enabled: q.enabled === true,
    playbookId: typeof q.playbookId === "string" && q.playbookId.trim() ? q.playbookId.trim() : DEFAULTS.playbookId,
    sourceTags: Array.isArray(q.sourceTags)
      ? q.sourceTags.filter((s): s is string => typeof s === "string")
      : DEFAULTS.sourceTags,
    qualifyFormSlug:
      typeof q.qualifyFormSlug === "string" && q.qualifyFormSlug.trim()
        ? q.qualifyFormSlug.trim()
        : DEFAULTS.qualifyFormSlug,
    lpFormSlug: typeof q.lpFormSlug === "string" && q.lpFormSlug.trim() ? q.lpFormSlug.trim() : DEFAULTS.lpFormSlug,
    templateName: typeof q.templateName === "string" && q.templateName.trim() ? q.templateName.trim() : null,
    askKeys: Array.isArray(q.askKeys)
      ? (q.askKeys.filter((k): k is QualifyFieldKey => typeof k === "string") as QualifyFieldKey[])
      : DEFAULTS.askKeys,
  };
}

export async function loadQualificationPrefs(workspaceId: string): Promise<QualificationPrefs> {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { clienteId: workspaceId },
    select: { messagingPrefs: true },
  });
  return parseQualificationPrefs(settings?.messagingPrefs ?? {});
}

export function sourceMatchesPlaybook(source: string | null | undefined, prefs: QualificationPrefs) {
  const s = (source || "").toLowerCase();
  if (!s) return false;
  return prefs.sourceTags.some((tag) => s.includes(tag.toLowerCase()));
}

export function franchiseRegicenterPatch(enabled = true): Record<string, unknown> {
  return {
    qualification: {
      enabled,
      playbookId: "franchise_regicenter",
      sourceTags: ["franquia", "franchise_regicenter", "franquia-regicenter"],
      qualifyFormSlug: "franquia-regicenter-qualify",
      lpFormSlug: "franquia-regicenter-lp",
      templateName: null,
      askKeys: [...WA_ASK_ORDER],
    },
  };
}

/** Attendance + qualification merge helper for scripts. */
export function mergeMessagingPrefs(existing: unknown, patch: Record<string, unknown>) {
  const base = existing && typeof existing === "object" ? { ...(existing as object) } : {};
  const attendance = attendanceFromPrefs(existing);
  return {
    ...base,
    attendance: {
      ...((base as { attendance?: object }).attendance ?? {}),
      ...attendance,
      ...((patch.attendance as object) || {}),
    },
    qualification: {
      ...((base as { qualification?: object }).qualification ?? {}),
      ...((patch.qualification as object) || {}),
    },
  };
}
