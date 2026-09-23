/** Campos de rastreio enviados no submit da LP → CRM. */

export type LpClientAttribution = {
  productId?: string;
  pageSlug?: string;
  pageUrl?: string;
  formSlug?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  referrer?: string;
};

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
] as const;

/** Lê UTMs / click IDs da URL atual (browser). */
export function collectClientAttribution(opts?: {
  productId?: string | null;
  pageSlug?: string | null;
  formSlug?: string | null;
}): LpClientAttribution {
  const out: LpClientAttribution = {};
  if (opts?.productId) out.productId = opts.productId;
  if (opts?.pageSlug) out.pageSlug = opts.pageSlug;
  if (opts?.formSlug) out.formSlug = opts.formSlug;

  if (typeof window === "undefined") return out;

  out.pageUrl = window.location.href;
  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of UTM_KEYS) {
      const v = params.get(key)?.trim();
      if (v) out[key] = v.slice(0, 200);
    }
  } catch {
    /* ignore */
  }
  const ref = document.referrer?.trim();
  if (ref) out.referrer = ref.slice(0, 500);
  return out;
}

/** Extrai atribuição de um body JSON da API. */
export function pickAttributionFromBody(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const keys = [
    "productId",
    "pageSlug",
    "pageUrl",
    "pageProductId",
    "checkoutProductId",
    "productType",
    "formSlug",
    "formId",
    "formName",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid",
    "fbclid",
    "referrer",
  ] as const;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const v = input[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, 500);
  }
  const nested = input.attribution;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    for (const [k, v] of Object.entries(nested as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim() && !(k in out)) {
        out[k] = v.trim().slice(0, 500);
      }
    }
  }
  return out;
}
