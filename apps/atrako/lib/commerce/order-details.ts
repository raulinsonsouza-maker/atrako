/**
 * Detalhes da compra lidos do `rawPayload` do pedido de loja: pagamento, cupom, entrega,
 * cidade e presente. Só o que a loja informa — sem estimativa.
 */

import { parseStoreLocalTime, parseWooTime } from "@/lib/integrations/store-time";

export type OrderLocation = { city: string; state: string | null };

export type OrderDetails = {
  createdAt: string | null;
  paymentMethod: string | null;
  installments: number | null;
  coupons: Array<{ code: string; discountCents: number | null }>;
  discountCents: number;
  shipping: {
    method: string | null;
    cents: number | null;
    days: number | null;
    estimatedDate: string | null;
    trackingUrl: string | null;
  } | null;
  location: OrderLocation | null;
  gift: boolean;
  giftTo: string | null;
};

type Meta = Array<{ key?: string; value?: unknown }> | undefined;
type Address = { city?: string | null; state?: string | null } | null | undefined;

type RawWooOrder = {
  date_created?: string;
  date_created_gmt?: string;
  payment_method_title?: string;
  discount_total?: string;
  shipping_total?: string;
  coupon_lines?: Array<{ code?: string; discount?: string }>;
  shipping_lines?: Array<{ method_title?: string; meta_data?: Meta }>;
  billing?: Address;
  shipping?: Address;
  meta_data?: Meta;
};

type RawTrayOrder = {
  date?: string | null;
  hour?: string | null;
  payment_method?: string | null;
  installment?: string | number | null;
  discount?: string | number | null;
  discount_coupon?: string | null;
  shipment?: string | null;
  shipment_value?: string | number | null;
  estimated_delivery_date?: string | null;
  tracking_url?: string | null;
  Customer?: Address;
};

function cents(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function text(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s || null;
}

function metaValue(meta: Meta, key: string): string | null {
  const row = meta?.find((m) => m.key === key);
  return row?.value == null ? null : String(row.value).trim() || null;
}

function truthy(v: string | null) {
  return v != null && /^(1|yes|true|sim)$/i.test(v);
}

function iso(d: Date | null) {
  return d ? d.toISOString() : null;
}

function location(...addresses: Address[]): OrderLocation | null {
  for (const a of addresses) {
    const city = text(a?.city);
    if (city) return { city, state: text(a?.state)?.toUpperCase() ?? null };
  }
  return null;
}

function wooDetails(o: RawWooOrder): OrderDetails {
  const ship = o.shipping_lines?.[0];
  const days = Number(
    metaValue(ship?.meta_data, "prazo_total") ?? metaValue(ship?.meta_data, "prazo") ?? metaValue(ship?.meta_data, "_delivery_forecast"),
  );
  const gift = truthy(metaValue(o.meta_data, "is_gift"));
  return {
    createdAt: iso(parseWooTime(o.date_created_gmt, o.date_created)),
    paymentMethod: text(o.payment_method_title),
    installments: null,
    coupons: (o.coupon_lines ?? [])
      .filter((c) => text(c.code))
      .map((c) => ({ code: text(c.code)!, discountCents: cents(c.discount) })),
    discountCents: cents(o.discount_total) ?? 0,
    shipping: ship
      ? {
          method: text(ship.method_title),
          cents: cents(o.shipping_total),
          days: Number.isFinite(days) && days > 0 ? days : null,
          estimatedDate: null,
          trackingUrl: null,
        }
      : null,
    location: location(o.shipping, o.billing),
    gift,
    giftTo: gift ? metaValue(o.meta_data, "gift_receiver_email") : null,
  };
}

function trayDetails(o: RawTrayOrder): OrderDetails {
  const time = o.hour && !o.hour.startsWith("00:00:00") ? o.hour : "00:00:00";
  const coupon = text(o.discount_coupon);
  const discountCents = cents(o.discount) ?? 0;
  const installments = Number(o.installment);
  const estimated = text(o.estimated_delivery_date);
  const method = text(o.shipment);
  return {
    createdAt: o.date ? iso(parseStoreLocalTime(`${o.date} ${time}`)) : null,
    paymentMethod: text(o.payment_method),
    installments: Number.isFinite(installments) && installments > 1 ? installments : null,
    coupons: coupon ? [{ code: coupon, discountCents: discountCents || null }] : [],
    discountCents,
    shipping: method
      ? {
          method,
          // Tray grava 0.00 também em "A combinar": zero não prova frete grátis.
          cents: cents(o.shipment_value) || null,
          days: null,
          estimatedDate: estimated && !estimated.startsWith("0000") ? estimated.slice(0, 10) : null,
          trackingUrl: text(o.tracking_url),
        }
      : null,
    location: location(o.Customer),
    gift: false,
    giftTo: null,
  };
}

export function orderDetails(provider: string, rawPayload: unknown): OrderDetails | null {
  const order = (rawPayload as { order?: unknown } | null)?.order;
  if (!order || typeof order !== "object") return null;
  if (provider === "WOOCOMMERCE") return wooDetails(order as RawWooOrder);
  if (provider === "TRAY") return trayDetails(order as RawTrayOrder);
  return null;
}

export function orderLocation(provider: string, rawPayload: unknown): OrderLocation | null {
  return orderDetails(provider, rawPayload)?.location ?? null;
}

export function formatLocation(loc: OrderLocation | null | undefined): string | null {
  if (!loc?.city) return null;
  return loc.state ? `${loc.city}/${loc.state}` : loc.city;
}

/** `NativeContact.metadata.location` — cidade do último pedido com endereço. */
export function contactLocation(metadata: unknown): OrderLocation | null {
  const loc = (metadata as { location?: Partial<OrderLocation> } | null)?.location;
  return loc?.city ? { city: loc.city, state: loc.state ?? null } : null;
}
