import assert from "node:assert/strict";
import test from "node:test";
import { modulesForEdition } from "../lib/modules/editions";
import { isItemOrderable, isOpenAt } from "../lib/food/availability";
import { canTransitionFulfillment, quoteFoodOrder, statusTemplatePurpose } from "../lib/food/quote";

const line = {
  itemId: "1",
  name: "Lépido Clássico",
  priceCents: 2490,
  quantity: 1,
  available: true,
  removals: [],
  additions: [],
  notes: null,
};

test("cupom e taxa de entrega saem do servidor", () => {
  const quote = quoteFoodOrder({
    acceptingOrders: true,
    deliveryEnabled: true,
    pickupEnabled: true,
    deliveryFeeCents: 500,
    minOrderCents: 0,
    fulfillment: "DELIVERY",
    lines: [{ ...line, quantity: 2 }],
    coupon: { code: "LEPIDO10", type: "PERCENT", value: 10 },
  });
  assert.equal(quote.ok, true);
  if (!quote.ok) return;
  assert.equal(quote.subtotalCents, 4980);
  assert.equal(quote.discountCents, 498);
  assert.equal(quote.deliveryFeeCents, 500);
  assert.equal(quote.totalCents, 4982);
});

test("retirada não cobra taxa e item indisponível não entra", () => {
  const pickup = quoteFoodOrder({
    acceptingOrders: true,
    deliveryEnabled: true,
    pickupEnabled: true,
    deliveryFeeCents: 500,
    minOrderCents: 0,
    fulfillment: "PICKUP",
    lines: [line],
    coupon: null,
  });
  assert.equal(pickup.ok && pickup.deliveryFeeCents, 0);
  const closed = quoteFoodOrder({
    acceptingOrders: true,
    deliveryEnabled: true,
    pickupEnabled: true,
    deliveryFeeCents: 500,
    minOrderCents: 0,
    fulfillment: "DELIVERY",
    lines: [{ ...line, available: false }],
    coupon: null,
  });
  assert.equal(closed.ok, false);
});

test("retirada não passa por saiu para entrega", () => {
  assert.equal(canTransitionFulfillment("PICKUP", "READY", "OUT_FOR_DELIVERY"), false);
  assert.equal(canTransitionFulfillment("PICKUP", "READY", "COMPLETED"), true);
  assert.equal(canTransitionFulfillment("DELIVERY", "READY", "OUT_FOR_DELIVERY"), true);
  assert.equal(statusTemplatePurpose("OUT_FOR_DELIVERY", "DELIVERY"), "food_out_for_delivery");
  assert.equal(statusTemplatePurpose("READY", "PICKUP"), "food_ready");
});

test("versão food liga o módulo e desliga agenda e loja sem apagar o restante", () => {
  const next = modulesForEdition("food", { forms: true, food: false });
  assert.equal(next.food, true);
  assert.equal(next.agenda, false);
  assert.equal(next.commerce, false);
  assert.equal(next.forms, true);
  assert.deepEqual(modulesForEdition("custom", { forms: true }), { forms: true });
});

test("item segue o horário da loja e o horário próprio", () => {
  const noon = new Date("2026-10-12T15:00:00.000Z");
  const later = new Date("2026-10-12T18:00:00.000Z");
  const storeHours = { "1": [{ start: "10:00", end: "14:00" }] };
  assert.equal(isOpenAt(storeHours, noon), true);
  assert.equal(isOpenAt(storeHours, later), false);
  assert.equal(isItemOrderable({ available: true, categoryActive: true, storeHours, schedule: { mode: "ALWAYS" }, now: noon }), true);
  assert.equal(isItemOrderable({ available: true, categoryActive: true, storeHours, schedule: { mode: "ALWAYS" }, now: later }), false);
  assert.equal(isItemOrderable({
    available: true,
    categoryActive: false,
    storeHours: null,
    schedule: null,
    now: noon,
  }), false);
});
