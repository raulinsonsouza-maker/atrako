/**
 * Política canônica: toda LP de cliente no Atrako é Pages (salesPage v3).
 * HTML/CSS/mídia = conteúdo publicável. Rebuild do atrako-web só para runtime.
 *
 * v1 (seções) e v2 (Puck) = legado somente leitura / migração.
 */

import { buildSalesPageV3, type LpSalesPageV3 } from "@/lib/criar/lp-html";
import type { LpGoal } from "@/lib/criar/lp-schema";
import { isLpSalesPageV3 } from "@/lib/criar/lp-v3";

export const LP_PAGES_FORMAT = "v3" as const;
export const LP_PAGES_GENERATED_BY = "lp-pages-publish";

/** True se a página já está no formato canônico Pages. */
export function isCanonicalLpPage(salesPage: unknown): salesPage is LpSalesPageV3 {
  return isLpSalesPageV3(salesPage);
}

/** Shell HTML mínimo com slots — ponto de partida para qualquer cliente. */
export function starterLpHtml(goal: LpGoal, headline: string): string {
  const safe = headline.replace(/</g, "").slice(0, 120) || "Sua oferta";
  if (goal === "leads") {
    return `<section class="sec-hero" data-section="hero">
  <h1>${safe}</h1>
  <p>Preencha o formulário e receba o acesso.</p>
</section>
<section class="sec-form" data-section="form" id="form">
  <atrako-form></atrako-form>
</section>
<section class="sec-faq" data-section="faq">
  <h2>Dúvidas</h2>
  <details><summary>É grátis?</summary><p>Sim. Preencha e enviaremos o material.</p></details>
</section>`;
  }
  return `<section class="sec-hero" data-section="hero">
  <h1>${safe}</h1>
  <p>Oferta com pagamento seguro.</p>
  <a href="#checkout">Quero comprar →</a>
</section>
<section class="sec-checkout" data-section="checkout" id="oferta">
  <atrako-checkout></atrako-checkout>
</section>
<section class="sec-faq" data-section="faq">
  <h2>Dúvidas</h2>
  <details><summary>Como recebo o acesso?</summary><p>Após o pagamento você recebe o link por e-mail.</p></details>
</section>`;
}

export function starterLpCss(): string {
  return `body{margin:0;font-family:system-ui,sans-serif;color:#162538;background:#fbfaf7}
.sec-hero,.sec-checkout,.sec-form,.sec-faq{max-width:40rem;margin:0 auto;padding:2rem 1.25rem}
h1{font-size:clamp(1.75rem,5vw,2.5rem);line-height:1.15;margin:0 0 0.75rem}
h2{font-size:1.35rem;margin:0 0 0.75rem}
p{line-height:1.6;color:#6f7780}
a{color:#6b9e3d;font-weight:600;text-decoration:none}
details{border-top:1px solid rgba(22,37,56,.12);padding:0.85rem 0}
summary{cursor:pointer;font-weight:600}`;
}

/** Cria salesPage v3 canônica a partir de um brief (substitui templates v1). */
export function seedPagesFromBrief(
  goal: LpGoal,
  brief: string,
): { name: string; priceCents: number; salesPage: LpSalesPageV3 } {
  const text = brief.trim();
  const firstLine = (text.split(/\n/)[0] || "Nova oferta").slice(0, 80);
  const priceMatch =
    text.match(/R\$\s*([\d.]+,\d{2})/i) || text.match(/R\$\s*([\d.,]+)/i);
  let priceCents = goal === "sales" ? 9700 : 0;
  if (priceMatch) {
    const raw = priceMatch[1]!;
    const n = raw.includes(",")
      ? Number(raw.replace(/\./g, "").replace(",", "."))
      : Number(raw.replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) {
      priceCents =
        n >= 1000 && !raw.includes(",") ? Math.round(n) : Math.round(n * 100);
    }
  }

  const salesPage = buildSalesPageV3({
    goal,
    html: starterLpHtml(goal, firstLine),
    css: starterLpCss(),
    fonts: ["DM Sans:wght@400;500;600;700"],
    theme: { accent: "#6B9E3D", accentInk: "#ffffff", surface: "light" },
    brief: text.slice(0, 4000) || firstLine,
    generatedBy: "lp-pages-seed",
  });

  return { name: firstLine, priceCents, salesPage };
}
