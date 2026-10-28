import assert from "node:assert/strict";
import test from "node:test";
import { createDmLinkToken, isDmLinkPrefetch, safeHttpUrl, verifyDmLinkToken } from "../lib/instagram/dmLinkToken";

test("link do Direct: token assinado abre a mesma url", () => {
  const now = Date.parse("2026-10-28T18:00:00Z");
  const token = createDmLinkToken(
    { fluxoId: "flow", contatoId: "contact", index: 1, url: "https://lp.regicenter.com" },
    now,
  );
  const payload = verifyDmLinkToken(token, now + 1000);
  assert.equal(payload?.f, "flow");
  assert.equal(payload?.c, "contact");
  assert.equal(payload?.i, 1);
  assert.equal(payload?.u, "https://lp.regicenter.com");
  assert.equal(verifyDmLinkToken(token, now + 8 * 24 * 60 * 60 * 1000), null);
  assert.equal(verifyDmLinkToken(`${token}x`, now), null);
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("https://lp.regicenter.com/"), "https://lp.regicenter.com/");
});

test("link do Direct: prefetch e robô não disparam o obrigado", () => {
  const headers = (values: Record<string, string>) => ({
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  });
  assert.equal(isDmLinkPrefetch(headers({}), "GET"), false);
  assert.equal(isDmLinkPrefetch(headers({}), "HEAD"), true);
  assert.equal(isDmLinkPrefetch(headers({ purpose: "prefetch" }), "GET"), true);
  assert.equal(isDmLinkPrefetch(headers({ "user-agent": "facebookexternalhit/1.1" }), "GET"), true);
  assert.equal(isDmLinkPrefetch(headers({ "user-agent": "Mozilla/5.0 Instagram 350.0" }), "GET"), false);
});
