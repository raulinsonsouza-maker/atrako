import assert from "node:assert/strict";
import test from "node:test";
import {
  asShippingRules,
  findShippingZone,
  normalizeCep,
  quoteShipping,
  type ShippingRules,
} from "../lib/commerce/shipping";

const rules: ShippingRules = {
  pickupEnabled: true,
  shipEnabled: true,
  freeShippingMinCents: 20000,
  defaultFeeCents: 2500,
  defaultDaysMin: 7,
  defaultDaysMax: 12,
  zones: [
    {
      id: "sp-cap",
      name: "Capital SP",
      cepFrom: "01000000",
      cepTo: "05999999",
      feeCents: 1200,
      daysMin: 2,
      daysMax: 4,
      active: true,
    },
    {
      id: "inactive",
      name: "Inativa",
      cepFrom: "20000000",
      cepTo: "29999999",
      feeCents: 900,
      daysMin: 1,
      daysMax: 2,
      active: false,
    },
  ],
};

test("normaliza CEP", () => {
  assert.equal(normalizeCep("01310-100"), "01310100");
  assert.equal(normalizeCep("1310"), null);
});

test("encontra zona ativa por faixa", () => {
  const zone = findShippingZone(rules, "01310-100");
  assert.equal(zone?.id, "sp-cap");
  assert.equal(findShippingZone(rules, "22041-080"), null);
});

test("cota frete da zona e aplica frete grátis", () => {
  const paid = quoteShipping({
    rules,
    fulfillment: "SHIP",
    cep: "01310100",
    subtotalCents: 5000,
  });
  assert.equal(paid.available, true);
  if (paid.available) {
    assert.equal(paid.feeCents, 1200);
    assert.equal(paid.zoneName, "Capital SP");
    assert.equal(paid.freeShippingApplied, false);
  }

  const free = quoteShipping({
    rules,
    fulfillment: "SHIP",
    cep: "01310100",
    subtotalCents: 25000,
  });
  assert.equal(free.available, true);
  if (free.available) {
    assert.equal(free.feeCents, 0);
    assert.equal(free.freeShippingApplied, true);
    assert.equal(free.discountCents, 1200);
  }
});

test("usa fallback quando CEP não casa", () => {
  const q = quoteShipping({
    rules,
    fulfillment: "SHIP",
    cep: "80010000",
    subtotalCents: 1000,
  });
  assert.equal(q.available, true);
  if (q.available) {
    assert.equal(q.feeCents, 2500);
    assert.equal(q.zoneId, null);
  }
});

test("rejeita CEP fora e sem fallback", () => {
  const noDefault = { ...rules, defaultFeeCents: null };
  const q = quoteShipping({
    rules: noDefault,
    fulfillment: "SHIP",
    cep: "80010000",
    subtotalCents: 1000,
  });
  assert.equal(q.available, false);
});

test("pickup zera frete", () => {
  const q = quoteShipping({
    rules,
    fulfillment: "PICKUP",
    subtotalCents: 1000,
  });
  assert.equal(q.available, true);
  if (q.available) assert.equal(q.feeCents, 0);
});

test("asShippingRules filtra zonas inválidas", () => {
  const parsed = asShippingRules({
    zones: [
      { name: "Ok", cepFrom: "01000-000", cepTo: "01999-999", feeCents: 1000 },
      { name: "Invertida", cepFrom: "90000000", cepTo: "10000000", feeCents: 1 },
    ],
  });
  assert.equal(parsed.zones.length, 1);
  assert.equal(parsed.zones[0].cepFrom, "01000000");
});
