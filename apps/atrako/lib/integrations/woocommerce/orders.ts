/**
 * Orders WooCommerce REST.
 * Doc: https://woocommerce.github.io/woocommerce-rest-api-docs/#orders
 */

import { wcFetch } from "./client";

export type WooBilling = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

export type WooShipping = {
  first_name?: string;
  last_name?: string;
  phone?: string;
};

export type WooLineItem = {
  id?: number;
  product_id?: number;
  name?: string;
  quantity?: number;
  total?: string;
  sku?: string;
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
  billing?: WooBilling;
  shipping?: WooShipping;
  customer_id?: number;
  line_items?: WooLineItem[];
  meta_data?: Array<{ key?: string; value?: unknown }>;
};

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
