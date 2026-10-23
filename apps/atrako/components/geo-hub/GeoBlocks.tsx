import Link from "next/link";
import type { FormField } from "@atrako/forms";
import { getCaptureFormBySlug } from "@/lib/modules/capture-form";
import { flattenFields, stripConsentFromSteps } from "@/lib/criar/form-test";
import { CHOICE_MAP } from "@/lib/qualification/choices";
import type { GeoFacts } from "@/lib/geo-hub/facts";
import type { GeoContext } from "@/lib/geo-hub/request";
import { pageSegments, type GeoHubData, type GeoPageRow } from "@/lib/geo-hub/site";
import { buttonClass } from "@/components/ui/button";
import { GeoLeadForm } from "./GeoLeadForm";

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Você está em" className="geo-breadcrumbs type-caption">
      <ol>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`}>
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function FactsBox({ facts, title }: { facts: GeoFacts; title?: string }) {
  const rows: { label: string; value: string }[] = [];
  if (facts.offer) rows.push({ label: "Modelo", value: facts.offer });
  if (facts.investment) rows.push({ label: "Investimento", value: facts.investment.label });
  if (facts.foundedYear) rows.push({ label: "Atuação desde", value: String(facts.foundedYear) });
  if (facts.units) rows.push({ label: "Unidades", value: String(facts.units) });
  if (facts.areaServed) rows.push({ label: "Onde atua", value: facts.areaServed });
  return (
    <aside className="geo-facts" aria-label={title ?? `Fatos sobre a ${facts.brand}`}>
      <p className="type-caption-strong">{title ?? `Fatos sobre a ${facts.brand}`}</p>
      {rows.length ? (
        <dl>
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="type-fine-print">{r.label}</dt>
              <dd className="type-body-strong">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {facts.highlights.length ? (
        <ul className="type-caption">
          {facts.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}
      {facts.investment?.note ? <p className="type-fine-print">{facts.investment.note}</p> : null}
    </aside>
  );
}

export function PageList({
  pages,
  hubs,
  linker,
}: {
  pages: GeoPageRow[];
  hubs: GeoHubData[];
  linker: GeoContext["linker"];
}) {
  if (!pages.length) return null;
  return (
    <ul className="geo-page-list">
      {pages.map((p) => {
        const hub = hubs.find((h) => h.id === p.hubId);
        const [a, b] = pageSegments(hub?.slug ?? "", p);
        return (
          <li key={p.id}>
            <Link href={linker.guide(a, b)}>
              <span className="type-body-strong">{p.title}</span>
              <span className="type-caption">{p.description}</span>
              {p.status !== "PUBLISHED" ? <span className="geo-status type-fine-print">{p.status}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function howFoundOptions() {
  return (CHOICE_MAP.how_found ?? []).map((o) => ({ value: o.code, label: o.label }));
}

/** Seção de conversão com o CaptureForm do hub (ou link, se o hub não tiver form). */
export async function CtaSection({
  ctx,
  hub,
  pageKey,
  pageTitle,
}: {
  ctx: GeoContext;
  hub: GeoHubData | null;
  pageKey: string;
  pageTitle: string;
}) {
  const formSlug = hub?.ctaFormSlug ?? ctx.site.hubs.find((h) => h.ctaFormSlug)?.ctaFormSlug ?? null;
  const form = formSlug ? await getCaptureFormBySlug(formSlug) : null;
  const usable = form && form.clienteId === ctx.site.clienteId ? form : null;
  const fields: FormField[] = usable ? flattenFields(stripConsentFromSteps(usable.steps)).filter((f) => f.id !== "how_found") : [];
  const label = hub?.ctaLabel || "Receba a apresentação da franquia";
  const { facts } = ctx;
  return (
    <section id="cadastro" className="geo-cta" aria-labelledby="geo-cta-title">
      <div className="geo-cta-copy">
        <p className="type-caption-strong text-[var(--primary)]">PRÓXIMO PASSO</p>
        <h2 id="geo-cta-title" className="type-display-md">
          {label}
        </h2>
        <p className="type-body text-[var(--ink-muted-80)]">
          Deixe seus dados e a equipe da {facts.brand} apresenta o modelo, a disponibilidade para sua cidade e as
          condições completas da franquia.
        </p>
        <ol className="geo-steps type-caption">
          <li>Preencha seus dados</li>
          <li>A equipe chama no WhatsApp</li>
          <li>Você recebe a apresentação e as condições</li>
        </ol>
      </div>
      {usable && fields.length ? (
        <GeoLeadForm
          formSlug={usable.slug}
          fields={fields}
          title="Quero conhecer a franquia"
          lead="Leva menos de 1 minuto."
          submitLabel="Receber a apresentação"
          brand={facts.brand}
          pageKey={pageKey}
          pageTitle={pageTitle}
          howFoundOptions={howFoundOptions()}
          howFoundLabel={`Como você conheceu a ${facts.brand}?`}
        />
      ) : (
        <div className="capture-form-card">
          <a href={hub?.ctaUrl || `${ctx.linker.site("/")}#cadastro`} className={buttonClass({ variant: "store-hero", className: "w-full" })}>
            {label}
          </a>
        </div>
      )}
    </section>
  );
}

export function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(d);
}
