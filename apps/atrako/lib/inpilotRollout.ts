/**
 * Pure rollout policy helpers. Keep this module free of database/framework
 * imports so the fail-closed behavior can be tested without a running app.
 */

export const INPILOT_ROLLOUT_CONFIG_KEY = "inpilot_rollout_v1";
export const MAX_INPILOT_ALLOWLIST_SIZE = 100;
export const MAX_INPILOT_ID_LENGTH = 160;

export type InPilotRolloutConfig = {
  enabled: boolean;
  allowAllClients: boolean;
  allowedInternalUserIds: string[];
  allowedClientIds: string[];
  revision: number;
};

export type InPilotRolloutSelection = Omit<InPilotRolloutConfig, "revision">;

export type InPilotRolloutCasInput = {
  current: Pick<InPilotRolloutConfig, "enabled" | "allowAllClients" | "revision">;
  expectedRevision: unknown;
  nextEnabled: boolean;
  nextAllowAllClients: boolean;
  confirmedEnableGlobal: boolean;
  confirmedEnableAllClients: boolean;
};

export type InPilotRolloutCasDecision =
  | { ok: true; nextRevision: number }
  | { ok: false; reason: "invalid_revision" | "stale_revision" | "confirmation_required" | "all_clients_confirmation_required" };

export type InPilotAccessFactors = {
  globalEnabled: boolean;
  userId: string;
  allowedInternalUserIds: readonly string[];
  clientId: string;
  allowAllClients: boolean;
  allowedClientIds: readonly string[];
  internalUserActive: boolean;
  internalUserRole: string;
  clientActive: boolean;
  clientInPilotEnabled: boolean;
};

const ID_PATTERN = /^[a-zA-Z0-9:_-]+$/;

function cleanIdList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_INPILOT_ALLOWLIST_SIZE) return null;
  const ids = value.map((item) => typeof item === "string" ? item.trim() : "");
  if (ids.some((id) => !id || id.length > MAX_INPILOT_ID_LENGTH || !ID_PATTERN.test(id))) return null;
  return [...new Set(ids)];
}

/**
 * Parses the persisted JSON value. Any malformed, missing, or structurally
 * unexpected value is disabled rather than interpreted permissively.
 */
export function parseInPilotRolloutConfig(value: unknown): InPilotRolloutConfig | null {
  let candidate: unknown = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const record = candidate as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const legacyKeys = ["allowedClientIds", "allowedInternalUserIds", "enabled"];
  const currentKeys = [...legacyKeys, "allowAllClients", "revision"].sort();
  const isLegacy = keys.length === legacyKeys.length && keys.every((key, index) => key === legacyKeys[index]);
  const isCurrent = keys.length === currentKeys.length && keys.every((key, index) => key === currentKeys[index]);
  if (!isLegacy && !isCurrent) {
    return null;
  }
  if (typeof record.enabled !== "boolean") return null;
  if (isCurrent && typeof record.allowAllClients !== "boolean") return null;
  const allowedInternalUserIds = cleanIdList(record.allowedInternalUserIds);
  const allowedClientIds = cleanIdList(record.allowedClientIds);
  if (!allowedInternalUserIds || !allowedClientIds) return null;
  if (isLegacy) {
    // A pre-revision record cannot be safely compared against a write from an
    // admin tab. Treat it as the disabled revision-zero state.
    return { enabled: false, allowAllClients: false, allowedInternalUserIds: [], allowedClientIds: [], revision: 0 };
  }
  if (
    typeof record.revision !== "number"
    || !Number.isSafeInteger(record.revision)
    || record.revision < 0
  ) return null;
  return {
    enabled: record.enabled,
    allowAllClients: record.allowAllClients as boolean,
    allowedInternalUserIds,
    allowedClientIds,
    revision: record.revision,
  };
}

/**
 * The policy is intentionally an explicit AND of every factor. Roles are
 * checked here as defense in depth even though route auth also checks them.
 */
export function hasEffectiveInPilotAccess(factors: InPilotAccessFactors): boolean {
  return factors.globalEnabled
    && factors.allowedInternalUserIds.includes(factors.userId)
    && (factors.allowAllClients || factors.allowedClientIds.includes(factors.clientId))
    && factors.internalUserActive
    && (factors.internalUserRole === "ADMIN" || factors.internalUserRole === "ANALYST")
    && factors.clientActive
    && factors.clientInPilotEnabled;
}

export function disabledInPilotConfig(): InPilotRolloutConfig {
  return { enabled: false, allowAllClients: false, allowedInternalUserIds: [], allowedClientIds: [], revision: 0 };
}

export function validateInPilotRolloutInput(value: unknown): InPilotRolloutSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Configuração do rollout inválida");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 4 || keys.some((key, index) => key !== ["allowAllClients", "allowedClientIds", "allowedInternalUserIds", "enabled"][index])) {
    throw new Error("Configuração do rollout inválida");
  }
  const parsed = parseInPilotRolloutConfig({ ...record, revision: 0 });
  if (!parsed) throw new Error("Configuração do rollout inválida");
  return {
    enabled: parsed.enabled,
    allowAllClients: parsed.allowAllClients,
    allowedInternalUserIds: parsed.allowedInternalUserIds,
    allowedClientIds: parsed.allowedClientIds,
  };
}

/**
 * Pure compare-and-swap decision. The database transaction must re-read the
 * current record while holding the rollout lock before applying this result.
 */
export function decideInPilotRolloutCas(input: InPilotRolloutCasInput): InPilotRolloutCasDecision {
  if (
    typeof input.expectedRevision !== "number"
    || !Number.isSafeInteger(input.expectedRevision)
    || input.expectedRevision < 0
  ) return { ok: false, reason: "invalid_revision" };
  if (input.expectedRevision !== input.current.revision) {
    return { ok: false, reason: "stale_revision" };
  }
  if (input.nextEnabled && !input.current.enabled && input.confirmedEnableGlobal !== true) {
    return { ok: false, reason: "confirmation_required" };
  }
  if (input.nextAllowAllClients && !input.current.allowAllClients && input.confirmedEnableAllClients !== true) {
    return { ok: false, reason: "all_clients_confirmation_required" };
  }
  if (!Number.isSafeInteger(input.current.revision) || input.current.revision >= Number.MAX_SAFE_INTEGER) {
    return { ok: false, reason: "invalid_revision" };
  }
  return { ok: true, nextRevision: input.current.revision + 1 };
}