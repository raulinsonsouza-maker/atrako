import "server-only";
import { prisma } from "@/lib/db";
import { LP_DOMAINS, GEO_INTERNAL_PREFIX } from "@/lib/lp-domains";
import { parseFacts, type GeoFacts } from "./facts";

export type GeoFaq = { q: string; a: string };
export type GeoSource = { label: string; url: string };

export type GeoSiteData = NonNullable<Awaited<ReturnType<typeof loadGeoSite>>>;
export type GeoHubData = GeoSiteData["hubs"][number];
export type GeoPageRow = Awaited<ReturnType<typeof loadSitePages>>[number];

export async function loadGeoSite(host: string) {
  const site = await prisma.geoSite.findUnique({
    where: { host: host.toLowerCase() },
    include: { hubs: { orderBy: [{ position: "asc" }, { title: "asc" }] } },
  });
  if (!site) return null;
  return { ...site, factsParsed: parseFacts(site.facts, site.name) as GeoFacts };
}

/** Páginas do site. `preview` inclui rascunhos e páginas em revisão. */
export async function loadSitePages(siteId: string, opts: { preview?: boolean } = {}) {
  return prisma.geoPage.findMany({
    where: { siteId, status: opts.preview ? { in: ["DRAFT", "REVIEW", "PUBLISHED"] } : "PUBLISHED" },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      hubId: true,
      slug: true,
      type: true,
      title: true,
      description: true,
      primaryQuestion: true,
      answer: true,
      status: true,
      related: true,
      previousSlugs: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
}

export function parseFaq(raw: unknown): GeoFaq[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
    .filter((x) => typeof x.q === "string" && typeof x.a === "string" && x.q.trim() && x.a.trim())
    .map((x) => ({ q: String(x.q).trim(), a: String(x.a).trim() }));
}

export function parseSources(raw: unknown): GeoSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
    .filter((x) => typeof x.url === "string" && /^https?:\/\//.test(String(x.url)))
    .map((x) => ({ label: String(x.label || x.url).trim(), url: String(x.url).trim() }));
}

/** Origem pública canônica do site (sempre https no host de produção). */
export function siteOrigin(site: { host: string }) {
  return `https://${site.host}`;
}

export function canonicalUrl(site: { host: string; basePath: string }, first?: string, second?: string) {
  return `${siteOrigin(site)}${site.basePath}${first ? `/${first}` : ""}${second ? `/${second}` : ""}`;
}

/**
 * Links relativos dentro do guia. No domínio do cliente usam o basePath;
 * na prévia (host do app) usam a rota interna.
 */
export type GeoLinker = {
  preview: boolean;
  guide: (hub?: string, slug?: string) => string;
  site: (path: string) => string;
  /** Reescreve links do markdown que apontam para o guia. */
  markdownHref: (href: string) => string;
};

export function geoLinker(site: { host: string; basePath: string }, requestHost: string): GeoLinker {
  const onClientDomain = LP_DOMAINS[requestHost]?.canonicalHost === site.host;
  const guideBase = onClientDomain ? site.basePath : `${GEO_INTERNAL_PREFIX}/${site.host}/g`;
  const siteBase = onClientDomain ? "" : `${GEO_INTERNAL_PREFIX}/${site.host}`;
  return {
    preview: !onClientDomain,
    guide: (hub, slug) => `${guideBase}${hub ? `/${hub}` : ""}${slug ? `/${slug}` : ""}` || "/",
    site: (path) => (path === "/" && !onClientDomain ? `${siteBase}/g` : `${siteBase}${path}`),
    markdownHref: (href) => {
      if (href.startsWith(`${site.basePath}/`) || href === site.basePath) {
        return `${guideBase}${href.slice(site.basePath.length)}`;
      }
      return href;
    },
  };
}

/** Página de entidade ("Quem é a marca") fica no topo do guia: /guia/sobre. */
export function pageSegments(hubSlug: string, page: { slug: string; type: string }): [string, string?] {
  return page.type === "entity" ? [page.slug] : [hubSlug, page.slug];
}

export type GeoRoute =
  | { kind: "home" }
  | { kind: "hub"; hub: GeoHubData }
  | { kind: "page"; hub: GeoHubData; pageId: string }
  | { kind: "redirect"; segments: [string, string?] }
  | { kind: "missing" };

export function resolveGeoRoute(site: GeoSiteData, pages: GeoPageRow[], segments: string[]): GeoRoute {
  if (!segments.length) return { kind: "home" };
  const [first, second, ...rest] = segments;
  if (rest.length) return { kind: "missing" };
  const hubOf = (p: GeoPageRow) => site.hubs.find((h) => h.id === p.hubId);
  if (!second) {
    const hub = site.hubs.find((h) => h.slug === first);
    if (hub) return { kind: "hub", hub };
    const entity = pages.find((p) => p.type === "entity" && p.slug === first);
    const entityHub = entity && hubOf(entity);
    if (entity && entityHub) return { kind: "page", hub: entityHub, pageId: entity.id };
    const moved = pages.find((p) => p.type === "entity" && p.previousSlugs.includes(first));
    if (moved) return { kind: "redirect", segments: [moved.slug] };
    return { kind: "missing" };
  }
  const hub = site.hubs.find((h) => h.slug === first);
  if (!hub) return { kind: "missing" };
  const page = pages.find((p) => p.hubId === hub.id && p.slug === second);
  if (page) {
    return page.type === "entity"
      ? { kind: "redirect", segments: [page.slug] }
      : { kind: "page", hub, pageId: page.id };
  }
  const moved = pages.find((p) => p.hubId === hub.id && p.previousSlugs.includes(second));
  if (moved) return { kind: "redirect", segments: pageSegments(hub.slug, moved) };
  return { kind: "missing" };
}
