import assert from "node:assert/strict";
import test from "node:test";
import { quoteStoreCart } from "../lib/commerce/cart-quote";
import { asShippingRules } from "../lib/commerce/shipping";

const baseLine = {
  productId: "p1",
  variantId: "v1",
  name: "Camiseta",
  options: { Tamanho: "M" },
  priceCents: 5000,
  quantity: 2,
  stockQty: 10,
  stockTracked: true,
  active: true,
};

test("quote store cart com frete e cupom", () => {
  const result = quoteStoreCart({
    acceptingOrders: true,
    shipEnabled: true,
    pickupEnabled: true,
    minOrderCents: 0,
    shippingRules: asShippingRules({
      zones: [
        {
          id: "z1",
          name: "SP",
          cepFrom: "01000000",
          cepTo: "09999999",
          feeCents: 1500,
          daysMin: 2,
          daysMax: 4,
        },
      ],
      defaultFeeCents: null,
    }),
    fulfillment: "SHIP",
    cep: "01310100",
    lines: [baseLine],
    coupon: { code: "OFF10", type: "PERCENT", value: 10 },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.subtotalCents, 10000);
    assert.equal(result.discountCents, 1000);
    assert.equal(result.shippingFeeCents, 1500);
    assert.equal(result.totalCents, 10500);
  }
});

test("rejeita estoque insuficiente", () => {
  const result = quoteStoreCart({
    acceptingOrders: true,
    shipEnabled: true,
    pickupEnabled: true,
    minOrderCents: 0,
    shippingRules: asShippingRules({ defaultFeeCents: 0 }),
    fulfillment: "PICKUP",
    lines: [{ ...baseLine, stockQty: 1, quantity: 3 }],
    coupon: null,
  });
  assert.equal(result.ok, false);
});

test("rejeita produto sem preço", () => {
  const result = quoteStoreCart({
    acceptingOrders: true,
    shipEnabled: true,
    pickupEnabled: true,
    minOrderCents: 0,
    shippingRules: asShippingRules({ defaultFeeCents: 0 }),
    fulfillment: "PICKUP",
    lines: [{ ...baseLine, priceCents: 0 }],
    coupon: null,
  });
  assert.equal(result.ok, false);
});
