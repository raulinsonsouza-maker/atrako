import assert from "node:assert/strict";
import test from "node:test";
import {
  googleAdsFriendlyError,
  parseGoogleAdsConnectionMetadata,
} from "@/lib/googleAds/types";

test("migrates legacy customer ids without losing the selected account", () => {
  const meta = parseGoogleAdsConnectionMetadata({
    accessibleCustomerIds: ["123-456-7890"],
    customerId: "1234567890",
  });
  assert.equal(meta.accessibleCustomers.length, 1);
  assert.equal(meta.accessibleCustomers[0].id, "1234567890");
  assert.equal(meta.customerId, "1234567890");
});

test("keeps the MCC associated with each selectable child account", () => {
  const meta = parseGoogleAdsConnectionMetadata({
    accessibleCustomers: [
      { id: "1111111111", name: "Cliente A", manager: false, loginCustomerId: "9999999999" },
      { id: "2222222222", name: "Cliente B", manager: false, loginCustomerId: "9999999999" },
    ],
  });
  assert.deepEqual(meta.accessibleCustomerIds, ["1111111111", "2222222222"]);
  assert.equal(meta.accessibleCustomers[0].loginCustomerId, "9999999999");
  assert.equal(meta.needsAccountPick, true);
});

test("normalizes direct accounts without a login customer", () => {
  const meta = parseGoogleAdsConnectionMetadata({
    accessibleCustomers: [{ id: "123-456-7890", name: "Conta direta" }],
  });
  assert.equal(meta.accessibleCustomers[0].manager, false);
  assert.equal(meta.accessibleCustomers[0].loginCustomerId, null);
});

test("translates cloud access and expired credential errors", () => {
  assert.match(
    googleAdsFriendlyError("AuthorizationError.CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION"),
    /Explorer ou Basic/,
  );
  assert.match(googleAdsFriendlyError("invalid_grant"), /Reconecte/);
});
