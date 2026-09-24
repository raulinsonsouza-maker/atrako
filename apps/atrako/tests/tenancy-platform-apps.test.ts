import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowsAnonymousClienteRead } from "../lib/clienteAccessPolicy";

describe("tenancy policy", () => {
  it("public-read anonymous only without portal cookie", () => {
    assert.equal(allowsAnonymousClienteRead("public-read", false), true);
    assert.equal(allowsAnonymousClienteRead("public-read", true), false);
    assert.equal(allowsAnonymousClienteRead("read", false), false);
    assert.equal(allowsAnonymousClienteRead("write", false), false);
  });
});

describe("platform app providers", () => {
  it("lists canonical providers", async () => {
    const { PLATFORM_APP_PROVIDERS, isPlatformAppProvider } = await import(
      "../lib/config/platformAppProviders"
    );
    assert.ok(PLATFORM_APP_PROVIDERS.includes("META"));
    assert.ok(PLATFORM_APP_PROVIDERS.includes("MERCADO_PAGO"));
    assert.ok(PLATFORM_APP_PROVIDERS.includes("GOOGLE_ADS"));
    assert.ok(PLATFORM_APP_PROVIDERS.includes("LINKEDIN"));
    assert.ok(PLATFORM_APP_PROVIDERS.includes("SHOPIFY"));
    assert.ok(PLATFORM_APP_PROVIDERS.includes("SHOPEE"));
    assert.ok(PLATFORM_APP_PROVIDERS.includes("TRAY"));
    assert.ok(PLATFORM_APP_PROVIDERS.includes("NUVEMSHOP"));
    assert.ok(isPlatformAppProvider("SHOPEE"));
    assert.ok(isPlatformAppProvider("SHOPIFY"));
    assert.ok(isPlatformAppProvider("TRAY"));
    assert.ok(isPlatformAppProvider("NUVEMSHOP"));
    assert.equal(isPlatformAppProvider("TIKTOK"), true);
    assert.equal(isPlatformAppProvider("NOPE"), false);
  });
});

describe("connection providers include calendar", () => {
  it("GOOGLE_CALENDAR is a connection provider", async () => {
    const { CONNECTION_PROVIDERS, isConnectionProvider } = await import(
      "../lib/atrako/workspace-connections"
    );
    assert.ok(CONNECTION_PROVIDERS.includes("GOOGLE_CALENDAR"));
    assert.ok(CONNECTION_PROVIDERS.includes("SHOPIFY"));
    assert.ok(CONNECTION_PROVIDERS.includes("SHOPEE"));
    assert.ok(CONNECTION_PROVIDERS.includes("TRAY"));
    assert.ok(CONNECTION_PROVIDERS.includes("NUVEMSHOP"));
    assert.ok(isConnectionProvider("SHOPEE"));
    assert.ok(isConnectionProvider("SHOPIFY"));
    assert.ok(isConnectionProvider("TRAY"));
    assert.ok(isConnectionProvider("NUVEMSHOP"));
    assert.equal(isConnectionProvider("GOOGLE_ADS"), true);
    assert.equal(isConnectionProvider("LINKEDIN_ADS"), true);
  });
});
