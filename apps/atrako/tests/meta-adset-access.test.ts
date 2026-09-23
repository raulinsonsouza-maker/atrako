import assert from "node:assert/strict";
import test from "node:test";
import { isValidMetaAdsetId } from "../lib/meta/adsetId";

test("accepts only numeric Meta ad set identifiers", () => {
  assert.equal(isValidMetaAdsetId("120210987654321"), true);
  assert.equal(isValidMetaAdsetId(""), false);
  assert.equal(isValidMetaAdsetId("12021:other-client"), false);
  assert.equal(isValidMetaAdsetId("../config"), false);
});

test("rejects oversized Meta ad set identifiers", () => {
  assert.equal(isValidMetaAdsetId("1".repeat(64)), true);
  assert.equal(isValidMetaAdsetId("1".repeat(65)), false);
});