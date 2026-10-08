import type { LpStockCredit } from "@/lib/criar/lp-v3";

/** Foto normalizada da busca. Sem rede: dá para testar seleção e crédito. */
export type StockImage = {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  color: string;
  author: string;
  authorUrl: string;
  photoUrl: string;
  downloadLocation: string;
};

const UTM = "utm_source=atrako&utm_medium=referral";

export function withUtm(url: string): string {
  if (!url) return url;
  return url.includes("?") ? `${url}&${UTM}` : `${url}?${UTM}`;
}

/** Uma foto de hero (paisagem) e o resto sem repetir fotógrafo. */
export function pickStockImages(images: StockImage[], max = 6): StockImage[] {
  const picked: StockImage[] = [];
  const authors = new Set<string>();
  const hero = images.find((img) => img.width >= img.height) ?? images[0];
  if (hero) {
    picked.push(hero);
    authors.add(hero.author);
  }
  for (const img of images) {
    if (picked.length >= max) break;
    if (picked.some((p) => p.id === img.id)) continue;
    if (authors.has(img.author)) continue;
    authors.add(img.author);
    picked.push(img);
  }
  return picked;
}

function baseUrl(url: string): string {
  return url.split("?")[0];
}

/** Fotos cujo endereço (sem query) aparece no HTML ou no CSS. */
export function usedStockImages(markup: string, images: StockImage[]): LpStockCredit[] {
  return images
    .filter((img) => markup.includes(baseUrl(img.url)))
    .map((img) => ({
      id: img.id,
      url: img.url,
      alt: img.alt,
      author: img.author,
      authorUrl: img.authorUrl,
      photoUrl: img.photoUrl,
      downloadLocation: img.downloadLocation,
      tracked: false,
    }));
}

export function creditsToTrack<T extends { tracked: boolean; downloadLocation: string }>(images: T[]): T[] {
  return images.filter((img) => !img.tracked && img.downloadLocation.startsWith("https://"));
}

export function stockBriefLines(images: StockImage[]): Array<{ rotulo: string; url: string; alt: string; papel: string }> {
  return images.map((img, i) => ({
    rotulo: `IMG${i + 1}`,
    url: img.url,
    alt: img.alt || "Foto",
    papel: i === 0 ? "hero, paisagem" : "seção",
  }));
}

type UnsplashPhoto = {
  id?: string;
  alt_description?: string | null;
  description?: string | null;
  width?: number;
  height?: number;
  color?: string | null;
  urls?: { raw?: string };
  user?: { name?: string; links?: { html?: string } };
  links?: { html?: string; download_location?: string };
};

export function mapUnsplashPhoto(raw: UnsplashPhoto): StockImage | null {
  const rawUrl = raw.urls?.raw;
  const id = raw.id;
  if (!rawUrl || !id || !rawUrl.startsWith("https://")) return null;
  const url = `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}w=1600&q=80&auto=format&fit=crop`;
  return {
    id,
    url,
    alt: (raw.alt_description || raw.description || "Foto").slice(0, 180),
    width: raw.width ?? 1600,
    height: raw.height ?? 1066,
    color: raw.color ?? "",
    author: raw.user?.name || "Autor",
    authorUrl: withUtm(raw.user?.links?.html || "https://unsplash.com"),
    photoUrl: withUtm(raw.links?.html || "https://unsplash.com"),
    downloadLocation: raw.links?.download_location || "",
  };
}
