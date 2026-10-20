/** Preço do carrinho da loja nativa. Totais só no servidor. */

import {
  asShippingRules,
  quoteShipping,
  type ShippingRules,
  type ShippingSnapshot,
} from "@/lib/commerce/shipping";

export type StoreCartLine = {
  productId: string;
  variantId: string | null;
  name: string;
  options: Record<string, string> | null;
  priceCents: number;
  quantity: number;
  stockQty: number | null;
  stockTracked: boolean;
  active: boolean;
};

export type StoreQuoteInput = {
  acceptingOrders: boolean;
  shipEnabled: boolean;
  pickupEnabled: boolean;
  minOrderCents: number;
  shippingRules: ShippingRules;
  fulfillment: "SHIP" | "PICKUP";
  cep?: string | null;
  lines: StoreCartLine[];
  coupon: { code: string; type: "PERCENT" | "FIXED"; value: number } | null;
};

export type StoreQuoteOk = {
  ok: true;
  subtotalCents: number;
  discountCents: number;
  shippingFeeCents: number;
  totalCents: number;
  couponCode: string | null;
  shipping: ShippingSnapshot;
};

export type StoreQuoteResult = StoreQuoteOk | { ok: false; error: string };

export function quoteStoreCart(input: StoreQuoteInput): StoreQuoteResult {
  if (!input.acceptingOrders) return { ok: false, error: "A loja não está recebendo pedidos." };
  if (!input.lines.length) return { ok: false, error: "Adicione um produto antes de continuar." };
  if (input.fulfillment === "SHIP" && !input.shipEnabled) {
    return { ok: false, error: "Entrega indisponível." };
  }
  if (input.fulfillment === "PICKUP" && !input.pickupEnabled) {
    return { ok: false, error: "Retirada indisponível." };
  }

  for (const line of input.lines) {
    if (!line.active) return { ok: false, error: `${line.name} está indisponível.` };
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) {
      return { ok: false, error: "Quantidade inválida." };
    }
    if (line.stockTracked && line.stockQty != null && line.quantity > line.stockQty) {
      return { ok: false, error: `${line.name} sem estoque suficiente.` };
    }
  }

  const subtotalCents = input.lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);
  if (input.minOrderCents > 0 && subtotalCents < input.minOrderCents) {
    return { ok: false, error: "Pedido abaixo do mínimo." };
  }

  let discountCents = 0;
  let couponCode: string | null = null;
  if (input.coupon) {
    couponCode = input.coupon.code;
    discountCents =
      input.coupon.type === "PERCENT"
        ? Math.round((subtotalCents * input.coupon.value) / 100)
        : Math.min(subtotalCents, input.coupon.value);
  }

  const shipping = quoteShipping({
    rules: input.shippingRules,
    fulfillment: input.fulfillment,
    cep: input.cep,
    subtotalCents: Math.max(0, subtotalCents - discountCents),
  });
  if (!shipping.available) {
    return { ok: false, error: shipping.reason };
  }

  const shippingFeeCents = shipping.feeCents;
  const totalCents = Math.max(0, subtotalCents - discountCents + shippingFeeCents);
  return {
    ok: true,
    subtotalCents,
    discountCents,
    shippingFeeCents,
    totalCents,
    couponCode,
    shipping,
  };
}

export { asShippingRules };
