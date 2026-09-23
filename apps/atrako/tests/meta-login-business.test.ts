import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureActPrefix,
  generateMetaAppSecretProof,
  normalizeAdAccountId,
} from "../lib/integrations/meta/graph";
import {
  META_LOGIN_CONFIG_MISSING,
  buildMetaAuthorizationUrl,
  requireMetaLoginConfigId,
} from "../lib/integrations/meta/oauth";
import { computeMetaHealth } from "../lib/integrations/meta/connection";
import { parseMetaAdsMetadata } from "../lib/integrations/meta/types";

test("normalizeAdAccountId strips act_ prefix for comparisons", () => {
  assert.equal(normalizeAdAccountId("act_123"), "123");
  assert.equal(normalizeAdAccountId("123"), "123");
  assert.equal(ensureActPrefix("123"), "act_123");
  assert.equal(ensureActPrefix("act_123"), "act_123");
});

test("appsecret_proof is HMAC-SHA256 of token with app secret", () => {
  const prev = process.env.META_APP_SECRET;
  process.env.META_APP_SECRET = "test-secret";
  const proof = generateMetaAppSecretProof("access-token");
  assert.ok(proof);
  assert.match(proof!, /^[a-f0-9]{64}$/);
  assert.notEqual(proof, "access-token");
  if (prev === undefined) delete process.env.META_APP_SECRET;
  else process.env.META_APP_SECRET = prev;
});

test("META_LOGIN_CONFIG_ID missing throws clear error", () => {
  const prev = process.env.META_LOGIN_CONFIG_ID;
  delete process.env.META_LOGIN_CONFIG_ID;
  assert.throws(() => requireMetaLoginConfigId(), (err: Error) => {
    assert.equal(err.message, META_LOGIN_CONFIG_MISSING);
    return true;
  });
  if (prev !== undefined) process.env.META_LOGIN_CONFIG_ID = prev;
});

test("buildMetaAuthorizationUrl uses config_id and code grant overrides", () => {
  const prevId = process.env.META_APP_ID;
  const prevCfg = process.env.META_LOGIN_CONFIG_ID;
  process.env.META_APP_ID = "app123";
  process.env.META_LOGIN_CONFIG_ID = "cfg456";
  const url = new URL(
    buildMetaAuthorizationUrl({
      state: "abc",
      redirectUri: "https://example.com/callback",
      systemUserFlow: true,
    }),
  );
  assert.equal(url.searchParams.get("client_id"), "app123");
  assert.equal(url.searchParams.get("config_id"), "cfg456");
  assert.equal(url.searchParams.get("state"), "abc");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("override_default_response_type"), "true");
  assert.equal(url.searchParams.get("scope"), null);
  if (prevId === undefined) delete process.env.META_APP_ID;
  else process.env.META_APP_ID = prevId;
  if (prevCfg === undefined) delete process.env.META_LOGIN_CONFIG_ID;
  else process.env.META_LOGIN_CONFIG_ID = prevCfg;
});

test("computeMetaHealth and select validation shape", () => {
  const pending = parseMetaAdsMetadata({
    adAccounts: [{ id: "111", name: "A", ownershipType: "OWNED" }],
    selectedAdAccountId: null,
  });
  assert.equal(computeMetaHealth(pending), "connected_pending_account");

  const ready = parseMetaAdsMetadata({
    adAccounts: [{ id: "111", name: "A", ownershipType: "OWNED" }],
    selectedAdAccountId: "111",
    health: "ready",
  });
  assert.equal(computeMetaHealth(ready), "ready");

  assert.equal(computeMetaHealth(ready, "NEEDS_REAUTH"), "needs_reauth");
  assert.equal(computeMetaHealth(ready, "DISCONNECTED"), "disconnected");

  const wanted = "999";
  const allowed = ready.adAccounts.some((a) => normalizeAdAccountId(a.id) === wanted);
  assert.equal(allowed, false);
});
