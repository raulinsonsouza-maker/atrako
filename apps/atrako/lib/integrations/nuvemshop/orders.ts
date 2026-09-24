/**
 * Pedidos Nuvemshop — tipagem e normalizers.
 */

import { nuvemshopFetch } from "./client";

export type NuvemshopCustomer = {
  id?: number | string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  identification?: string | null;
};

export type NuvemshopProductLine = {
  id?: number | string;
  product_id?: number | string;
  variant_id?: number | string | null;
  name?: string | null;
  quantity?: string | number;
  price?: string | number;
  sku?: string | null;
};

export type NuvemshopOrder = {
  id?: number | string;
  number?: number | string | null;
  token?: string | null;
  status?: string | null;
  payment_status?: string | null;
  shipping_status?: string | null;
  currency?: string | null;
  total?: string | number | null;
  subtotal?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  customer?: NuvemshopCustomer | null;
  contact_email?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  products?: NuvemshopProductLine[];
};

export type NormalizedNuvemshopLineItem = {
  externalItemId: string | null;
  title: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  sku: string | null;
};

export type NuvemshopBuyer = {
  name: string | null;
  email: string | null;
  phone: string | null;
  customerId: string | null;
};

const PAID = new Set([
  "paid",
  "partially_paid",
  "authorized",
]);

function moneyToCents(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function nuvemshopOrderExternalId(order: NuvemshopOrder): string {
  if (order.id == null) throw new Error("nuvemshop_order_missing_id");
  return String(order.id);
}

export function nuvemshopOrderTotalCents(order: NuvemshopOrder): number {
  return moneyToCents(order.total ?? order.subtotal);
}

export function nuvemshopOrderCurrency(order: NuvemshopOrder): string {
  return (order.currency || "BRL").toUpperCase();
}

export function nuvemshopOrderStatus(order: NuvemshopOrder): string | null {
  return order.payment_status || order.status || null;
}

export function isNuvemshopPaidStatus(
  status: string | null | undefined,
): boolean {
  if (!status) return false;
  return PAID.has(status.toLowerCase());
}

export function nuvemshopOrderOccurredAt(order: NuvemshopOrder): Date {
  for (const raw of [order.completed_at, order.created_at, order.updated_at]) {
    if (!raw) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function extractNuvemshopBuyer(order: NuvemshopOrder): NuvemshopBuyer {
  const c = order.customer;
  const email = order.contact_email || c?.email || null;
  const phone = order.contact_phone || c?.phone || null;
  const name = order.contact_name || c?.name || null;
  return {
    name: name || email || phone || null,
    email,
    phone,
    customerId: c?.id != null ? String(c.id) : null,
  };
}

export function extractNuvemshopLineItems(
  order: NuvemshopOrder,
): NormalizedNuvemshopLineItem[] {
  const items: NormalizedNuvemshopLineItem[] = [];
  for (const p of order.products ?? []) {
    const qty =
      typeof p.quantity === "number" ? p.quantity : Number(p.quantity ?? 1) || 1;
    const unit = moneyToCents(p.price);
    items.push({
      externalItemId:
        p.id != null
          ? String(p.id)
          : p.product_id != null
            ? String(p.product_id)
            : null,
      title: (p.name || "Item").trim(),
      quantity: qty,
      unitPriceCents: unit,
      lineTotalCents: unit * qty,
      sku: p.sku || null,
    });
  }
  return items;
}

export async function getNuvemshopOrder(
  workspaceId: string,
  orderId: string | number,
): Promise<NuvemshopOrder> {
  return nuvemshopFetch<NuvemshopOrder>(workspaceId, `/orders/${orderId}`);
}

export async function listNuvemshopOrders(
  workspaceId: string,
  options?: {
    page?: number;
    perPage?: number;
    createdAtMin?: string;
  },
): Promise<NuvemshopOrder[]> {
  const list = await nuvemshopFetch<NuvemshopOrder[]>(workspaceId, "/orders", {
    query: {
      page: options?.page ?? 1,
      per_page: options?.perPage ?? 50,
      created_at_min: options?.createdAtMin,
    },
  });
  return Array.isArray(list) ? list : [];
}

export async function listNuvemshopProducts(
  workspaceId: string,
  options?: { page?: number; perPage?: number },
): Promise<Array<Record<string, unknown>>> {
  const list = await nuvemshopFetch<Array<Record<string, unknown>>>(
    workspaceId,
    "/products",
    {
      query: {
        page: options?.page ?? 1,
        per_page: options?.perPage ?? 50,
      },
    },
  );
  return Array.isArray(list) ? list : [];
}
