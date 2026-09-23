import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { ingestPurchase } from "@/lib/symbius/attribution/engine";

export type EcommerceConnectors = {
  shopify?: { webhookSecret?: string };
  tray?: { webhookSecret?: string };
  nuvemshop?: { webhookSecret?: string };
};

export async function getConnectorSecrets(organizationId: string) {
  const settings = await prisma.igOrgSettings.findUnique({
    where: { organizationId },
  });
  return (settings?.ecommerceConnectors ?? {}) as EcommerceConnectors;
}

export function verifyShopifyHmac(
  rawBody: string,
  hmacHeader: string | null,
  secret: string,
): boolean {
  if (!hmacHeader || !secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

export function verifySharedSecret(
  provided: string | null,
  expected: string | undefined,
): boolean {
  if (!provided || !expected) return false;
  try {
    return timingSafeEqual(
      Buffer.from(provided),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

function noteAttr(
  notes: Array<{ name?: string; value?: string }> | undefined,
  key: string,
): string | null {
  if (!Array.isArray(notes)) return null;
  const row = notes.find(
    (n) => n.name?.toLowerCase() === key.toLowerCase(),
  );
  return row?.value ?? null;
}

export async function ingestShopifyOrder(
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const noteAttributes = payload.note_attributes as
    | Array<{ name?: string; value?: string }>
    | undefined;
  const stId =
    noteAttr(noteAttributes, "symbius_lead_id") ||
    noteAttr(noteAttributes, "st_id") ||
    null;
  const email =
    (payload.email as string) ||
    ((payload.customer as { email?: string } | undefined)?.email ?? null);
  const phone =
    ((payload.customer as { phone?: string } | undefined)?.phone as
      | string
      | undefined) ?? null;
  const lineItems = (payload.line_items as Array<Record<string, unknown>>) ?? [];

  return ingestPurchase({
    organizationId,
    transactionId: String(payload.id ?? payload.name ?? ""),
    stId,
    email,
    phone,
    customerId: payload.customer
      ? String((payload.customer as { id?: string | number }).id ?? "")
      : null,
    value: Number(payload.total_price ?? payload.current_total_price ?? 0),
    currency: String(payload.currency ?? "BRL"),
    items: lineItems.map((it) => ({
      id: String(it.product_id ?? it.sku ?? it.id ?? "item"),
      name: String(it.title ?? it.name ?? ""),
      quantity: Number(it.quantity ?? 1),
      price: Number(it.price ?? 0),
    })),
    timestamp: String(payload.processed_at ?? payload.created_at ?? ""),
    eventId: `shopify_${payload.id}`,
    rawPayload: payload,
  });
}

export async function ingestTrayOrder(
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const customer = (payload.Customer ?? payload.customer ?? {}) as Record<
    string,
    unknown
  >;
  const stId =
    String(payload.symbius_lead_id ?? payload.st_id ?? customer.symbius_lead_id ?? "") ||
    null;
  const products = (payload.Products ??
    payload.products ??
    []) as Array<Record<string, unknown>>;

  return ingestPurchase({
    organizationId,
    transactionId: String(payload.OrderId ?? payload.id ?? payload.order_id ?? ""),
    stId,
    email: String(customer.email ?? customer.Email ?? "") || null,
    phone: String(customer.cellphone ?? customer.phone ?? "") || null,
    value: Number(payload.total ?? payload.Total ?? payload.value ?? 0),
    currency: "BRL",
    items: products.map((p) => ({
      id: String(p.sku ?? p.product_id ?? p.id ?? "item"),
      name: String(p.name ?? p.Name ?? ""),
      quantity: Number(p.quantity ?? p.Quantity ?? 1),
      price: Number(p.price ?? p.Price ?? 0),
    })),
    timestamp: String(payload.date ?? payload.created_at ?? ""),
    eventId: `tray_${payload.OrderId ?? payload.id}`,
    rawPayload: payload,
  });
}

export async function ingestNuvemshopOrder(
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const customer = (payload.customer ?? {}) as Record<string, unknown>;
  const note = String(payload.note ?? "");
  const stMatch = note.match(/symbius_lead_id[=:\s]+([a-zA-Z0-9_]+)/i);
  const stId =
    stMatch?.[1] ||
    String(payload.symbius_lead_id ?? "") ||
    null;
  const products = (payload.products ?? []) as Array<Record<string, unknown>>;

  return ingestPurchase({
    organizationId,
    transactionId: String(payload.id ?? payload.number ?? ""),
    stId,
    email: String(customer.email ?? "") || null,
    phone: String(customer.phone ?? "") || null,
    customerId: customer.id != null ? String(customer.id) : null,
    value: Number(payload.total ?? 0),
    currency: String(payload.currency ?? "BRL"),
    items: products.map((p) => ({
      id: String(p.product_id ?? p.sku ?? p.id ?? "item"),
      name: String(p.name ?? ""),
      quantity: Number(p.quantity ?? 1),
      price: Number(p.price ?? 0),
    })),
    timestamp: String(payload.created_at ?? ""),
    eventId: `nuvemshop_${payload.id}`,
    rawPayload: payload,
  });
}
