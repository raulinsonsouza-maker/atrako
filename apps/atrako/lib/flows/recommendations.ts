/**
 * Recomendações simples: comprados juntos (coocorrência) + mais vendidos 30d.
 * Exclui o que o contato já comprou (exceto recompra). Só itens com imagem e link.
 */

import { prisma } from "@/lib/db";
import type { RenderItem } from "@/lib/flows/types";

type Candidate = RenderItem & { key: string; score: number };

function keyOf(i: { externalItemId?: string | null; title: string }) {
  return (i.externalItemId || i.title).toLowerCase().trim();
}

export async function getRecommendations(
  workspaceId: string,
  opts: {
    contactId?: string | null;
    seedTitles?: string[];
    includePurchased?: boolean;
    limit?: number;
  },
): Promise<RenderItem[]> {
  const limit = opts.limit ?? 4;
  const since = new Date(Date.now() - 30 * 86_400_000);
  const candidates = new Map<string, Candidate>();

  const add = (i: RenderItem & { externalItemId?: string | null }, score: number) => {
    const k = keyOf(i);
    const prev = candidates.get(k);
    if (prev) {
      prev.score += score;
      prev.imageUrl ||= i.imageUrl;
      prev.productUrl ||= i.productUrl;
    } else {
      candidates.set(k, { ...i, key: k, score });
    }
  };

  const seeds = (opts.seedTitles ?? []).filter(Boolean).slice(0, 5);
  if (seeds.length) {
    const seedOrders = await prisma.marketplaceOrderItem.findMany({
      where: { order: { clienteId: workspaceId }, title: { in: seeds } },
      select: { orderId: true },
      take: 300,
      orderBy: { createdAt: "desc" },
    });
    const orderIds = Array.from(new Set(seedOrders.map((o) => o.orderId)));
    if (orderIds.length) {
      const together = await prisma.marketplaceOrderItem.findMany({
        where: { orderId: { in: orderIds }, title: { notIn: seeds } },
        select: { title: true, externalItemId: true, unitPriceCents: true, imageUrl: true, productUrl: true },
        take: 1000,
      });
      for (const t of together) add(t, 3);
    }
  }

  const best = await prisma.marketplaceOrderItem.findMany({
    where: { order: { clienteId: workspaceId, occurredAt: { gte: since } } },
    select: { title: true, externalItemId: true, unitPriceCents: true, imageUrl: true, productUrl: true, quantity: true },
    take: 2000,
    orderBy: { createdAt: "desc" },
  });
  for (const b of best) add(b, Math.min(b.quantity, 5));

  // Completa imagem/link com o catálogo
  const missing = Array.from(candidates.values()).filter((c) => !c.imageUrl || !c.productUrl);
  if (missing.length) {
    const catalog = await prisma.marketplaceCatalogItem.findMany({
      where: {
        clienteId: workspaceId,
        OR: [
          { title: { in: missing.map((m) => m.title).slice(0, 200) } },
          { externalId: { in: missing.map((m) => m.key).slice(0, 200) } },
        ],
      },
      select: { title: true, externalId: true, imageUrl: true, productUrl: true, priceCents: true },
    });
    for (const c of catalog) {
      const cand = candidates.get(c.externalId.toLowerCase()) ?? candidates.get(c.title.toLowerCase().trim());
      if (!cand) continue;
      cand.imageUrl ||= c.imageUrl;
      cand.productUrl ||= c.productUrl;
      cand.unitPriceCents ??= c.priceCents;
    }
  }

  let exclude = new Set<string>(seeds.map((s) => s.toLowerCase().trim()));
  if (opts.contactId && !opts.includePurchased) {
    const bought = await prisma.marketplaceOrderItem.findMany({
      where: { order: { clienteId: workspaceId, contactId: opts.contactId } },
      select: { title: true, externalItemId: true },
      take: 500,
    });
    exclude = new Set([...exclude, ...bought.map(keyOf), ...bought.map((b) => b.title.toLowerCase().trim())]);
  }

  return Array.from(candidates.values())
    .filter((c) => c.imageUrl && c.productUrl && !exclude.has(c.key) && !exclude.has(c.title.toLowerCase().trim()))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ title, unitPriceCents, imageUrl, productUrl }) => ({ title, unitPriceCents, imageUrl, productUrl }));
}

/** Mais comprado pelo contato (para recompra). */
export async function lastPurchasedItems(workspaceId: string, contactId: string, limit = 3) {
  const items = await prisma.marketplaceOrderItem.findMany({
    where: { order: { clienteId: workspaceId, contactId } },
    orderBy: { createdAt: "desc" },
    select: { title: true, quantity: true, unitPriceCents: true, imageUrl: true, productUrl: true },
    take: 20,
  });
  const seen = new Set<string>();
  const out: RenderItem[] = [];
  for (const i of items) {
    const k = i.title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
    if (out.length >= limit) break;
  }
  return out;
}
