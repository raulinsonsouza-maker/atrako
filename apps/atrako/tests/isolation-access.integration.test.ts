import assert from "node:assert/strict";
import test from "node:test";

/**
 * Without ATRAKO_DEV_OPEN_ACCESS, anonymous API access to the client list must be denied.
 * Set PUBLIC_ACCESS_TEST_BASE_URL to run against a live server.
 */
const baseUrl = process.env.PUBLIC_ACCESS_TEST_BASE_URL;

test("anonymous GET /api/clientes is unauthorized when open-access is off", {
  skip: baseUrl ? false : "set PUBLIC_ACCESS_TEST_BASE_URL to run against a local server",
}, async () => {
  const res = await fetch(`${baseUrl}/api/clientes`, { redirect: "manual" });
  assert.ok(
    res.status === 401 || res.status === 403,
    `expected 401/403, got ${res.status}`,
  );
});

test("anonymous GET /admin/apps is redirected or forbidden at page layer", {
  skip: baseUrl ? false : "set PUBLIC_ACCESS_TEST_BASE_URL to run against a local server",
}, async () => {
  const res = await fetch(`${baseUrl}/admin/apps`, { redirect: "manual" });
  assert.ok(
    res.status === 307 || res.status === 302 || res.status === 401 || res.status === 403,
    `expected redirect/401/403, got ${res.status}`,
  );
});
