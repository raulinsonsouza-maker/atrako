import type { GeoFacts } from "./facts";
import type { GeoFaq } from "./site";

type Json = Record<string, unknown>;

export function organizationLd(facts: GeoFacts, origin: string): Json {
  return {
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: facts.brand,
    ...(facts.legalName ? { legalName: facts.legalName } : {}),
    ...(facts.cnpj ? { taxID: facts.cnpj } : {}),
    ...(facts.foundedYear ? { foundingDate: String(facts.foundedYear) } : {}),
    description: facts.description,
    url: facts.officialSite || origin,
    ...(facts.logo ? { logo: absolute(facts.logo, origin) } : {}),
    ...(facts.areaServed ? { areaServed: facts.areaServed } : {}),
    ...(facts.address ? { address: { "@type": "PostalAddress", streetAddress: facts.address } } : {}),
    ...(facts.sameAs?.length ? { sameAs: facts.sameAs } : {}),
    ...(facts.contact.email || facts.contact.phone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "sales",
            ...(facts.contact.email ? { email: facts.contact.email } : {}),
            ...(facts.contact.phone ? { telephone: facts.contact.phone } : {}),
            areaServed: "BR",
            availableLanguage: "Portuguese",
          },
        }
      : {}),
  };
}

export function articleLd(input: {
  url: string;
  title: string;
  description: string;
  publishedAt?: Date | null;
  updatedAt: Date;
  origin: string;
  image?: string;
}): Json {
  return {
    "@type": "Article",
    "@id": `${input.url}#article`,
    headline: input.title.slice(0, 110),
    description: input.description,
    mainEntityOfPage: input.url,
    inLanguage: "pt-BR",
    ...(input.publishedAt ? { datePublished: input.publishedAt.toISOString() } : {}),
    dateModified: input.updatedAt.toISOString(),
    author: { "@id": `${input.origin}/#organization` },
    publisher: { "@id": `${input.origin}/#organization` },
    ...(input.image ? { image: absolute(input.image, input.origin) } : {}),
  };
}

export function faqLd(faq: GeoFaq[]): Json | null {
  if (!faq.length) return null;
  return {
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: item.url })),
  };
}

export function graph(...nodes: (Json | null)[]): string {
  const payload = { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
  // `</` dentro do JSON fecharia a tag <script>.
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}

function absolute(url: string, origin: string) {
  return /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}
