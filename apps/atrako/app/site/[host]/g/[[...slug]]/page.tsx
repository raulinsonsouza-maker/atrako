import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadGeoContext, type GeoContext } from "@/lib/geo-hub/request";
import { canonicalUrl, pageSegments, parseFaq, parseSources, resolveGeoRoute, siteOrigin } from "@/lib/geo-hub/site";
import { renderGeoMarkdown } from "@/lib/geo-hub/markdown";
import { articleLd, breadcrumbLd, faqLd, graph, organizationLd } from "@/lib/geo-hub/jsonld";
import { recordGeoHit } from "@/lib/geo-hub/hits";
import { Breadcrumbs, CtaSection, FactsBox, PageList, formatDate } from "@/components/geo-hub/GeoBlocks";

type Props = {
  params: Promise<{ host: string; slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function resolve(props: Props) {
  const { host, slug = [] } = await props.params;
  const ctx = await loadGeoContext(host);
  if (!ctx) return null;
  const segments = slug.map((s) => decodeURIComponent(s).toLowerCase());
  return { ctx, segments, route: resolveGeoRoute(ctx.site, ctx.pages, segments) };
}

function guideTitle(ctx: GeoContext) {
  return `Guia ${ctx.facts.offer ? `da ${ctx.facts.offer.charAt(0).toLowerCase()}${ctx.facts.offer.slice(1)}` : ctx.facts.brand}`;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const r = await resolve(props);
  if (!r) return {};
  const { ctx, route } = r;
  const { site, facts } = ctx;
  const robots = ctx.linker.preview ? { index: false, follow: false } : { index: true, follow: true };
  const image = facts.image ? [{ url: facts.image }] : undefined;
  const base = (title: string, description: string, url: string, type: "website" | "article"): Metadata => ({
    metadataBase: new URL(siteOrigin(site)),
    title,
    description,
    alternates: { canonical: url },
    robots,
    openGraph: { title, description, url, type, siteName: facts.brand, locale: "pt_BR", images: image },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: facts.image ? [facts.image] : undefined },
  });

  if (route.kind === "home") {
    return base(`${guideTitle(ctx)} | ${facts.brand}`, facts.description, canonicalUrl(site), "website");
  }
  if (route.kind === "hub") {
    return base(
      `${route.hub.title} | ${facts.brand}`,
      route.hub.description || facts.description,
      canonicalUrl(site, route.hub.slug),
      "website",
    );
  }
  if (route.kind === "page") {
    const page = ctx.pages.find((p) => p.id === route.pageId)!;
    const [a, b] = pageSegments(route.hub.slug, page);
    return base(`${page.title} | ${facts.brand}`, page.description, canonicalUrl(site, a, b), "article");
  }
  return { robots: { index: false, follow: false } };
}

export default async function GeoGuidePage(props: Props) {
  const r = await resolve(props);
  if (!r) notFound();
  const { ctx, route, segments } = r;
  const { site, facts, linker, pages } = ctx;

  if (route.kind === "redirect") permanentRedirect(linker.guide(...route.segments));
  if (route.kind === "missing") notFound();

  if (!linker.preview) {
    const sp = await props.searchParams;
    const utm = typeof sp.utm_source === "string" ? sp.utm_source : null;
    void recordGeoHit({
      host: site.host,
      clienteId: site.clienteId,
      path: `${site.basePath}${segments.length ? `/${segments.join("/")}` : ""}`,
      headers: await headers(),
      utmSource: utm,
    });
  }

  const origin = siteOrigin(site);
  const guideCrumb = { href: linker.guide(), label: "Guia", url: canonicalUrl(site) };

  if (route.kind === "home") {
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph(organizationLd(facts, origin), breadcrumbLd([{ name: "Guia", url: canonicalUrl(site) }])) }} />
        <div className="geo-wrap">
          <header className="geo-hero">
            <p className="type-caption-strong text-[var(--primary)]">GUIA {facts.brand.toUpperCase()}</p>
            <h1 className="type-display-lg">{guideTitle(ctx)}</h1>
            <p className="type-lead-airy text-[var(--ink-muted-80)]">{facts.description}</p>
          </header>
          <FactsBox facts={facts} />
          {site.hubs.map((hub) => {
            const hubPages = pages.filter((p) => p.hubId === hub.id && p.type !== "entity");
            if (!hubPages.length) return null;
            return (
              <section key={hub.id} className="geo-section" aria-labelledby={`hub-${hub.slug}`}>
                <h2 id={`hub-${hub.slug}`} className="type-tagline">
                  <a href={linker.guide(hub.slug)}>{hub.title}</a>
                </h2>
                {hub.description ? <p className="type-body text-[var(--ink-muted-80)]">{hub.description}</p> : null}
                <PageList pages={hubPages} hubs={site.hubs} linker={linker} />
              </section>
            );
          })}
        </div>
        <CtaSection ctx={ctx} hub={null} pageKey="guia" pageTitle={guideTitle(ctx)} />
      </>
    );
  }

  if (route.kind === "hub") {
    const hub = route.hub;
    const hubPages = pages.filter((p) => p.hubId === hub.id && p.type !== "entity");
    const url = canonicalUrl(site, hub.slug);
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: graph(
              organizationLd(facts, origin),
              breadcrumbLd([{ name: "Guia", url: canonicalUrl(site) }, { name: hub.title, url }]),
            ),
          }}
        />
        <div className="geo-wrap">
          <Breadcrumbs items={[guideCrumb, { label: hub.title }]} />
          <header className="geo-hero">
            <h1 className="type-display-lg">{hub.title}</h1>
            {hub.description ? <p className="type-lead-airy text-[var(--ink-muted-80)]">{hub.description}</p> : null}
          </header>
          <PageList pages={hubPages} hubs={site.hubs} linker={linker} />
        </div>
        <CtaSection ctx={ctx} hub={hub} pageKey={hub.slug} pageTitle={hub.title} />
      </>
    );
  }

  const hub = route.hub;
  const page = await prisma.geoPage.findUnique({ where: { id: route.pageId } });
  if (!page) notFound();
  const [a, b] = pageSegments(hub.slug, page);
  const url = canonicalUrl(site, a, b);
  const faq = parseFaq(page.faq);
  const sources = parseSources(page.sources);
  const html = renderGeoMarkdown(page.body, linker.markdownHref);
  const related = page.related
    .map((key) => {
      const [h, s] = key.split("/");
      const relHub = site.hubs.find((x) => x.slug === h);
      return relHub ? pages.find((p) => p.hubId === relHub.id && p.slug === s) : pages.find((p) => p.type === "entity" && p.slug === h);
    })
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && p!.id !== page.id);
  const siblings = pages.filter((p) => p.hubId === hub.id && p.id !== page.id && !related.some((x) => x.id === p.id)).slice(0, 6);
  const crumbs = page.type === "entity"
    ? [guideCrumb, { label: page.title }]
    : [guideCrumb, { href: linker.guide(hub.slug), label: hub.title, url: canonicalUrl(site, hub.slug) }, { label: page.title }];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: graph(
            organizationLd(facts, origin),
            articleLd({ url, title: page.title, description: page.description, publishedAt: page.publishedAt, updatedAt: page.updatedAt, origin, image: facts.image }),
            faqLd(faq),
            breadcrumbLd([
              { name: "Guia", url: canonicalUrl(site) },
              ...(page.type === "entity" ? [] : [{ name: hub.title, url: canonicalUrl(site, hub.slug) }]),
              { name: page.title, url },
            ]),
          ),
        }}
      />
      <article className="geo-wrap geo-article">
        <Breadcrumbs items={crumbs} />
        <header className="geo-hero">
          <h1 className="type-display-lg">{page.title}</h1>
          <p className="geo-answer type-lead-airy">{page.answer}</p>
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            Por {facts.brand} · Atualizado em <time dateTime={page.updatedAt.toISOString()}>{formatDate(page.updatedAt)}</time>
            {page.status !== "PUBLISHED" ? ` · ${page.status}` : ""}
          </p>
        </header>
        <div className="geo-article-grid">
          <div className="geo-prose type-body" dangerouslySetInnerHTML={{ __html: html }} />
          <FactsBox facts={facts} />
        </div>
        {faq.length ? (
          <section className="geo-section" aria-labelledby="faq-title">
            <h2 id="faq-title" className="type-tagline">
              Perguntas frequentes
            </h2>
            <div className="geo-faq">
              {faq.map((f) => (
                <details key={f.q}>
                  <summary className="type-body-strong">{f.q}</summary>
                  <p className="type-body">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}
        {sources.length ? (
          <section className="geo-section" aria-labelledby="sources-title">
            <h2 id="sources-title" className="type-caption-strong">
              Fontes
            </h2>
            <ul className="geo-sources type-caption">
              {sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} rel="noopener" target="_blank">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {related.length || siblings.length ? (
          <section className="geo-section" aria-labelledby="related-title">
            <h2 id="related-title" className="type-tagline">
              Continue lendo
            </h2>
            <PageList pages={[...related, ...siblings]} hubs={site.hubs} linker={linker} />
          </section>
        ) : null}
      </article>
      <CtaSection ctx={ctx} hub={hub} pageKey={`${hub.slug}/${page.slug}`} pageTitle={page.title} />
    </>
  );
}
