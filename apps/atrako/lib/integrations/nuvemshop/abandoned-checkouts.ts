/**
 * Nuvemshop GET /checkouts (checkouts abandonados, scope read_orders) → AbandonedCart.
 */

import { upsertCheckoutCart } from "@/lib/crm/abandoned-cart";
import { nuvemshopFetch } from "./client";

type NuvemshopCheckout = {
  id: number | string;
  token?: string | null;
  contact_email?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  abandoned_checkout_url?: string | null;
  total?: string | number | null;
  currency?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  products?: Array<{
    name?: string | null;
    price?: string | number | null;
    quantity?: string | number | null;
    sku?: string | null;
  }> | null;
};

function toCents(raw: string | number | null | undefined): number {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export async function syncNuvemshopAbandonedCheckouts(
  workspaceId: string,
  since: Date,
): Promise<number> {
  let count = 0;
  for (let page = 1; page <= 20; page++) {
    let rows: NuvemshopCheckout[] | null;
    try {
      rows = await nuvemshopFetch<NuvemshopCheckout[]>(workspaceId, "/checkouts", {
        query: { updated_at_min: since.toISOString(), per_page: 100, page },
      });
    } catch (err) {
      // Nuvemshop responde 404 quando a página passa do fim.
      if (err instanceof Error && err.message.startsWith("nuvemshop_api:404")) break;
      throw err;
    }
    if (!rows?.length) break;

    for (const c of rows) {
      await upsertCheckoutCart({
        workspaceId,
        provider: "NUVEMSHOP",
        checkoutId: String(c.id),
        lastActivityAt: new Date(c.updated_at || c.created_at),
        completed: Boolean(c.completed_at),
        totalCents: toCents(c.total),
        currency: c.currency ?? "BRL",
        name: c.contact_name,
        email: c.contact_email,
        phone: c.contact_phone,
        recoveryUrl: c.abandoned_checkout_url,
        items: (c.products ?? []).map((p) => ({
          title: p.name || "Item",
          quantity: Number(p.quantity) || 1,
          unitPriceCents: toCents(p.price),
          sku: p.sku ?? null,
        })),
      });
      count++;
    }
    if (rows.length < 100) break;
  }
  return count;
}
