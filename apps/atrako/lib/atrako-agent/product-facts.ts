/**
 * Acha o produto certo no catálogo da loja a partir do nome que a pessoa disse.
 * Sem rede: dá para testar o cruzamento.
 */

const STOP = new Set([
  "para", "dos", "das", "com", "uma", "pelo", "pela", "que", "nao", "este", "essa",
  "esse", "produto", "pagina", "landing", "venda", "comprar", "agora",
]);

export function productTokens(text: string): string[] {
  const words = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !STOP.has(word));
  return [...new Set(words)];
}

/** 1 = o título é o mesmo produto. Abaixo de 0,55 não serve. */
export function productTitleScore(query: string, title: string): number {
  const words = productTokens(query);
  if (words.length < 2) return 0;
  const hay = productTokens(title).join(" ");
  const hits = words.filter((word) => hay.includes(word));
  if (hits.length < 2) return 0;
  return hits.length / words.length;
}

export type CatalogHit = {
  title: string;
  productUrl: string | null;
  imageUrl: string | null;
  priceCents: number | null;
};

export function pickCatalogProduct(query: string, items: CatalogHit[]): (CatalogHit & { score: number }) | null {
  const ranked = items
    .map((item) => ({ ...item, score: productTitleScore(query, item.title) }))
    .filter((item) => item.score >= 0.55)
    .sort((a, b) => b.score - a.score || (b.productUrl ? 1 : 0) - (a.productUrl ? 1 : 0));
  return ranked[0] ?? null;
}

export function pageUrlsIn(text: string): string[] {
  const found = text.match(/https:\/\/[^\s<>"')]+/g) ?? [];
  const out: string[] = [];
  for (const raw of found) {
    const url = raw.replace(/[.,;]+$/, "");
    if (/unsplash\.com|images\.unsplash\.com/i.test(url)) continue;
    if (!out.includes(url)) out.push(url);
  }
  return out.slice(0, 4);
}
