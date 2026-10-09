/**
 * Foto pública do anúncio. O pedido do Mercado Livre não traz imagem.
 */

type MlItemBody = {
  id?: string;
  secure_thumbnail?: string;
  thumbnail?: string;
};

export async function mlItemPhotos(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter((id) => /^ML[A-Z]\d+$/i.test(id)))].slice(0, 20);
  const photos = new Map<string, string>();
  if (!unique.length) return photos;

  const url = `https://api.mercadolibre.com/items?ids=${unique.join(",")}&attributes=id,secure_thumbnail,thumbnail`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return photos;
  const rows = (await res.json()) as Array<{ body?: MlItemBody }>;
  if (!Array.isArray(rows)) return photos;
  for (const row of rows) {
    const id = row.body?.id;
    const src = row.body?.secure_thumbnail || row.body?.thumbnail;
    if (id && src) photos.set(id, src);
  }
  return photos;
}
