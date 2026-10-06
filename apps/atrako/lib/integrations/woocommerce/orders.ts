/**
 * Orders WooCommerce REST.
 * Doc: https://woocommerce.github.io/woocommerce-rest-api-docs/#orders
 */

import { parseWooTime } from "../store-time";
import { wcFetch } from "./client";

export type WooBilling = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
};

export type WooShipping = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  city?: string;
  state?: string;
};

type WooMeta = Array<{ key?: string; value?: unknown }>;

export type WooCouponLine = { code?: string; discount?: string };

export type WooShippingLine = { method_title?: string; total?: string; meta_data?: WooMeta };

export type WooLineItem = {
  id?: number;
  product_id?: number;
  name?: string;
  quantity?: number;
  total?: string;
  sku?: string;
  image?: { id?: number | string; src?: string } | null;
  /** Woo 9+: permalink do produto (nem toda versão envia) */
  permalink?: string;
};

export type WooOrder = {
  id: number;
  number?: string;
  status?: string;
  currency?: string;
  total?: string;
  date_created?: string;
  date_created_gmt?: string;
  date_paid?: string | null;
  date_paid_gmt?: string | null;
  date_completed?: string | null;
  date_completed_gmt?: string | null;
  date_modified?: string | null;
  date_modified_gmt?: string | null;
  payment_method_title?: string;
  discount_total?: string;
  shipping_total?: string;
  coupon_lines?: WooCouponLine[];
  shipping_lines?: WooShippingLine[];
  /** Link "pagar pedido" do Woo — usado na recuperação de carrinho. */
  payment_url?: string;
  billing?: WooBilling;
  shipping?: WooShipping;
  customer_id?: number;
  line_items?: WooLineItem[];
  meta_data?: WooMeta;
};

export function wooCreatedAt(order: WooOrder): Date | null {
  return parseWooTime(order.date_created_gmt, order.date_created);
}

export function wooPaidAt(order: WooOrder): Date | null {
  return parseWooTime(order.date_paid_gmt, order.date_paid);
}

export function wooModifiedAt(order: WooOrder): Date | null {
  return parseWooTime(order.date_modified_gmt, order.date_modified);
}

export function wooCompletedAt(order: WooOrder): Date | null {
  return parseWooTime(order.date_completed_gmt, order.date_completed);
}

/** `MarketplaceOrder.occurredAt`: hora do pagamento; sem pagamento, hora do pedido. */
export function wooOrderOccurredAt(order: WooOrder): Date | null {
  return wooPaidAt(order) ?? wooCreatedAt(order);
}

export async function getWooOrder(workspaceId: string, orderId: string | number) {
  return wcFetch<WooOrder>(workspaceId, `/orders/${orderId}`);
}

export function extractWooBuyerContact(order: WooOrder): {
  name: string | null;
  email: string | null;
  phone: string | null;
  customerId: number | null;
} {
  const billing = order.billing;
  const shipping = order.shipping;

  const billingName = [billing?.first_name, billing?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const shippingName = [shipping?.first_name, shipping?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const name = billingName || shippingName || null;
  const email = billing?.email?.trim() || null;
  const phone =
    billing?.phone?.trim() || shipping?.phone?.trim() || null;

  return {
    name,
    email,
    phone,
    customerId: typeof order.customer_id === "number" ? order.customer_id : null,
  };
}

const WOO_PAID_STATUSES = new Set(["processing", "completed"]);
const WOO_UNPAID_STATUSES = new Set(["pending", "on-hold", "failed", "cancelled"]);

/** Reembolsado: venda desfeita (date_paid continua preenchido). */
export function isWooRefundedOrder(order: WooOrder): boolean {
  return (order.status ?? "").toLowerCase() === "refunded";
}

/** Pago: `date_paid` ou processing/completed. */
export function isWooPaidOrder(order: WooOrder): boolean {
  if (isWooRefundedOrder(order)) return false;
  if (order.date_paid) return true;
  return WOO_PAID_STATUSES.has((order.status ?? "").toLowerCase());
}

/**
 * Não pago = carrinho abandonado em potencial. `cancelled` sem pagamento é o pedido que o
 * Woo cancela sozinho; refunded/trash/checkout-draft ficam de fora.
 */
export function isWooUnpaidOrder(order: WooOrder): boolean {
  if (isWooPaidOrder(order)) return false;
  return WOO_UNPAID_STATUSES.has((order.status ?? "").toLowerCase());
}

export function wooOrderItems(order: WooOrder) {
  return (order.line_items ?? []).map((it) => {
    const quantity = Math.max(1, Number(it.quantity ?? 1));
    const total = Number(it.total ?? 0);
    return {
      title: String(it.name ?? "Item"),
      quantity,
      unitPriceCents: Number.isFinite(total) ? Math.round((total * 100) / quantity) : 0,
      sku: it.sku ?? null,
      imageUrl: typeof it.image?.src === "string" && it.image.src ? it.image.src : null,
      productUrl: typeof it.permalink === "string" && it.permalink ? it.permalink : null,
      externalItemId: it.product_id != null ? String(it.product_id) : it.id != null ? String(it.id) : null,
    };
  });
}

/** Itens do pedido com foto/link (completa productUrl pelo catálogo sincronizado). */
export async function wooOrderItemsEnriched(workspaceId: string, order: WooOrder) {
  const items = wooOrderItems(order);
  const missing = items.filter((i) => (!i.productUrl || !i.imageUrl) && i.externalItemId).map((i) => i.externalItemId!);
  if (!missing.length) return items;
  const { prisma } = await import("@/lib/db");
  const catalog = await prisma.marketplaceCatalogItem.findMany({
    where: { clienteId: workspaceId, provider: "WOOCOMMERCE", externalId: { in: missing } },
    select: { externalId: true, imageUrl: true, productUrl: true },
  });
  const byId = new Map(catalog.map((c) => [c.externalId, c]));
  return items.map((i) => {
    const c = i.externalItemId ? byId.get(i.externalItemId) : undefined;
    return c ? { ...i, imageUrl: i.imageUrl ?? c.imageUrl, productUrl: i.productUrl ?? c.productUrl } : i;
  });
}

export function wooOrderTotalCents(order: WooOrder): number {
  const total = Number(order.total ?? 0);
  if (!Number.isFinite(total)) return 0;
  return Math.round(total * 100);
}

export function wooMetaValue(
  order: WooOrder,
  key: string,
): string | null {
  const row = order.meta_data?.find(
    (m) => m.key?.toLowerCase() === key.toLowerCase(),
  );
  if (row?.value == null) return null;
  return String(row.value);
}
