import type { LpGoal } from "./lp-schema";

/**
 * LP v3 — partes sem dependência (seguras no cliente): tipo, guarda, fontes e marcadores.
 * Sanitização e escopo de CSS ficam em `lp-html.ts` (só servidor).
 */

export const LP_V3_SCOPE = "atrako-lp-v3";
export const LP_SLOT_CLASS = "atrako-slot";

export type LpV3Theme = { accent?: string; accentInk?: string; surface?: "light" | "dark" };

/** Foto de banco usada na página. A view renderiza o crédito; a IA não escreve a atribuição. */
export type LpStockCredit = {
  id: string;
  url: string;
  alt: string;
  author: string;
  authorUrl: string;
  photoUrl: string;
  downloadLocation: string;
  tracked: boolean;
};

export type LpV3GalleryItem = {
  src: string;
  alt: string;
  kind?: "image" | "video";
  poster?: string;
};

export type LpV3Layer = {
  id: number;
  title: string;
  body?: string;
  imageUrl: string;
};

/**
 * UX do slot `<atrako-checkout>` via Pages (publish-lp).
 * Defaults no CheckoutForm = comportamento atual se omitido.
 */
export type LpCheckoutUiConfig = {
  offerTitle?: string;
  offerCta?: string;
  /** Título do form (ex.: "Finalize sua compra"). */
  formTitle?: string;
  /** Linha sob o título (tamanho · preço). Default true. */
  showHeadSubtitle?: boolean;
  /** Stepper 1/2/3. Default true. */
  showStepper?: boolean;
  /** Lista de benefícios na oferta; `false` esconde. */
  perks?: string[] | false;
  summaryMode?: "compact" | "detailed";
  termsMode?: "onContinue" | "switch";
  /** Repetir nota de termos no passo pagamento (onContinue). Default false. */
  showTermsOnPayment?: boolean;
  termsShort?: string;
  privacyShort?: string;
  draftLocalStorage?: boolean;
  lockAddressFromCep?: boolean;
  /** Default true. `false` esconde o campo cupom. */
  showCoupon?: boolean;
  backLabel?: string;
  continueToAddressLabel?: string;
  continueToPaymentLabel?: string;
  payLabels?: {
    pix?: string;
    card?: string;
    /** Subtítulo do tile Pix (ex.: "15% de desconto"). */
    pixHint?: string;
    /** Subtítulo do tile cartão (ex.: "até 10x sem juros"). */
    cardHint?: string;
    finalizePix?: string;
    finalizeCard?: string;
  };
};

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
  images?: LpStockCredit[];
  updatedAt?: string;
  /** Desconto Pix (Pages / Mood). */
  pixDiscountPercent?: number;
  /** Widget `<atrako-gallery>`. */
  gallery?: LpV3GalleryItem[];
  /** Widget `<atrako-layers>`. */
  layers?: LpV3Layer[];
  layersTitle?: string;
  layersHint?: string;
  /** Copy/flags do checkout (publish-lp, sem rebuild). */
  checkout?: LpCheckoutUiConfig;
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

export type LpSlotKind = "form" | "checkout" | "gallery" | "layers";

/**
 * Troca os marcadores por divs-âncora onde o React monta os componentes nativos (portal).
 * Só o primeiro de cada é usado; âncora `#form` / `#checkout` se o HTML não tiver uma.
 */
export function renderSlots(html: string): string {
  const slot = (kind: LpSlotKind) => {
    const id =
      (kind === "form" || kind === "checkout") && !new RegExp(`\\sid="${kind}"`, "i").test(html)
        ? ` id="${kind}"`
        : kind === "gallery" || kind === "layers"
          ? ` id="${kind}"`
          : "";
    return `<div class="${LP_SLOT_CLASS}" data-atrako-slot="${kind}"${id}></div>`;
  };
  const seen: Record<LpSlotKind, boolean> = {
    form: false,
    checkout: false,
    gallery: false,
    layers: false,
  };
  const once = (kind: LpSlotKind) => () => (seen[kind] ? "" : ((seen[kind] = true), slot(kind)));
  return html
    .replace(/<atrako-form>\s*<\/atrako-form>|<atrako-form\s*\/?>/gi, once("form"))
    .replace(/<atrako-checkout>\s*<\/atrako-checkout>|<atrako-checkout\s*\/?>/gi, once("checkout"))
    .replace(/<atrako-gallery>\s*<\/atrako-gallery>|<atrako-gallery\s*\/?>/gi, once("gallery"))
    .replace(/<atrako-layers>\s*<\/atrako-layers>|<atrako-layers\s*\/?>/gi, once("layers"));
}
