import "server-only";
import { prisma } from "@/lib/db";
import { pageUrlsIn, pickCatalogProduct, productTokens, type CatalogHit } from "./product-facts";
import { focusOnTitle, productUrlFromHtml, stripStickyPromo, type SiteBrand } from "./site-facts";
import { inspectStorePage } from "./site-brand";
import { fetchPublicText, readPage, tavilySearch } from "./web";

export type ProductDossier = {
  title: string;
  url: string | null;
  text: string;
  imageUrl: string | null;
  priceCents: number | null;
  brand: SiteBrand | null;
};

/** Lê a página real do produto na loja e devolve a ficha para cruzar com o pedido. */
export async function loadProductDossier(input: {
  clienteId: string;
  query: string;
  userText?: string;
  negocio?: string | null;
  signal?: AbortSignal;
}): Promise<ProductDossier | null> {
  const query = input.query.trim();
  const tokens = productTokens(query);
  const searchTokens = [...tokens].filter((token) => token.length >= 5).sort((a, b) => b.length - a.length).slice(0, 3);
  if (!searchTokens.length) return null;
  const titleFilter = searchTokens.map((token) => ({ title: { contains: token, mode: "insensitive" as const } }));
  const [catalog, orders] = await Promise.all([
    prisma.marketplaceCatalogItem.findMany({
      where: { clienteId: input.clienteId, OR: titleFilter },
      take: 20,
      select: { title: true, productUrl: true, imageUrl: true, priceCents: true },
    }),
    prisma.marketplaceOrderItem.findMany({
      where: { OR: titleFilter, order: { clienteId: input.clienteId } },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: { title: true, productUrl: true, imageUrl: true },
    }),
  ]).catch(() => [[], []] as const);

  const items: CatalogHit[] = [
    ...catalog.map((item) => ({
      title: item.title,
      productUrl: item.productUrl,
      imageUrl: item.imageUrl,
      priceCents: item.priceCents,
    })),
    ...orders.map((item) => ({
      title: item.title,
      productUrl: item.productUrl,
      imageUrl: item.imageUrl,
      priceCents: null,
    })),
  ];
  const hit = pickCatalogProduct(query, items);
  let url = hit?.productUrl && hit.productUrl.startsWith("https://") ? hit.productUrl : null;
  if (!url) {
    url = pageUrlsIn(input.userText ?? "").find((candidate) => searchTokens.some((token) => candidate.toLowerCase().includes(token))) ?? null;
  }
  if (!url) {
    const home = pageUrlsIn(input.userText ?? "")[0];
    if (home) {
      const origin = new URL(home).origin;
      for (const token of searchTokens) {
        const search = await fetchPublicText(`${origin}/?s=${encodeURIComponent(token)}`, input.signal).catch(() => null);
        const found = search ? productUrlFromHtml(search.body, token) : null;
        if (found) {
          url = found;
          break;
        }
      }
    }
  }
  if (!url) {
    const search = await tavilySearch(`${query} ${input.negocio ?? ""}`.trim(), {
      maxResults: 5,
      signal: input.signal,
    }).catch(() => null);
    const best = search?.results
      .map((result) => ({ result, score: pickCatalogProduct(query, [{ title: result.title, productUrl: result.url, imageUrl: null, priceCents: null }]) }))
      .find((row) => row.score);
    url = best?.result.url ?? null;
  }
  if (!url && !hit) return null;

  let text = "";
  let title = hit?.title ?? query;
  let priceCents = hit?.priceCents ?? null;
  let brand: SiteBrand | null = null;
  let lookImage: string | null = null;
  if (url) {
    const [page, look] = await Promise.all([
      readPage(url, input.signal).catch(() => null),
      inspectStorePage(url, input.signal).catch(() => null),
    ]);
    if (page?.title) title = page.title;
    else if (look?.title) title = look.title;
    const jina = page?.text ?? "";
    const htmlText = look?.text ?? "";
    const picked = htmlText.length > jina.length ? htmlText : jina;
    text = focusOnTitle(stripStickyPromo(picked), title).slice(0, 4000);
    if (!priceCents && look?.priceCents) priceCents = look.priceCents;
    brand = look?.brand ?? null;
    lookImage = look?.imageUrl ?? null;
  }
  const price = priceCents ? `Preço de tabela: R$ ${(priceCents / 100).toFixed(2).replace(".", ",")}.` : "";
  const body = [price, text].filter(Boolean).join("\n").trim();
  if (!body && !hit?.imageUrl) return null;
  return {
    title,
    url,
    text: body || title,
    imageUrl: hit?.imageUrl?.startsWith("https://")
      ? hit.imageUrl
      : lookImage?.startsWith("https://")
        ? lookImage
        : null,
    priceCents,
    brand,
  };
}
