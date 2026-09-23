import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLoginThrottleIdentifiers,
  clearLoginFailures,
  hashPassword,
  hashLoginBucketKey,
  hashSessionToken,
  isInternalBootstrapEligible,
  isLegacyBootstrapCandidate,
  isPasswordHashCurrent,
  isPendingBootstrapRecoveryCandidate,
  isSessionExpired,
  nextThrottleBucketState,
  normalizeUsername,
  validatePassword,
  verifyPassword,
} from "../lib/authSecurity";
import { hasMachineCredential, isSameOrigin, shouldRequireSameOrigin } from "../lib/requestSecurity";
import { allowsAnonymousClienteRead } from "../lib/clienteAccessPolicy";

test("normalizes and validates local usernames", () => {
  assert.equal(normalizeUsername("  Alice.Admin "), "alice.admin");
  assert.equal(normalizeUsername("ab"), null);
  assert.equal(normalizeUsername("bad name"), null);
  assert.equal(normalizeUsername("équipe"), null);
});

test("hashes and verifies passwords with a versioned scrypt hash", async () => {
  const hash = await hashPassword("a-long-password-123");
  assert.match(hash, /^scrypt-v1\$32768,8,1\$/);
  assert.equal(await verifyPassword("a-long-password-123", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
  assert.equal(await verifyPassword("anything", null), false);
});

test("session tokens are represented by one-way SHA-256 digests", () => {
  const first = hashSessionToken("opaque-token");
  assert.equal(first, hashSessionToken("opaque-token"));
  assert.notEqual(first, "opaque-token");
  assert.equal(first.length, 64);
});

test("bootstrap requires exact explicit credentials", () => {
  const input = {
    flag: "true",
    configuredUsername: "Admin.Root",
    attemptedUsername: "admin.root",
    configuredPassword: "a-strong-bootstrap-password",
    attemptedPassword: "a-strong-bootstrap-password",
  };
  assert.equal(isInternalBootstrapEligible(input), true);
  assert.equal(isInternalBootstrapEligible({ ...input, flag: true }), false);
  assert.equal(isInternalBootstrapEligible({ ...input, attemptedPassword: "wrong" }), false);
  assert.equal(isInternalBootstrapEligible({ ...input, configuredUsername: "bad name" }), false);
});

test("legacy bootstrap only adopts an explicitly selected empty admin row", () => {
  assert.equal(isLegacyBootstrapCandidate({
    active: true, role: "ADMIN", username: null, passwordHash: null,
  }), true);
  assert.equal(isLegacyBootstrapCandidate({
    active: false, role: "ADMIN", username: null, passwordHash: null,
  }), false);
  assert.equal(isLegacyBootstrapCandidate({
    active: true, role: "ANALYST", username: null, passwordHash: null,
  }), false);
  assert.equal(isLegacyBootstrapCandidate({
    active: true, role: "ADMIN", username: null, passwordHash: "existing",
  }), false);
});

test("bootstrap password recovery accepts only the active selected admin", () => {
  const pending = {
    active: true,
    role: "ADMIN",
    username: "raul",
    passwordHash: "scrypt-v1$existing",
    failedLoginCount: 5,
    mustChangePassword: true,
    passwordChangedAt: null,
  };
  assert.equal(isPendingBootstrapRecoveryCandidate(pending, "raul"), true);
  assert.equal(isPendingBootstrapRecoveryCandidate({ ...pending, mustChangePassword: false }, "raul"), true);
  assert.equal(isPendingBootstrapRecoveryCandidate({ ...pending, passwordChangedAt: new Date() }, "raul"), true);
  assert.equal(isPendingBootstrapRecoveryCandidate(pending, "outro"), false);
  assert.equal(isPendingBootstrapRecoveryCandidate({ ...pending, active: false }, "raul"), false);
  assert.equal(isPendingBootstrapRecoveryCandidate({ ...pending, role: "ANALYST" }, "raul"), false);
  assert.equal(isPendingBootstrapRecoveryCandidate({ ...pending, failedLoginCount: 0 }, "raul"), false);
});

test("session expiry honors revocation, idle, and absolute deadlines", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const valid = {
    revokedAt: null,
    idleExpiresAt: new Date("2026-01-01T01:00:00Z"),
    absoluteExpiresAt: new Date("2026-01-02T00:00:00Z"),
  };
  assert.equal(isSessionExpired(valid, now), false);
  assert.equal(isSessionExpired({ ...valid, revokedAt: now }, now), true);
  assert.equal(isSessionExpired({ ...valid, idleExpiresAt: now }, now), true);
  assert.equal(isSessionExpired({ ...valid, absoluteExpiresAt: now }, now), true);
});

test("password verification is invalidated when the stored hash version changes", () => {
  assert.equal(isPasswordHashCurrent("hash-v1", "hash-v1"), true);
  assert.equal(isPasswordHashCurrent("hash-v1", "hash-v2"), false);
  assert.equal(isPasswordHashCurrent(null, null), false);
});

test("successful login clears legacy failure state", () => {
  assert.deepEqual(clearLoginFailures(), {
    failedLoginCount: 0,
    failureWindowStartedAt: null,
    lockedUntil: null,
  });
});

test("password policy requires eight characters, uppercase and special character", () => {
  assert.equal(validatePassword("Abcdef!1", "admin"), null);
  assert.equal(validatePassword("Ábcdef!1", "admin"), null);
  assert.ok(validatePassword("Abc!123", "admin"));
  assert.ok(validatePassword("abcdef!1", "admin"));
  assert.ok(validatePassword("Abcdefg1", "admin"));
});

test("unsafe requests require a matching browser origin", () => {
  assert.equal(isSameOrigin(new Request("https://app.example.test/api/auth/login", {
    headers: { origin: "https://app.example.test" },
  })), true);
  assert.equal(isSameOrigin(new Request("https://app.example.test/api/auth/login", {
    headers: { origin: "https://evil.example.test" },
  })), false);
  assert.equal(isSameOrigin(new Request("https://app.example.test/api/auth/login")), false);
});

test("same-origin accepts the public host preserved by a reverse proxy", () => {
  assert.equal(isSameOrigin(new Request("http://127.0.0.1:5000/api/auth/login", {
    method: "POST",
    headers: {
      origin: "https://preview.example.test",
      host: "preview.example.test",
    },
  })), true);
});

test("login throttle keys are HMAC digests and bucket limits are bounded", () => {
  const first = hashLoginBucketKey("ip-username", "192.0.2.1\0alice", "test-session-secret");
  const second = hashLoginBucketKey("ip-username", "192.0.2.1\0alice", "test-session-secret");
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, "192.0.2.1");
  const trusted = buildLoginThrottleIdentifiers("192.0.2.1", "alice", "test-session-secret");
  assert.equal(trusted.hasTrustedIp, true);
  assert.ok(trusted.ipHash);
  const fallback = buildLoginThrottleIdentifiers(null, "alice", "test-session-secret");
  assert.equal(fallback.hasTrustedIp, false);
  assert.equal(fallback.ipHash, null);
  assert.notEqual(fallback.ipUsernameHash, trusted.ipUsernameHash);
  const now = new Date("2026-01-01T00:00:00Z");
  const state = nextThrottleBucketState({ windowStartedAt: now, attemptCount: 8 }, now, 8);
  assert.equal(state.allowed, false);
  assert.ok(state.retryAfterSeconds > 0);
  assert.equal(nextThrottleBucketState(state.state, new Date("2026-01-01T00:16:00Z"), 8).state.attemptCount, 1);
});

