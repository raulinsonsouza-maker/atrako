import assert from "node:assert/strict";
import test from "node:test";
import {
  digestOAuthState,
  isOAuthStateUsable,
  OAUTH_STATE_TTL_MS,
} from "../lib/oauthStateSecurity";

test("OAuth state digest is deterministic and does not equal the bearer state", () => {
  const state = "opaque-random-state";
  const digest = digestOAuthState(state);
  assert.equal(digest, digestOAuthState(state));
  assert.notEqual(digest, state);
  assert.match(digest, /^[a-f0-9]{64}$/);
});

test("OAuth state validity binds provider, expiry, and single-use consumption", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const valid = {
    provider: "rd-station",
    expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS),
    consumedAt: null,
  };

  assert.equal(isOAuthStateUsable(valid, "rd-station", now), true);
  assert.equal(isOAuthStateUsable(valid, "rd-marketing", now), false);
  assert.equal(
    isOAuthStateUsable({ ...valid, expiresAt: now }, "rd-station", now),
    false,
  );
  assert.equal(
    isOAuthStateUsable({ ...valid, consumedAt: now }, "rd-station", now),
    false,
  );
});