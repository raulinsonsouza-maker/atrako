/**
 * Tray carrinhos (GET /carts → /carts/{session}/complete → /customers/{id}) → AbandonedCart.
 * A listagem só traz session_id; filtramos por has_customer + date_time (horário de Brasília).
 */

import { upsertCheckoutCart } from "@/lib/crm/abandoned-cart";
import { trayFetch } from "./client";

type TrayCartsResponse = {
  paging?: { total?: number; page?: number; limit?: number };
  Carts?: Array<{ Cart?: { session_id?: string | null } }>;
};

type TrayCartComplete = {
  Cart?: {
    session_id?: string | null;
    email?: string | null;
    customer_id?: string | number | null;
    previous_url?: string | null;
    date?: string | null;
    hour?: string | null;
    total?: string | number | null;
    sub_total?: string | number | null;
    Products?: Array<{
      id?: string | null;
      name?: string | null;
      quantity?: string | number | null;
      price?: string | number | null;
      date?: string | null;
    }> | null;
  };
};

type TrayCustomerResponse = {
  Customer?: {
    name?: string | null;
    email?: string | null;
    cellphone?: string | null;
    phone?: string | null;
  };
};

const PAGE_SIZE = 50;
const BRT_OFFSET_MS = 3 * 3_600_000;

function toCents(raw: string | number | null | undefined): number {
  const n = Number(String(raw ?? 0).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function formatBrt(d: Date): string {
  return new Date(d.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 19).replace("T", " ");
}

function parseBrt(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(`${raw.trim().replace(" ", "T")}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function syncTrayAbandonedCheckouts(
  workspaceId: string,
  since: Date,
): Promise<number> {
  const dateRange = `${formatBrt(since)}, ${formatBrt(new Date())}`;
  const sessionIds: string[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await trayFetch<TrayCartsResponse>(workspaceId, "/carts", {
      query: { has_customer: 1, date_time: dateRange, limit: PAGE_SIZE, page },
    });
    const ids = (res?.Carts ?? [])
      .map((c) => c.Cart?.session_id)
      .filter((id): id is string => Boolean(id));
    sessionIds.push(...ids);
    if (ids.length < PAGE_SIZE) break;
  }

  const customers = new Map<string, TrayCustomerResponse["Customer"] | null>();
  let count = 0;
  for (const sessionId of sessionIds) {
    const cart = await trayFetch<TrayCartComplete>(workspaceId, `/carts/${sessionId}/complete`)
      .then((r) => r?.Cart ?? null)
      .catch(() => null);
    if (!cart) continue;

    const customerId = cart.customer_id != null ? String(cart.customer_id) : "";
    if (customerId && customerId !== "0" && !customers.has(customerId)) {
      const c = await trayFetch<TrayCustomerResponse>(workspaceId, `/customers/${customerId}`)
        .then((r) => r?.Customer ?? null)
        .catch(() => null);
      customers.set(customerId, c);
    }
    const customer = customers.get(customerId) ?? null;

    const products = cart.Products ?? [];
    const activity = [
      parseBrt(cart.date && cart.hour ? `${cart.date} ${cart.hour}` : cart.date),
      ...products.map((p) => parseBrt(p.date)),
    ].filter((d): d is Date => d != null);
    const lastActivityAt = activity.length
      ? new Date(Math.max(...activity.map((d) => d.getTime())))
      : new Date();

    const items = products.map((p) => ({
      title: p.name || "Item",
      quantity: Number(p.quantity) || 1,
      unitPriceCents: toCents(p.price),
      sku: p.id ?? null,
    }));
    await upsertCheckoutCart({
      workspaceId,
      provider: "TRAY",
      checkoutId: sessionId,
      lastActivityAt,
      completed: false,
      totalCents:
        toCents(cart.total) ||
        toCents(cart.sub_total) ||
        items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0),
      name: customer?.name,
      email: customer?.email || cart.email,
      phone: customer?.cellphone || customer?.phone,
      recoveryUrl: cart.previous_url || null,
      items,
    });
    count++;
  }
  return count;
}
