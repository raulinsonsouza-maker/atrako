export type StoreBanner = {
  id: string;
  /** Arte do desktop. 1920 × 360. */
  imageUrl: string;
  /** Arte do celular. 1080 × 540. Sem ela, a vitrine usa a do desktop. */
  mobileImageUrl: string | null;
  /** Link ao clicar no banner (produto, categoria, URL externa, #âncora). */
  href: string | null;
  active: boolean;
  sortOrder: number;
};

function strOrNull(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

export function asStoreBanners(raw: unknown): StoreBanner[] {
  if (!Array.isArray(raw)) return [];
  const out: StoreBanner[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const imageUrl = strOrNull(o.imageUrl, 500) ?? "";
    const mobileImageUrl = strOrNull(o.mobileImageUrl, 500);
    if (!imageUrl && !mobileImageUrl) continue;
    const id =
      typeof o.id === "string" && o.id.trim()
        ? o.id.trim().slice(0, 40)
        : `banner-${i}-${Date.now().toString(36)}`;
    // Aceita `href` novo ou `ctaHref` legado
    const href = strOrNull(o.href, 300) ?? strOrNull(o.ctaHref, 300);
    out.push({
      id,
      imageUrl,
      mobileImageUrl,
      href,
      active: o.active !== false,
      sortOrder: Number.isFinite(Number(o.sortOrder)) ? Number(o.sortOrder) : i,
    });
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function publicBanners(raw: unknown): StoreBanner[] {
  return asStoreBanners(raw).filter((b) => b.active && (b.imageUrl || b.mobileImageUrl));
}