test("middleware origin policy covers browser mutations and exact machine exemptions", () => {
  assert.equal(shouldRequireSameOrigin("/api/admin/users", "POST", true), true);
  assert.equal(shouldRequireSameOrigin("/api/admin/users", "GET", true), false);
  const cookieFallback = new Request("https://app.example.test/api/sync/daily-global", {
    headers: { cookie: "__Host-inout_session=opaque" },
  });
  assert.equal(hasMachineCredential("/api/sync/daily-global", cookieFallback), false);
  assert.equal(shouldRequireSameOrigin("/api/sync/daily-global", "POST", true, cookieFallback), true);
  const machineHeader = new Request("https://app.example.test/api/sync/daily-global", {
    headers: { "x-cron-token": "machine-secret" },
  });
  assert.equal(hasMachineCredential("/api/sync/daily-global", machineHeader), true);
  assert.equal(shouldRequireSameOrigin("/api/sync/daily-global", "POST", true, machineHeader), false);
  const queryMachine = new Request("https://app.example.test/api/sync/meta?token=machine-secret", {
    method: "POST",
  });
  assert.equal(hasMachineCredential("/api/sync/meta", queryMachine), true);
  assert.equal(shouldRequireSameOrigin("/api/sync/meta", "POST", true, queryMachine), false);
  const unsupportedQuery = new Request("https://app.example.test/api/sync/daily-global?token=machine-secret", {
    method: "POST",
  });
  assert.equal(hasMachineCredential("/api/sync/daily-global", unsupportedQuery), false);
  assert.equal(shouldRequireSameOrigin("/api/sync/daily-global", "POST", true, unsupportedQuery), true);
  assert.equal(shouldRequireSameOrigin("/api/admin/users", "POST", false), false);
});

test("client reads deny anonymous access unless the endpoint explicitly opts into public-read", () => {
  assert.equal(allowsAnonymousClienteRead("read", false), false);
  assert.equal(allowsAnonymousClienteRead("write", false), false);
  assert.equal(allowsAnonymousClienteRead("public-read", false), true);
  // A cookie must go through portal-session validation, never anonymous mode.
  assert.equal(allowsAnonymousClienteRead("public-read", true), false);
});