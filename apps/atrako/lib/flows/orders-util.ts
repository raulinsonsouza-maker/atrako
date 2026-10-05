/** Leitura uniforme de pedidos das lojas (pago? cupons?) a partir de MarketplaceOrder.rawPayload. */

import { isWooPaidOrder, type WooOrder } from "@/lib/integrations/woocommerce/orders";
import { isShopifyPaidStatus } from "@/lib/integrations/shopify/orders";
import { isNuvemshopPaidStatus } from "@/lib/integrations/nuvemshop/orders";
import { isTrayPaidStatus, type TrayOrder } from "@/lib/integrations/tray/orders";
import { isShopeePaidStatus } from "@/lib/integrations/shopee/orders";
import { isTiktokShopPaidStatus } from "@/lib/integrations/tiktok-shop/orders";

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function orderFromRaw(raw: unknown): Record<string, unknown> {
  const r = rec(raw);
  return Object.keys(rec(r.order)).length ? rec(r.order) : r;
}

const UNPAID_GENERIC = /pending|on-hold|draft|cancel|fail|refund|void|expired|abandon|awaiting|aguardando|pendente/i;

export function isPaidMarketplaceOrder(o: { provider: string; status: string | null; rawPayload: unknown }) {
  const order = orderFromRaw(o.rawPayload);
  switch (o.provider) {
    case "WOOCOMMERCE":
      return isWooPaidOrder(order as unknown as WooOrder);
    case "SHOPIFY":
      return isShopifyPaidStatus(o.status);
    case "NUVEMSHOP":
      return isNuvemshopPaidStatus(o.status);
    case "TRAY":
      return isTrayPaidStatus(order as unknown as TrayOrder);
    case "SHOPEE":
      return isShopeePaidStatus(o.status);
    case "TIKTOK_SHOP":
      return isTiktokShopPaidStatus(o.status);
    case "MERCADO_LIVRE":
      return (o.status ?? "").toLowerCase() === "paid";
    default:
      return Boolean(o.status) && !UNPAID_GENERIC.test(o.status ?? "");
  }
}

function codesFrom(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (Array.isArray(v)) return v.flatMap(codesFrom);
  const r = rec(v);
  for (const k of ["code", "coupon_code", "discount_code", "name"]) {
    if (typeof r[k] === "string" && (r[k] as string).trim()) return [(r[k] as string).trim()];
  }
  return [];
}

/** Cupons usados no pedido (Woo coupon_lines, Shopify discount_codes, Nuvemshop coupon, Tray). */
export function extractCouponCodes(provider: string, rawPayload: unknown): string[] {
  const o = orderFromRaw(rawPayload);
  let codes: string[] = [];
  switch (provider) {
    case "WOOCOMMERCE":
      codes = codesFrom(o.coupon_lines);
      break;
    case "SHOPIFY":
      codes = [...codesFrom(o.discount_codes), ...codesFrom(o.discountCodes), ...codesFrom(o.discountCode)];
      break;
    case "NUVEMSHOP":
      codes = codesFrom(o.coupon);
      break;
    case "TRAY":
      codes = [
        ...codesFrom(o.discount_coupon),
        ...codesFrom(o.coupon),
        ...codesFrom(o.coupon_code),
        ...codesFrom(rec(o.Coupon).code),
      ];
      break;
    default:
      codes = [...codesFrom(o.coupon), ...codesFrom(o.coupon_code)];
  }
  return Array.from(new Set(codes.map((c) => c.toUpperCase())));
}
