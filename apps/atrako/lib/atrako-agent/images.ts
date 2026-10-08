import "server-only";
import { resolvePlatformApp } from "@/lib/config/platformApps";
import { mapUnsplashPhoto, pickStockImages, creditsToTrack, type StockImage } from "./images-core";
import type { LpStockCredit } from "@/lib/criar/lp-v3";

const SEARCH = "https://api.unsplash.com/search/photos";

async function accessKey(): Promise<string | null> {
  const app = await resolvePlatformApp("IMAGES_UNSPLASH").catch(() => null);
  const key = typeof app?.credentials.clientId === "string" ? app.credentials.clientId.trim() : "";
  return app?.enabled && key ? key : null;
}

/** Busca pública. Sem chave, devolve lista vazia e a LP segue só com CSS. */
export async function searchStockImages(
  query: string,
  opts: { orientation?: "landscape" | "portrait" | "squarish"; perPage?: number } = {},
): Promise<StockImage[]> {
  const q = query.trim().slice(0, 120);
  const key = await accessKey();
  if (!q || !key) return [];
  const params = new URLSearchParams({
    query: q,
    per_page: String(Math.min(opts.perPage ?? 6, 10)),
    content_filter: "high",
  });
  if (opts.orientation) params.set("orientation", opts.orientation);
  const res = await fetch(`${SEARCH}?${params}`, {
    headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    next: { revalidate: 86_400 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: unknown[] };
  return (data.results ?? [])
    .map((row) => mapUnsplashPhoto(row as Parameters<typeof mapUnsplashPhoto>[0]))
    .filter((img): img is StockImage => Boolean(img));
}

/** Avisa o Unsplash uma vez por foto usada. Falha aqui não impede a página. */
export async function trackStockDownload(downloadLocation: string): Promise<boolean> {
  const key = await accessKey();
  if (!key || !downloadLocation.startsWith("https://api.unsplash.com/")) return false;
  const url = new URL(downloadLocation);
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` }, cache: "no-store" });
  return res.ok;
}

export async function gatherStockImages(queries: string[]): Promise<StockImage[]> {
  const found: StockImage[] = [];
  for (const [i, query] of queries.slice(0, 4).entries()) {
    const batch = await searchStockImages(query, {
      orientation: i === 0 ? "landscape" : undefined,
      perPage: 4,
    }).catch(() => []);
    found.push(...batch);
  }
  return pickStockImages(found, 6);
}

export async function trackCredits(images: LpStockCredit[]): Promise<LpStockCredit[]> {
  const out: LpStockCredit[] = [];
  for (const img of images) {
    if (!creditsToTrack([img]).length) {
      out.push(img);
      continue;
    }
    const tracked = await trackStockDownload(img.downloadLocation).catch(() => false);
    out.push({ ...img, tracked });
  }
  return out;
}
