import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowsAnonymousClienteRead } from "../lib/clienteAccessPolicy";
import {
  PLATFORM_APP_PROVIDERS,
  isPlatformAppProvider,
} from "../lib/config/platformAppProviders";

describe("isolation access policy", () => {
  it("denies anonymous write and authenticated-portal public-read", () => {
    assert.equal(allowsAnonymousClienteRead("public-read", false), true);
    assert.equal(allowsAnonymousClienteRead("public-read", true), false);
    assert.equal(allowsAnonymousClienteRead("read", false), false);
    assert.equal(allowsAnonymousClienteRead("write", false), false);
  });

  it("platform catalog is closed and typed", () => {
    assert.ok(PLATFORM_APP_PROVIDERS.length >= 8);
    assert.equal(isPlatformAppProvider("META"), true);
    assert.equal(isPlatformAppProvider("random"), false);
  });
});
