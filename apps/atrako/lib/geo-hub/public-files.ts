import "server-only";
import { LP_DOMAIN_NOINDEX_PREFIXES } from "@/lib/lp-domains";
import { ALLOWED_AI_BOTS } from "./ai-sources";
import { canonicalUrl, loadSitePages, pageSegments, parseFaq, siteOrigin, type GeoSiteData } from "./site";
import { prisma } from "@/lib/db";

/** Prefixos públicos do host do app (vitrines, cardápios, formulários) que podem ser indexados. */
const APP_INDEXABLE_PREFIXES = ["/p/", "/loja/", "/cardapio/", "/estadia/", "/b/", "/c/", "/f/", "/politica-de-privacidade", "/termos-de-uso", "/exclusao-de-dados"];

/** robots.txt do domínio do cliente: libera buscadores e robôs de IA, esconde área logada e API. */
export function lpRobots(origin: string, hasGuide: boolean) {
  const disallow = LP_DOMAIN_NOINDEX_PREFIXES.map((p) => `Disallow: ${p}`);
  return [
    "# Robôs de IA e buscadores são bem-vindos ao conteúdo público.",
    "User-agent: *",
    "Allow: /",
    ...disallow,
    "",
    hasGuide ? `Sitemap: ${origin}/sitemap.xml` : null,
    "",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

/** robots.txt do host do app: só as páginas públicas dos clientes são indexáveis. */
export function appRobots() {
  return [
    "User-agent: *",
    "Allow: /$",
    ...APP_INDEXABLE_PREFIXES.map((p) => `Allow: ${p}`),
    "Disallow: /",
    "",
  ].join("\n");
}

type SitePage = Awaited<ReturnType<typeof loadSitePages>>[number];

function pageUrl(site: GeoSiteData, page: SitePage) {
  const hub = site.hubs.find((h) => h.id === page.hubId);
  if (!hub) return null;
  const [a, b] = pageSegments(hub.slug, page);
  return canonicalUrl(site, a, b);
}

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Todas as URLs públicas do domínio (LP, guia, hubs, páginas e privacidade). */
export async function siteUrls(site: GeoSiteData) {
  const pages = await loadSitePages(site.id);
  const origin = siteOrigin(site);
  const latest = pages.reduce<Date | null>((acc, p) => (!acc || p.updatedAt > acc ? p.updatedAt : acc), null);
  const urls: { loc: string; lastmod?: Date }[] = [
    { loc: `${origin}/` },
    { loc: canonicalUrl(site), lastmod: latest ?? undefined },
  ];
  for (const hub of site.hubs) {
    const hubPages = pages.filter((p) => p.hubId === hub.id && p.type !== "entity");
    if (!hubPages.length) continue;
    const hubLatest = hubPages.reduce((acc, p) => (p.updatedAt > acc ? p.updatedAt : acc), hubPages[0].updatedAt);
    urls.push({ loc: canonicalUrl(site, hub.slug), lastmod: hubLatest });
  }
  for (const page of pages) {
    const loc = pageUrl(site, page);
    if (loc) urls.push({ loc, lastmod: page.updatedAt });
  }
  urls.push({ loc: `${origin}/privacidade` });
  return urls;
}

export async function sitemapXml(site: GeoSiteData) {
  const urls = await siteUrls(site);
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString()}</lastmod>` : ""}</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function factsLines(site: GeoSiteData) {
  const f = site.factsParsed;
  const lines: string[] = [];
  if (f.offer) lines.push(`- Oferta: ${f.offer}`);
  if (f.investment) lines.push(`- Investimento inicial: ${f.investment.label}${f.investment.note ? ` (${f.investment.note})` : ""}`);
  if (f.areaServed) lines.push(`- Atuação: ${f.areaServed}`);
  if (f.foundedYear) lines.push(`- Fundação: ${f.foundedYear}`);
  if (f.units) lines.push(`- Unidades: ${f.units}`);
  for (const h of f.highlights) lines.push(`- ${h}`);
  if (f.undisclosed.length) lines.push(`- ${f.undisclosedAnswer}`);
  const contact = [f.contact.email, f.contact.phone].filter(Boolean).join(" · ");
  if (contact) lines.push(`- Contato: ${contact}`);
  if (f.officialSite) lines.push(`- Site oficial: ${f.officialSite}`);
  return lines;
}

/** llms.txt (llmstxt.org): resumo da marca e índice das páginas do guia. */
export async function llmsTxt(site: GeoSiteData) {
  const f = site.factsParsed;
  const pages = await loadSitePages(site.id);
  const origin = siteOrigin(site);
  const out: string[] = [`# ${f.brand}`, "", `> ${f.description}`, "", ...factsLines(site), ""];
  out.push("## Guia", "", `- [Guia ${f.brand}](${canonicalUrl(site)}): índice de todas as perguntas respondidas`);
  for (const p of pages.filter((x) => x.type === "entity")) {
    const url = pageUrl(site, p);
    if (url) out.push(`- [${p.title}](${url}): ${p.description}`);
  }
  out.push(`- [Página da oportunidade](${origin}/): apresentação e cadastro de interessados`, "");
  for (const hub of site.hubs) {
    const hubPages = pages.filter((p) => p.hubId === hub.id && p.type !== "entity");
    if (!hubPages.length) continue;
    out.push(`## ${hub.title}`, "");
    if (hub.description) out.push(hub.description, "");
    for (const p of hubPages) {
      const url = pageUrl(site, p);
      if (url) out.push(`- [${p.title}](${url}): ${p.description}`);
    }
    out.push("");
  }
  out.push("## Optional", "", `- [Conteúdo completo em texto](${origin}/llms-full.txt)`, `- [Privacidade](${origin}/privacidade)`, "");
  return out.join("\n");
}

/** llms-full.txt: o texto integral de todas as páginas publicadas, em markdown. */
export async function llmsFullTxt(site: GeoSiteData) {
  const f = site.factsParsed;
  const pages = await prisma.geoPage.findMany({
    where: { siteId: site.id, status: "PUBLISHED" },
    orderBy: [{ position: "asc" }, { title: "asc" }],
  });
  const out: string[] = [`# ${f.brand}`, "", `> ${f.description}`, "", ...factsLines(site), ""];
  for (const hub of site.hubs) {
    const hubPages = pages.filter((p) => p.hubId === hub.id);
    if (!hubPages.length) continue;
    out.push(`# ${hub.title}`, "");
    for (const p of hubPages) {
      const [a, b] = pageSegments(hub.slug, p);
      out.push(`## ${p.title}`, "", `URL: ${canonicalUrl(site, a, b)}`, `Atualizado em: ${p.updatedAt.toISOString().slice(0, 10)}`, "");
      out.push(p.answer, "", p.body.trim().replace(/\]\(\//g, `](${siteOrigin(site)}/`), "");
      const faq = parseFaq(p.faq);
      if (faq.length) {
        out.push("### Perguntas frequentes", "");
        for (const item of faq) out.push(`**${item.q}**`, "", item.a, "");
      }
    }
  }
  return out.join("\n");
}

export const TEXT_HEADERS = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" };
