/** Helpers do hub Criar — slug e paths públicos. */

export function slugify(input: string, fallback = "item"): string {
  const base =
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || fallback;
  return base;
}

export type CriarKind =
  | "oferta"
  | "formulario"
  | "automacao"
  | "servico"
  | "agenda"
  | "cupom"
  | "upsell"
  | "campanha_meta";

export function publicPath(kind: CriarKind, slug: string, pageSlug?: string): string {
  if (kind === "oferta") return `/p/${slug}`;
  if (kind === "formulario") return `/f/${slug}`;
  if (kind === "servico") return slug ? `/b/${slug}` : "/agenda";
  if (kind === "agenda") {
    if (!slug) return "/agenda";
    return pageSlug ? `/b/${slug}/${pageSlug}` : `/b/${slug}`;
  }
  if (kind === "cupom" || kind === "upsell") return "/commerce";
  if (kind === "campanha_meta") return "/criar/campanha-meta";
  return `/social/flows`;
}

export function absolutePublicUrl(origin: string, path: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
