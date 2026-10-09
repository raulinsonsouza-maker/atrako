/** Preço do pedido Food. O navegador não define o valor cobrado. */

export type FoodFulfillment = "DELIVERY" | "PICKUP";
export type FoodPaymentMethod = "PIX" | "CARD_ON_DELIVERY" | "CASH";

export type QuoteAddition = { name: string; priceCents: number; quantity: number };

export type QuoteLine = {
  itemId: string;
  name: string;
  priceCents: number;
  quantity: number;
  available: boolean;
  removals: string[];
  additions: QuoteAddition[];
  notes: string | null;
};

export type QuoteCoupon = { code: string; type: "PERCENT" | "FIXED"; value: number } | null;

export type QuoteInput = {
  acceptingOrders: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFeeCents: number;
  minOrderCents: number;
  fulfillment: FoodFulfillment;
  lines: QuoteLine[];
  coupon: QuoteCoupon;
};

export type QuoteOk = {
  ok: true;
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  couponCode: string | null;
};

export type QuoteResult = QuoteOk | { ok: false; error: string };

export function quoteFoodOrder(input: QuoteInput): QuoteResult {
  if (!input.acceptingOrders) return { ok: false, error: "A loja não está recebendo pedidos." };
  if (!input.lines.length) return { ok: false, error: "Adicione um item antes de continuar." };
  if (input.fulfillment === "DELIVERY" && !input.deliveryEnabled) {
    return { ok: false, error: "Entrega indisponível." };
  }
  if (input.fulfillment === "PICKUP" && !input.pickupEnabled) {
    return { ok: false, error: "Retirada indisponível." };
  }
  for (const line of input.lines) {
    if (!line.available) return { ok: false, error: `${line.name} está indisponível.` };
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 30) {
      return { ok: false, error: "Quantidade inválida." };
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
        ? Math.round(subtotalCents * (input.coupon.value / 100))
        : Math.min(subtotalCents, input.coupon.value);
  }
  const deliveryFeeCents = input.fulfillment === "PICKUP" ? 0 : input.deliveryFeeCents;
  const totalCents = Math.max(0, subtotalCents - discountCents + deliveryFeeCents);
  return { ok: true, subtotalCents, discountCents, deliveryFeeCents, totalCents, couponCode };
}

export const FULFILLMENT_STATUSES = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
] as const;

export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

const DELIVERY_NEXT: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const PICKUP_NEXT: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  OUT_FOR_DELIVERY: [],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionFulfillment(
  fulfillment: FoodFulfillment,
  from: string,
  to: string,
): boolean {
  const table = fulfillment === "PICKUP" ? PICKUP_NEXT : DELIVERY_NEXT;
  const allowed = table[from as FulfillmentStatus];
  if (!allowed) return false;
  return allowed.includes(to as FulfillmentStatus);
}

export function statusTemplatePurpose(status: string, fulfillment: FoodFulfillment): string | null {
  switch (status) {
    case "CONFIRMED":
      return "food_confirmed";
    case "PREPARING":
      return "food_preparing";
    case "READY":
      return fulfillment === "PICKUP" ? "food_ready" : "food_ready_dispatch";
    case "OUT_FOR_DELIVERY":
      return "food_out_for_delivery";
    case "COMPLETED":
      return "food_completed";
    case "CANCELLED":
      return "food_cancelled";
    default:
      return null;
  }
}
