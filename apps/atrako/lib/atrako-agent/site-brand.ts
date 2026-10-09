import "server-only";
import { fetchPublicText, htmlToText } from "./web";
import { brandFromCss, focusOnTitle, priceReaisFromHtml, productImageFromHtml, stripStickyPromo, type SiteBrand } from "./site-facts";

export type StoreLook = {
  url: string;
  title: string;
  text: string;
  priceCents: number | null;
  imageUrl: string | null;
  brand: SiteBrand | null;
};

function stylesheetUrls(html: string, pageUrl: string): string[] {
  const origin = new URL(pageUrl).origin;
  const kit = html.match(/elementor-kit-(\d+)/)?.[1];
  const found = [...html.matchAll(/(?:https?:)?\/\/[^"'\\\s]+\/uploads\/elementor\/css\/post-\d+\.css[^"'\\\s]*/g)].map((match) => {
    const href = match[0].startsWith("//") ? `https:${match[0]}` : match[0];
    return href.replace(/&amp;/g, "&");
  });
  const unique = [...new Set(found)].filter((href) => {
    try {
      return new URL(href, pageUrl).origin === origin;
    } catch {
      return false;
    }
  });
  unique.sort((a, b) => {
    const aKit = kit && a.includes(`post-${kit}.css`) ? 0 : 1;
    const bKit = kit && b.includes(`post-${kit}.css`) ? 0 : 1;
    return aKit - bKit;
  });
  return unique.slice(0, 2);
}

/** Lê o HTML da loja: preço de vitrine, texto do produto e cores do CSS. */
export async function inspectStorePage(raw: string, signal?: AbortSignal): Promise<StoreLook | null> {
  const page = await fetchPublicText(raw, signal).catch(() => null);
  if (!page) return null;
  const parsed = /text\/plain/i.test(page.type) ? { title: new URL(page.url).hostname, text: page.body } : htmlToText(page.body);
  const cssParts: string[] = [];
  for (const match of page.body.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (/--e-global-color-|font-family/i.test(match[1])) cssParts.push(match[1].slice(0, 80_000));
  }
  for (const href of stylesheetUrls(page.body, page.url)) {
    const sheet = await fetchPublicText(href, signal).catch(() => null);
    if (!sheet?.body.includes("--e-global-color-")) continue;
    cssParts.push(sheet.body.slice(0, 200_000));
    break;
  }
  const brand = brandFromCss(cssParts.join("\n"));
  const hasBrand = Boolean(brand.accent || brand.paper || brand.font);
  const reais = priceReaisFromHtml(page.body);
  const text = focusOnTitle(stripStickyPromo(parsed.text), parsed.title).slice(0, 4000);
  return {
    url: page.url,
    title: parsed.title.slice(0, 200),
    text,
    priceCents: reais ? Math.round(reais * 100) : null,
    imageUrl: productImageFromHtml(page.body),
    brand: hasBrand ? brand : null,
  };
}
