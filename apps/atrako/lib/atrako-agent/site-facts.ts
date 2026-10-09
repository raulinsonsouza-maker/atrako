/**
 * Fatos visíveis no HTML/CSS da loja. Sem rede: a leitura de verdade fica em site-brand.
 */

export type SiteBrand = {
  accent: string | null;
  paper: string | null;
  ink: string | null;
  font: string | null;
};

const DEFAULT_COLOR = /^(primary|secondary|text|accent)$/i;

function expandHex(hex: string): string {
  const raw = hex.replace("#", "").trim();
  const h = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw.slice(0, 6);
  return `#${h.toUpperCase()}`;
}

function channels(hex: string): [number, number, number] {
  const h = expandHex(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function lightness(hex: string): number {
  const [r, g, b] = channels(hex);
  return (r + g + b) / 3;
}

function chroma(hex: string): number {
  const [r, g, b] = channels(hex);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function isNeutral(hex: string): boolean {
  const light = lightness(hex);
  if (light > 242 || light < 22) return true;
  return chroma(hex) < 16;
}

/** Cores e fonte do kit (Elementor e variáveis parecidas). Ignora preto, branco e cinza. */
export function brandFromCss(css: string): SiteBrand {
  const vars = [...css.matchAll(/--e-global-color-([a-z0-9]+)\s*:\s*(#[0-9a-fA-F]{3,8})/gi)];
  const custom = vars.filter((v) => !DEFAULT_COLOR.test(v[1])).map((v) => expandHex(v[2]));
  const colored = custom.filter((hex) => !isNeutral(hex) && lightness(hex) < 210);
  const counts = new Map<string, number>();
  for (const hex of colored) counts.set(hex, (counts.get(hex) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || chroma(b[0]) - chroma(a[0]));
  const fallback = vars.find((v) => v[1].toLowerCase() === "accent")?.[2] ?? vars.find((v) => v[1].toLowerCase() === "primary")?.[2];
  const accent = ranked[0]?.[0] ?? (fallback ? expandHex(fallback) : null);
  const paper = custom
    .filter((hex) => lightness(hex) >= 180 && lightness(hex) <= 242)
    .sort((a, b) => lightness(b) - lightness(a))[0] ?? null;
  const ink = custom
    .filter((hex) => lightness(hex) < 45)
    .sort((a, b) => lightness(a) - lightness(b))[0] ?? null;
  const font =
    css.match(/--e-global-typography-primary-font-family\s*:\s*"([^"]+)"/i)?.[1] ??
    css.match(/--e-global-typography-primary-font-family\s*:\s*'([^']+)'/i)?.[1] ??
    null;
  return { accent, paper, ink, font };
}

export function brandLine(brand: SiteBrand): string {
  const parts = [
    brand.accent ? `cor de destaque ${brand.accent}` : null,
    brand.paper ? `fundo ${brand.paper}` : null,
    brand.ink ? `texto ${brand.ink}` : null,
    brand.font ? `fonte ${brand.font}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? `a cara do site: ${parts.join(", ")}` : "";
}

/** Foto principal do produto. Ignora logo e ícone. */
export function productImageFromHtml(html: string): string | null {
  const found = [
    ...html.matchAll(/property=["']og:image["'][^>]*content=["'](https:[^"']+)["']/gi),
    ...html.matchAll(/content=["'](https:[^"']+)["'][^>]*property=["']og:image["']/gi),
    ...html.matchAll(/class=["'][^"']*wp-post-image[^"']*["'][^>]*src=["'](https:[^"']+)["']/gi),
    ...html.matchAll(/src=["'](https:[^"']+)["'][^>]*class=["'][^"']*wp-post-image/gi),
  ];
  for (const match of found) {
    const url = match[1]?.replace(/&amp;/g, "&");
    if (url && !/logo|icon|favicon|sprite/i.test(url)) return url;
  }
  return null;
}

/** Primeiro preço de vitrine maior que zero. Ignora R$ 0,00 de carrinho vazio. */
export function priceReaisFromHtml(html: string): number | null {
  const amounts = [...html.matchAll(/woocommerce-Price-amount[\s\S]{0,240}?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g)]
    .map((match) => Number(match[1].replace(/\./g, "").replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 100_000);
  return amounts[0] ?? null;
}

export function productUrlFromHtml(html: string, token: string): string | null {
  const needle = token.toLowerCase();
  if (needle.length < 4) return null;
  const links = html.match(/https?:\/\/[^"'\\\s<>]+/g) ?? [];
  for (const href of links) {
    const clean = href.replace(/&amp;/g, "&").replace(/[),.;]+$/, "");
    if (clean.toLowerCase().includes(needle) && /\/loja\/|\/product\/|\/produto\//i.test(clean)) return clean;
  }
  return null;
}

export function stripStickyPromo(text: string): string {
  return text
    .replace(/#{0,6}\s*descontos imperd[ií]veis[\s\S]{0,600}?fretegratis[^\n]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function focusOnTitle(text: string, title: string): string {
  const clean = stripStickyPromo(text);
  const needle = title.trim().slice(0, 24).toLowerCase();
  if (needle.length < 8) return clean;
  const at = clean.toLowerCase().indexOf(needle);
  if (at < 0) return clean;
  return clean.slice(Math.max(0, at - 80));
}

function offerFromProduct(title: string | null, text: string | null): string {
  const clean = stripStickyPromo(text ?? "");
  const line = clean
    .split("\n")
    .map((row) => row.trim())
    .find((row) => row.length >= 40 && !/descontos imperd/i.test(row));
  return [title?.trim(), line].filter(Boolean).join(". ").slice(0, 500);
}

/** Completa o que a loja já disse, para a ferramenta não perguntar de novo. */
export function completeBriefFromSite(input: {
  briefing: string;
  publico: string;
  estilo: string;
  cta: string;
  goal: "leads" | "sales";
  said: string;
  productTitle: string | null;
  productText: string | null;
  priceCents: number | null;
  brand: SiteBrand | null;
}): { briefing: string; publico: string; estilo: string; cta: string; priceCents: number } {
  const said = input.said;
  const pointed = /nosso site|do site|no site|da marca|identidade|pegue|pegar/i.test(said) || Boolean(input.brand);
  let briefing = input.briefing.trim();
  if (briefing.length < 20) {
    const offer = offerFromProduct(input.productTitle, input.productText);
    if (offer.length >= 20) briefing = offer;
  }
  let publico = input.publico.trim();
  if (publico.length < 3 && pointed && input.productTitle) publico = "quem chega pela loja atrás deste produto";
  let estilo = input.estilo.trim();
  const visual = input.brand ? brandLine(input.brand) : "";
  if (estilo.length < 3 && visual) estilo = visual;
  else if (estilo.length < 3 && pointed) estilo = "as cores, a fonte e o formato do site da marca";
  let cta = input.cta.trim();
  if (cta.length < 2 && /comprar agora/i.test(said)) cta = "Comprar agora";
  else if (cta.length < 2 && input.goal === "sales" && pointed) cta = "Comprar agora";
  const priceCents = input.priceCents && input.priceCents > 0 ? Math.round(input.priceCents) : 0;
  return { briefing, publico, estilo, cta, priceCents };
}
