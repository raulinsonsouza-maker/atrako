import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { BrandThemeScope } from "@/components/brand/BrandThemeScope";
import { SubNavFrosted } from "@/components/ui/sub-nav-frosted";
import { SiteFooter } from "@/components/ui/site-footer";
import { GeoConsent } from "@/components/geo-hub/GeoConsent";
import { loadGeoContext } from "@/lib/geo-hub/request";

/** Casca pública do guia no domínio do cliente (/guia, /privacidade, 404). */
export default async function GeoSiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ host: string }>;
}) {
  const ctx = await loadGeoContext((await params).host);
  if (!ctx) notFound();
  const { site, facts, linker, brand, tracking } = ctx;
  const entity = ctx.pages.find((p) => p.type === "entity");
  const year = new Date().getFullYear();

  return (
    <BrandThemeScope primaryColor={brand?.primaryColor} className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      {linker.preview ? (
        <p className="geo-preview-bar type-caption-strong">Prévia do guia · rascunhos visíveis · não indexado</p>
      ) : null}
      <SubNavFrosted
        title={facts.brand}
        links={[
          { href: linker.guide(), label: "Guia" },
          ...site.hubs.slice(0, 3).map((h) => ({ href: linker.guide(h.slug), label: h.title })),
        ]}
        ctaHref={`${linker.guide()}#cadastro`}
        ctaLabel="Receba a apresentação"
      />
      <main id="conteudo">{children}</main>
      <SiteFooter
        columns={[
          {
            title: "Guia",
            links: site.hubs.map((h) => ({ href: linker.guide(h.slug), label: h.title })),
          },
          {
            title: facts.brand,
            links: [
              ...(entity ? [{ href: linker.guide(entity.slug), label: `Quem é a ${facts.brand}` }] : []),
              { href: linker.site("/"), label: "Página da franquia" },
              ...(facts.officialSite ? [{ href: facts.officialSite, label: "Site oficial" }] : []),
            ],
          },
          {
            title: "Contato",
            links: [
              ...(facts.contact.email ? [{ href: `mailto:${facts.contact.email}`, label: facts.contact.email }] : []),
              ...(facts.contact.phone ? [{ href: `tel:${facts.contact.phone.replace(/\D/g, "")}`, label: facts.contact.phone }] : []),
              { href: linker.site("/privacidade"), label: "Privacidade e cookies" },
            ],
          },
        ]}
        legal={`© ${year} ${facts.legalName || facts.brand}${facts.cnpj ? ` · CNPJ ${facts.cnpj}` : ""}. Conteúdo informativo; condições da franquia são apresentadas pela equipe comercial.`}
      />
      {linker.preview ? null : (
        <GeoConsent
          pixelId={tracking?.pixelId}
          ga4Id={tracking?.ga4MeasurementId}
          privacyHref={linker.site("/privacidade")}
        />
      )}
    </BrandThemeScope>
  );
}
