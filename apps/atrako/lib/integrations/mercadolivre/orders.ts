/**
 * Orders Mercado Livre.
 * Doc: https://developers.mercadolivre.com.br/pt_br/gerenciamento-de-vendas
 */

import { mlFetch } from "./client";

export type MlOrderBuyer = {
  id?: number;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: { number?: string; area_code?: string; extension?: string };
};

export type MlOrderShipping = {
  id?: number;
  receiver_address?: {
    receiver_name?: string;
    receiver_phone?: string;
    phone?: string;
  };
};

export type MlOrderItem = {
  item?: {
    id?: string;
    title?: string;
    seller_sku?: string;
    seller_custom_field?: string;
  };
  quantity?: number;
  unit_price?: number;
  full_unit_price?: number;
  sale_fee?: number;
};

export type MlOrder = {
  id: number;
  status?: string;
  date_created?: string;
  date_closed?: string;
  total_amount?: number;
  paid_amount?: number;
  currency_id?: string;
  buyer?: MlOrderBuyer;
  shipping?: MlOrderShipping;
  order_items?: MlOrderItem[];
  tags?: string[];
};

export type NormalizedMlLineItem = {
  externalItemId: string | null;
  title: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  saleFeeCents: number;
  sku: string | null;
};

export type OrderEconomics = {
  totalCents: number;
  saleFeeCents: number;
  shippingCostCents: number;
  netCents: number;
  shippingId: string | null;
};

export async function getMlOrder(workspaceId: string, orderId: string | number) {
  return mlFetch<MlOrder>(workspaceId, `/orders/${orderId}`);
}

export function extractMlOrderItems(order: MlOrder): NormalizedMlLineItem[] {
  const rows = order.order_items ?? [];
  return rows.map((row) => {
    const qty = Math.max(1, Number(row.quantity ?? 1) || 1);
    const unit =
      typeof row.unit_price === "number"
        ? row.unit_price
        : typeof row.full_unit_price === "number"
          ? row.full_unit_price
          : 0;
    const unitPriceCents = Math.round(unit * 100);
    const saleFeeCents =
      typeof row.sale_fee === "number" ? Math.round(row.sale_fee * 100) : 0;
    const title =
      (typeof row.item?.title === "string" && row.item.title.trim()) ||
      "Produto";
    const sku =
      (typeof row.item?.seller_sku === "string" && row.item.seller_sku.trim()) ||
      (typeof row.item?.seller_custom_field === "string" &&
        row.item.seller_custom_field.trim()) ||
      null;
    return {
      externalItemId: row.item?.id ? String(row.item.id) : null,
      title: title.slice(0, 300),
      quantity: qty,
      unitPriceCents,
      lineTotalCents: unitPriceCents * qty,
      saleFeeCents,
      sku: sku ? sku.slice(0, 120) : null,
    };
  });
}

export function extractOrderEconomics(
  order: MlOrder,
  items: NormalizedMlLineItem[],
  shippingCostCents = 0,
): OrderEconomics {
  const totalAmount =
    typeof order.paid_amount === "number"
      ? order.paid_amount
      : typeof order.total_amount === "number"
        ? order.total_amount
        : 0;
  const totalCents = Math.round(totalAmount * 100);
  const saleFeeCents = items.reduce((sum, it) => sum + it.saleFeeCents, 0);
  const netCents = totalCents - saleFeeCents - shippingCostCents;
  return {
    totalCents,
    saleFeeCents,
    shippingCostCents,
    netCents,
    shippingId: order.shipping?.id != null ? String(order.shipping.id) : null,
  };
}

export function extractMlBuyerContact(order: MlOrder): {
  name: string | null;
  email: string | null;
  phone: string | null;
  buyerId: number | null;
} {
  const buyer = order.buyer;
  const shipping = order.shipping?.receiver_address;

  const nameParts = [buyer?.first_name, buyer?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const name =
    nameParts ||
    shipping?.receiver_name?.trim() ||
    buyer?.nickname?.trim() ||
    null;

  const email = buyer?.email?.trim() || null;

  const phoneFromBuyer = [buyer?.phone?.area_code, buyer?.phone?.number]
    .filter(Boolean)
    .join("")
    .trim();
  const phone =
    shipping?.receiver_phone?.trim() ||
    shipping?.phone?.trim() ||
    phoneFromBuyer ||
    null;

  return {
    name,
    email,
    phone,
    buyerId: typeof buyer?.id === "number" ? buyer.id : null,
  };
}
