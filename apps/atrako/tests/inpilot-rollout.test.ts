import test from "node:test";
import assert from "node:assert/strict";
import {
  decideInPilotRolloutCas,
  hasEffectiveInPilotAccess,
  parseInPilotRolloutConfig,
} from "../lib/inpilotRollout";

const base = {
  globalEnabled: true,
  userId: "user_1",
  allowedInternalUserIds: ["user_1"],
  clientId: "client_1",
  allowAllClients: false,
  allowedClientIds: ["client_1"],
  internalUserActive: true,
  internalUserRole: "ANALYST",
  clientActive: true,
  clientInPilotEnabled: true,
};

test("rollout parser fails closed for missing and malformed values", () => {
  assert.equal(parseInPilotRolloutConfig(undefined), null);
  assert.equal(parseInPilotRolloutConfig("{not-json"), null);
  assert.equal(parseInPilotRolloutConfig({ enabled: "true", allowedInternalUserIds: [], allowedClientIds: [] }), null);
  assert.deepEqual(parseInPilotRolloutConfig({
    enabled: true,
    allowedInternalUserIds: ["user_1", "user_1"],
    allowedClientIds: ["client_1"],
  }), {
    enabled: false,
    allowAllClients: false,
    allowedInternalUserIds: [],
    allowedClientIds: [],
    revision: 0,
  });
  assert.equal(parseInPilotRolloutConfig({
    enabled: true,
    allowedInternalUserIds: ["user_1"],
    allowedClientIds: ["client_1"],
    revision: 4,
  }), null);
  assert.equal(parseInPilotRolloutConfig({
    enabled: true,
    allowAllClients: false,
    allowedInternalUserIds: ["user_1"],
    allowedClientIds: ["client_1"],
    revision: 4,
  })?.revision, 4);
  assert.equal(parseInPilotRolloutConfig({
    enabled: true,
    allowAllClients: false,
    allowedInternalUserIds: ["user_1"],
    allowedClientIds: ["client_1"],
    revision: -1,
  }), null);
});

test("effective access requires every rollout factor", () => {
  assert.equal(hasEffectiveInPilotAccess(base), true);
  for (const key of [
    "globalEnabled",
    "internalUserActive",
    "clientActive",
    "clientInPilotEnabled",
  ] as const) {
    assert.equal(hasEffectiveInPilotAccess({ ...base, [key]: false }), false, key);
  }
  assert.equal(hasEffectiveInPilotAccess({ ...base, userId: "other_user" }), false);
  assert.equal(hasEffectiveInPilotAccess({ ...base, clientId: "other_client" }), false);
  assert.equal(hasEffectiveInPilotAccess({ ...base, allowAllClients: true, clientId: "other_client" }), true);
  assert.equal(hasEffectiveInPilotAccess({ ...base, internalUserRole: "GUEST" }), false);
});

test("rollout CAS rejects stale saves after another admin disables it", () => {
  assert.deepEqual(decideInPilotRolloutCas({
    current: { enabled: false, allowAllClients: false, revision: 2 },
    expectedRevision: 1,
    nextEnabled: true,
    nextAllowAllClients: false,
    confirmedEnableGlobal: true,
    confirmedEnableAllClients: false,
  }), { ok: false, reason: "stale_revision" });
  assert.deepEqual(decideInPilotRolloutCas({
    current: { enabled: false, allowAllClients: false, revision: 2 },
    expectedRevision: 2,
    nextEnabled: true,
    nextAllowAllClients: false,
    confirmedEnableGlobal: false,
    confirmedEnableAllClients: false,
  }), { ok: false, reason: "confirmation_required" });
  assert.deepEqual(decideInPilotRolloutCas({
    current: { enabled: false, allowAllClients: false, revision: 2 },
    expectedRevision: 2,
    nextEnabled: true,
    nextAllowAllClients: false,
    confirmedEnableGlobal: true,
    confirmedEnableAllClients: false,
  }), { ok: true, nextRevision: 3 });
  assert.deepEqual(decideInPilotRolloutCas({
    current: { enabled: true, allowAllClients: false, revision: 3 },
    expectedRevision: 3,
    nextEnabled: true,
    nextAllowAllClients: true,
    confirmedEnableGlobal: false,
    confirmedEnableAllClients: false,
  }), { ok: false, reason: "all_clients_confirmation_required" });
  assert.deepEqual(decideInPilotRolloutCas({
    current: { enabled: true, allowAllClients: false, revision: 3 },
    expectedRevision: 3,
    nextEnabled: true,
    nextAllowAllClients: true,
    confirmedEnableGlobal: false,
    confirmedEnableAllClients: true,
  }), { ok: true, nextRevision: 4 });
});