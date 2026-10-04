/**
 * Completa foto/link dos itens (carrinho/pedido) pelo catálogo sincronizado (MarketplaceCatalogItem)
 * e, na falta dele, pelos itens de pedidos anteriores com o mesmo título.
 */

import { prisma } from "@/lib/db";

type Item = {
  title: string;
  sku?: string | null;
  externalItemId?: string | null;
  imageUrl?: string | null;
  productUrl?: string | null;
};

const norm = (s: string) => s.trim().toLowerCase();

export async function enrichItemsFromCatalog<T extends Item>(workspaceId: string, provider: string, items: T[]): Promise<T[]> {
  const missing = items.filter((i) => !i.imageUrl || !i.productUrl);
  if (!missing.length) return items;
  const ids = Array.from(
    new Set(missing.flatMap((i) => [i.externalItemId, i.sku].filter((v): v is string => Boolean(v)))),
  );
  const titles = Array.from(new Set(missing.map((i) => i.title).filter(Boolean)));
  const catalog = await prisma.marketplaceCatalogItem.findMany({
    where: {
      clienteId: workspaceId,
      provider,
      OR: [
        ...(ids.length ? [{ externalId: { in: ids } }, { sku: { in: ids } }] : []),
        ...(titles.length ? [{ title: { in: titles } }] : []),
      ],
    },
    select: { externalId: true, sku: true, title: true, imageUrl: true, productUrl: true },
    take: 200,
  });
  const byKey = new Map<string, { imageUrl: string | null; productUrl: string | null }>();
  for (const c of catalog) {
    const v = { imageUrl: c.imageUrl, productUrl: c.productUrl };
    byKey.set(`id:${c.externalId}`, v);
    if (c.sku) byKey.set(`id:${c.sku}`, v);
    byKey.set(`t:${norm(c.title)}`, v);
  }
  const stillMissing = new Set<string>();
  const out = items.map((i) => {
    if (i.imageUrl && i.productUrl) return i;
    const hit =
      (i.externalItemId && byKey.get(`id:${i.externalItemId}`)) ||
      (i.sku && byKey.get(`id:${i.sku}`)) ||
      byKey.get(`t:${norm(i.title)}`);
    const next = hit ? { ...i, imageUrl: i.imageUrl || hit.imageUrl, productUrl: i.productUrl || hit.productUrl } : i;
    if (!next.imageUrl) stillMissing.add(i.title);
    return next;
  });
  if (!stillMissing.size) return out;
  const fromOrders = await prisma.marketplaceOrderItem.findMany({
    where: {
      title: { in: Array.from(stillMissing) },
      imageUrl: { not: null },
      order: { clienteId: workspaceId },
    },
    select: { title: true, imageUrl: true, productUrl: true },
    take: 100,
  });
  const byTitle = new Map(fromOrders.map((o) => [norm(o.title), o]));
  return out.map((i) => {
    if (i.imageUrl) return i;
    const o = byTitle.get(norm(i.title));
    return o ? { ...i, imageUrl: o.imageUrl, productUrl: i.productUrl || o.productUrl } : i;
  });
}
