import type { LpGoal } from "./lp-schema";

/**
 * LP v3 — partes sem dependência (seguras no cliente): tipo, guarda, fontes e marcadores.
 * Sanitização e escopo de CSS ficam em `lp-html.ts` (só servidor).
 */

export const LP_V3_SCOPE = "atrako-lp-v3";
export const LP_SLOT_CLASS = "atrako-slot";

export type LpV3Theme = { accent?: string; accentInk?: string; surface?: "light" | "dark" };

export type LpSalesPageV3 = {
  version: 3;
  goal: LpGoal;
  html: string;
  /** CSS com escopo (o que é renderizado). */
  css: string;
  /** CSS original do designer, sem escopo — só para edições pela IA. */
  cssSource?: string;
  fonts?: string[];
  theme?: LpV3Theme;
  formId?: string;
  checkoutProductId?: string;
  brief: string;
  references?: string[];
  generatedBy?: string;
  updatedAt?: string;
  /** Versão anterior à última edição pela IA (para desfazer). */
  previous?: { html: string; css: string; cssSource?: string; updatedAt?: string };
};

export function isLpSalesPageV3(v: unknown): v is LpSalesPageV3 {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.version === 3 && (o.goal === "leads" || o.goal === "sales") && typeof o.html === "string";
}

export function googleFontsHref(fonts: string[]): string | null {
  if (!fonts.length) return null;
  const families = fonts.map((f) => `family=${f.replace(/ /g, "+")}`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

export function hasFormSlot(html: string) {
  return /<atrako-form\b/i.test(html);
}

export function hasCheckoutSlot(html: string) {
  return /<atrako-checkout\b/i.test(html);
}

/**
 * Troca os marcadores por divs-âncora onde o React monta os componentes nativos (portal).
 * Só o primeiro de cada é usado; âncora `#form` / `#checkout` se o HTML não tiver uma.
 */
export function renderSlots(html: string): string {
  const slot = (kind: "form" | "checkout") => {
    const id = new RegExp(`\\sid="${kind}"`, "i").test(html) ? "" : ` id="${kind}"`;
    return `<div class="${LP_SLOT_CLASS}" data-atrako-slot="${kind}"${id}></div>`;
  };
  let seenForm = false;
  let seenCheckout = false;
  return html
    .replace(/<atrako-form>\s*<\/atrako-form>|<atrako-form\s*\/?>/gi, () => (seenForm ? "" : ((seenForm = true), slot("form"))))
    .replace(/<atrako-checkout>\s*<\/atrako-checkout>|<atrako-checkout\s*\/?>/gi, () =>
      seenCheckout ? "" : ((seenCheckout = true), slot("checkout")),
    );
}
