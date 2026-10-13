import assert from "node:assert/strict";
import test from "node:test";
import {
  asDeliveryRules,
  emptyGeocoder,
  haversineKm,
  matchBand,
  quoteDelivery,
  rulesConfigured,
  validateBands,
  type DeliveryRules,
} from "../lib/food/delivery";
import { quoteFoodOrder } from "../lib/food/quote";

const bands = [
  { minKm: 0, maxKm: 3, feeCents: 500, active: true },
  { minKm: 3, maxKm: 5, feeCents: 700, active: true },
  { minKm: 5, maxKm: 10, feeCents: 1000, active: true },
  { minKm: 10, maxKm: 15, feeCents: 1500, active: true },
];

const rules: DeliveryRules = {
  lat: -23.5505,
  lng: -46.6333,
  maxKm: 15,
  freeDeliveryEnabled: false,
  freeDeliveryMinCents: 0,
  bands,
};

test("haversine entre dois pontos conhecidos no equador", () => {
  const km = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
  assert.ok(Math.abs(km - 111.19) < 0.02);
});

test("coordenada inválida e casa sem ponto não viram distância", () => {
  assert.equal(rulesConfigured(asDeliveryRules({})), false);
  const flat = quoteDelivery({
    rules: asDeliveryRules({}),
    fulfillment: "DELIVERY",
    deliveryEnabled: true,
    flatFeeCents: 500,
    subtotalCents: 2000,
    destination: null,
  });
  assert.equal(flat.ok && flat.snapshot.method, "taxa_fixa");
  assert.equal(flat.ok && flat.snapshot.feeCents, 500);
  const missing = quoteDelivery({
    rules,
    fulfillment: "DELIVERY",
    deliveryEnabled: true,
    flatFeeCents: 500,
    subtotalCents: 2000,
    destination: null,
  });
  assert.equal(missing.ok, false);
  const invalid = quoteDelivery({
    rules,
    fulfillment: "DELIVERY",
    deliveryEnabled: true,
    flatFeeCents: 500,
    subtotalCents: 2000,
    destination: { lat: 120, lng: 0 },
  });
  assert.equal(invalid.ok, false);
});

test("3 km cai na primeira faixa e o limite de 15 km entra na última", () => {
  assert.equal(matchBand(3, rules)?.feeCents, 500);
  assert.equal(matchBand(3.01, rules)?.feeCents, 700);
  assert.equal(matchBand(0, rules)?.feeCents, 500);
  assert.equal(matchBand(5, rules)?.feeCents, 700);
  assert.equal(matchBand(5.01, rules)?.feeCents, 1000);
  assert.equal(matchBand(15, rules)?.feeCents, 1500);
  assert.equal(matchBand(15.01, rules), null);
});

test("fora da área, entrega desligada, retirada e entrega grátis", () => {
  const far = quoteDelivery({
    rules,
    fulfillment: "DELIVERY",
    deliveryEnabled: true,
    flatFeeCents: 500,
    subtotalCents: 4000,
    destination: { lat: -23.3, lng: -46.2 },
  });
  assert.equal(far.ok, false);
  const closed = quoteDelivery({
    rules,
    fulfillment: "DELIVERY",
    deliveryEnabled: false,
    flatFeeCents: 500,
    subtotalCents: 4000,
    destination: { lat: -23.55, lng: -46.63 },
  });
  assert.equal(closed.ok, false);
  const pickup = quoteDelivery({
    rules,
    fulfillment: "PICKUP",
    deliveryEnabled: true,
    flatFeeCents: 500,
    subtotalCents: 4000,
    destination: { lat: -23.55, lng: -46.63 },
  });
  assert.equal(pickup.ok && pickup.snapshot.feeCents, 0);
  assert.equal(pickup.ok && pickup.snapshot.method, "retirada");
  const free = quoteDelivery({
    rules: { ...rules, freeDeliveryEnabled: true, freeDeliveryMinCents: 3000 },
    fulfillment: "DELIVERY",
    deliveryEnabled: true,
    flatFeeCents: 500,
    subtotalCents: 3000,
    destination: { lat: -23.5505, lng: -46.6333 },
  });
  assert.equal(free.ok && free.snapshot.feeCents, 0);
  assert.equal(free.ok && free.snapshot.originalFeeCents, 500);
  assert.equal(free.ok && free.snapshot.discountCents, 500);
  const paid = quoteDelivery({
    rules: { ...rules, freeDeliveryEnabled: false, freeDeliveryMinCents: 3000 },
    fulfillment: "DELIVERY",
    deliveryEnabled: true,
    flatFeeCents: 500,
    subtotalCents: 3000,
    destination: { lat: -23.5505, lng: -46.6333 },
  });
  assert.equal(paid.ok && paid.snapshot.feeCents, 500);
});

test("faixa sobreposta ou com buraco não salva", () => {
  assert.equal(validateBands([
    { minKm: 0, maxKm: 4, feeCents: 500, active: true },
    { minKm: 3, maxKm: 6, feeCents: 700, active: true },
  ]).ok, false);
  assert.equal(validateBands([
    { minKm: 0, maxKm: 3, feeCents: 500, active: true },
    { minKm: 4, maxKm: 6, feeCents: 700, active: true },
  ]).ok, false);
  assert.equal(validateBands(bands).ok, true);
});

test("pedido mínimo continua no servidor e o frete do navegador não entra na conta", () => {
  const below = quoteFoodOrder({
    acceptingOrders: true,
    deliveryEnabled: true,
    pickupEnabled: true,
    deliveryFeeCents: 500,
    minOrderCents: 3000,
    fulfillment: "DELIVERY",
    lines: [{ itemId: "1", name: "Prato", priceCents: 1000, quantity: 1, available: true, removals: [], additions: [], notes: null }],
    coupon: null,
  });
  assert.equal(below.ok, false);
  const quoted = quoteDelivery({
    rules,
    fulfillment: "DELIVERY",
    deliveryEnabled: true,
    flatFeeCents: 9999,
    subtotalCents: 4000,
    destination: { lat: -23.5505, lng: -46.6333 },
  });
  assert.equal(quoted.ok && quoted.snapshot.feeCents, 500);
  assert.notEqual(quoted.ok && quoted.snapshot.feeCents, 9999);
});

test("duas lojas só enxergam as faixas que receberam e a geocodificação desta versão não acha endereço", async () => {
  const other = quoteDelivery({
    rules: { ...rules, bands: [{ minKm: 0, maxKm: 15, feeCents: 200, active: true }] },
    fulfillment: "DELIVERY",
    deliveryEnabled: true,
    flatFeeCents: 500,
    subtotalCents: 4000,
    destination: { lat: -23.5505, lng: -46.6333 },
  });
  assert.equal(other.ok && other.snapshot.feeCents, 200);
  assert.equal(await emptyGeocoder.lookup("Rua das Delícias, 123"), null);
});
