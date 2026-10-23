import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { requestHost } from "@/lib/geo-hub/request";
import { LP_DOMAINS } from "@/lib/lp-domains";

export const metadata = { title: "Página não encontrada", robots: { index: false, follow: true } };

export default async function GeoNotFound() {
  const lp = LP_DOMAINS[await requestHost()];
  const guide = lp?.geoBasePath ?? "/";
  return (
    <section className="geo-wrap geo-hero geo-404">
      <p className="type-caption-strong text-[var(--primary)]">ERRO 404</p>
      <h1 className="type-display-lg">Esta página não existe.</h1>
      <p className="type-lead-airy text-[var(--ink-muted-80)]">O endereço pode ter mudado. Comece pelo guia ou pela página da franquia.</p>
      <div className="geo-404-actions">
        <Link href={guide} className={buttonClass({ variant: "primary" })}>
          Ir para o guia
        </Link>
        <Link href="/" className={buttonClass({ variant: "outline" })}>
          Página da franquia
        </Link>
      </div>
    </section>
  );
}
