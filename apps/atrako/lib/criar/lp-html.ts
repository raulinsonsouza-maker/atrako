import sanitizeHtml from "sanitize-html";
import type { LpGoal } from "./lp-schema";
import { LP_SLOT_CLASS, LP_V3_SCOPE, hasCheckoutSlot, hasFormSlot, type LpSalesPageV3, type LpV3Theme } from "./lp-v3";

export * from "./lp-v3";

/**
 * LP v3 — HTML/CSS gerados pela IA, sanitizados e com escopo.
 * O HTML nunca carrega script; formulário e checkout entram por marcadores
 * (`<atrako-form>` / `<atrako-checkout>`) e são componentes nativos do Atrako.
 */

export const MAX_LP_HTML = 120_000;
export const MAX_LP_CSS = 60_000;
const MAX_FONTS = 3;

// ── HTML ──

const SVG_TAGS = [
  "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "defs",
  "lineargradient", "radialgradient", "stop", "clippath", "mask", "symbol", "title",
];
const SVG_ATTRS = [
  "viewbox", "xmlns", "fill", "fill-rule", "fill-opacity", "clip-rule", "clip-path", "stroke", "stroke-width",
  "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-opacity", "opacity", "d", "cx", "cy", "r",
  "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "points", "transform", "offset", "stop-color", "stop-opacity",
  "gradientunits", "gradienttransform", "preserveaspectratio", "width", "height", "mask",
];

const ALLOWED_TAGS = [
  "header", "footer", "main", "section", "article", "aside", "nav", "div", "span",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "ul", "ol", "li", "dl", "dt", "dd",
  "strong", "em", "b", "i", "u", "s", "small", "mark", "sup", "sub", "br", "hr",
  "img", "picture", "source", "figure", "figcaption", "blockquote", "cite", "q", "time",
  "details", "summary", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "button", "address", "abbr",
  "atrako-form", "atrako-checkout",
  ...SVG_TAGS,
];

const BAD_STYLE = /expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding|@import|<\/?\s*style/i;

function cleanUrls(css: string): string {
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (m, _q, url: string) =>
    /^(https:\/\/|data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,])/i.test(url.trim()) ? m : "none",
  );
}

function cleanInlineStyle(style: string): string | null {
  if (BAD_STYLE.test(style)) return null;
  return cleanUrls(style);
}

/** Aceita documento inteiro ou fragmento; separa `<style>` embutidos para o CSS. */
export function extractBodyAndStyles(raw: string): { html: string; css: string } {
  let html = raw.replace(/^\uFEFF/, "").trim();
  const fence = html.match(/^```(?:html)?\s*([\s\S]*?)```$/i);
  if (fence) html = fence[1].trim();
  const styles: string[] = [];
  html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_m, css: string) => {
    styles.push(css);
    return "";
  });
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (body) html = body[1];
  else html = html.replace(/<!doctype[^>]*>/i, "").replace(/<\/?html[^>]*>/gi, "").replace(/<head[\s\S]*?<\/head>/i, "");
  return { html: html.trim(), css: styles.join("\n") };
}

export function sanitizeLpHtml(raw: string): string {
  const out = sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": ["class", "id", "style", "role", "title", "lang", "dir", "aria-*", "data-*", "tabindex"],
      a: ["href", "target", "rel"],
      img: ["src", "srcset", "sizes", "alt", "width", "height", "loading", "decoding"],
      source: ["srcset", "media", "type", "sizes"],
      details: ["open"],
      time: ["datetime"],
      button: ["type"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
      ...Object.fromEntries(SVG_TAGS.map((t) => [t, SVG_ATTRS])),
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https", "data"], source: ["https"] },
    allowedSchemesAppliedToAttributes: ["href", "src", "srcset"],
    allowProtocolRelative: false,
    parseStyleAttributes: false,
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "embed", "template"],
    transformTags: {
      a: (tagName, attribs) => {
        const next = { ...attribs };
        if (next.target && next.target !== "_self") {
          next.target = "_blank";
          next.rel = "noopener noreferrer";
        }
        return { tagName, attribs: next };
      },
      button: (tagName, attribs) => ({ tagName, attribs: { ...attribs, type: "button" } }),
      "atrako-form": () => ({ tagName: "atrako-form", attribs: {} }),
      "atrako-checkout": () => ({ tagName: "atrako-checkout", attribs: {} }),
    },
  });
  return out.replace(/\sstyle="([^"]*)"/gi, (_m, value: string) => {
    const decoded = value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
    const clean = cleanInlineStyle(decoded);
    return clean ? ` style="${clean.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"` : "";
  });
}

// ── CSS ──

/** Acha o `}` que fecha o bloco aberto em `open` (respeita strings). */
function matchBrace(css: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return css.length;
}

/** Divide por vírgula fora de parênteses/colchetes. */
function splitSelectors(sel: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of sel) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/* A âncora e o conteúdo dela (form/checkout nativos) ficam fora do CSS da página. */
const NOT_SLOT = `:not(.${LP_SLOT_CLASS}, .${LP_SLOT_CLASS} *)`;

export function scopeSelector(sel: string, scope = `.${LP_V3_SCOPE}`): string {
  const s = sel.replace(/\s+/g, " ").trim();
  const root = s.match(/^(?:(?::root|html|body)(?![\w-]))(?:\s*(?::root|html|body)(?![\w-]))*/i);
  if (root) {
    const rest = s.slice(root[0].length);
    if (!rest.trim()) return scope;
    // body.dark / body > main / body h1
    return /^[.#:[]/.test(rest) ? `${scope}${rest}` : `${scope} ${rest.trim()}`;
  }
  const pseudo = s.match(/(::?(?:before|after|placeholder|selection|marker|first-line|first-letter|backdrop))$/i);
  const base = pseudo ? s.slice(0, -pseudo[1].length) : s;
  return `${scope} ${base || "*"}${NOT_SLOT}${pseudo ? pseudo[1] : ""}`;
}

const KEEP_AT = /^@(keyframes|-webkit-keyframes|font-face|property|counter-style|page)\b/i;
const NEST_AT = /^@(media|supports|container|layer)\b/i;

function cleanDeclarations(body: string): string {
  return cleanUrls(
    body
      .split(";")
      .filter((decl) => decl.trim() && !BAD_STYLE.test(decl))
      .join(";"),
  );
}

export function scopeCss(input: string, scope = `.${LP_V3_SCOPE}`): string {
  const css = input.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<\/?\s*style[^>]*>/gi, "");
  let out = "";
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    const semi = css.indexOf(";", i);
    // @import / @charset / @namespace (sem bloco) são descartados.
    if (semi !== -1 && (open === -1 || semi < open) && css.slice(i, semi).trim().startsWith("@")) {
      i = semi + 1;
      continue;
    }
    if (open === -1) break;
    const prelude = css.slice(i, open).trim();
    const close = matchBrace(css, open);
    const body = css.slice(open + 1, close);
    i = close + 1;
    if (!prelude) continue;
    if (prelude.startsWith("@")) {
      if (NEST_AT.test(prelude)) out += `${prelude}{${scopeCss(body, scope)}}\n`;
      else if (KEEP_AT.test(prelude)) out += `${prelude}{${/^@font-face/i.test(prelude) ? cleanDeclarations(body) : cleanUrls(body)}}\n`;
      continue;
    }
    const selectors = splitSelectors(prelude).map((sel) => scopeSelector(sel, scope));
    if (selectors.length) out += `${selectors.join(",")}{${cleanDeclarations(body)}}\n`;
  }
  return out;
}

// ── fontes ──

const FONT_RE = /^[A-Za-z][A-Za-z0-9 ]{1,40}(?::(?:ital,)?wght@[0-9;,.]{1,60})?$/;

export function sanitizeFonts(fonts: unknown): string[] {
  if (!Array.isArray(fonts)) return [];
  return [...new Set(fonts.map((f) => (typeof f === "string" ? f.trim() : "")).filter((f) => FONT_RE.test(f)))].slice(0, MAX_FONTS);
}

// ── tema ──

const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function sanitizeTheme(raw: unknown): LpV3Theme | undefined {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const accent = typeof o.accent === "string" && HEX.test(o.accent.trim()) ? o.accent.trim() : undefined;
  if (!accent && o.surface !== "dark" && o.surface !== "light") return undefined;
  return {
    ...(accent ? { accent, accentInk: luminance(accent) > 0.45 ? "#1d1d1f" : "#ffffff" } : {}),
    surface: o.surface === "dark" ? "dark" : "light",
  };
}

// ── montagem e validação ──

export type LpV3Input = {
  goal: LpGoal;
  html: string;
  css?: string;
  fonts?: unknown;
  theme?: unknown;
  formId?: string | null;
  checkoutProductId?: string | null;
  brief: string;
  references?: string[];
  generatedBy?: string;
};

export function buildSalesPageV3(input: LpV3Input): LpSalesPageV3 {
  const extracted = extractBodyAndStyles(input.html);
  const html = sanitizeLpHtml(extracted.html).slice(0, MAX_LP_HTML);
  const rawCss = `${extracted.css}\n${input.css ?? ""}`.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  const css = scopeCss(rawCss).slice(0, MAX_LP_CSS);
  const cssSource = rawCss.replace(/<\/?\s*style[^>]*>/gi, "").replace(/@import[^;]*;/gi, "").slice(0, MAX_LP_CSS);
  const fonts = sanitizeFonts(input.fonts);
  const theme = sanitizeTheme(input.theme);
  return {
    version: 3,
    goal: input.goal,
    html,
    css,
    cssSource,
    ...(fonts.length ? { fonts } : {}),
    ...(theme ? { theme } : {}),
    ...(input.formId ? { formId: input.formId } : {}),
    ...(input.checkoutProductId ? { checkoutProductId: input.checkoutProductId } : {}),
    brief: input.brief.slice(0, 4000),
    ...(input.references?.length ? { references: input.references.slice(0, 10) } : {}),
    ...(input.generatedBy ? { generatedBy: input.generatedBy } : {}),
    updatedAt: new Date().toISOString(),
  };
}

export type LpIssue = { code: string; message: string };

const CLAIMS: Array<{ code: string; page: RegExp; source: RegExp; what: string }> = [
  { code: "claim_guarantee", page: /garantia/i, source: /garantia|reembols|devolu/i, what: "garantia" },
  { code: "claim_bonus", page: /b[ôo]nus/i, source: /b[ôo]nus|brinde/i, what: "bônus" },
  { code: "claim_testimonial", page: /depoimento|o que (nossos |nossas )?(clientes|alunos|pacientes|alunas) (dizem|falam)/i, source: /depoimento|avalia/i, what: "depoimentos" },
  { code: "claim_person", page: /\binstrutor|\binstrutora|quem (vai )?(te )?(ensina|conduz)|sobre (o|a) (mentor|mentora|especialista|professor|professora)/i, source: /instrutor|instrutora|professor|professora|mentor|mentora|especialista|ministrad|conduzid|dr\.|dra\./i, what: "apresentação de pessoa (instrutor/especialista)" },
  { code: "claim_access", page: /grava[cç][ãa]o|comunidade|grupo (exclusivo|vip|de alunos|de suporte|no whatsapp)|certificado|acesso vital[íi]cio/i, source: /grava|comunidade|grupo|certificad|vital[íi]ci/i, what: "item de entrega (gravação, grupo, certificado)" },
  { code: "claim_material", page: /material de apoio|apostila|e-?book/i, source: /material|apostila|e-?book|pdf/i, what: "material de apoio" },
];
const PROOF_NUMBER =
  /(\+?\s?\d[\d.,]*\s*(?:mil|k)?\s*\+?)\s*(alunos|alunas|clientes|empreendedores|pacientes|seguidores|avalia[cç][õo]es|atendimentos|vendas|empresas|pessoas|anos de experi[eê]ncia|anos de mercado)/gi;

export function htmlText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Afirmações que a IA costuma inventar (garantia, bônus, depoimentos, números de prova social) sem base no briefing. */
export function unsupportedClaims(html: string, source: string): LpIssue[] {
  const text = htmlText(html);
  const issues: LpIssue[] = [];
  for (const c of CLAIMS) {
    const hit = text.match(c.page);
    if (!hit || c.source.test(source)) continue;
    const around = text.slice(Math.max(0, (hit.index ?? 0) - 40), (hit.index ?? 0) + 60).trim();
    issues.push({ code: c.code, message: `A página traz ${c.what} que o usuário não informou ("…${around}…"). Remova essa seção/frase.` });
  }
  const numbers = ` ${source.replace(/(?<=\d)[.,](?=\d)/g, "").replace(/\D+/g, " ")} `;
  for (const m of text.matchAll(PROOF_NUMBER)) {
    const n = m[1].replace(/\D/g, "").replace(/^0+/, "");
    if (n && !numbers.includes(` ${n} `)) {
      issues.push({ code: "claim_number", message: `Número de prova social inventado: "${m[0].trim()}". Remova ou troque por algo do briefing.` });
      break;
    }
  }
  return issues;
}

/** Problemas objetivos que o designer precisa corrigir (usado na rodada de correção). */
export function validateLpV3(
  page: LpSalesPageV3,
  opts: { needsForm: boolean; needsCheckout: boolean; source?: string },
): LpIssue[] {
  const issues: LpIssue[] = [];
  const text = htmlText(page.html);
  if (text.length < 400) issues.push({ code: "thin", message: "A página tem pouco conteúdo (menos de 400 caracteres de texto). Escreva as seções completas." });
  if (!/<h1\b/i.test(page.html)) issues.push({ code: "h1", message: "Falta um <h1> com a promessa principal." });
  if ((page.html.match(/<h1\b/gi) ?? []).length > 1) issues.push({ code: "h1_multi", message: "Use só um <h1>." });
  if (opts.needsForm && !hasFormSlot(page.html)) issues.push({ code: "form_slot", message: "Falta o marcador <atrako-form></atrako-form> onde o formulário deve aparecer." });
  if (opts.needsCheckout && !hasCheckoutSlot(page.html)) issues.push({ code: "checkout_slot", message: "Falta o marcador <atrako-checkout></atrako-checkout> onde o checkout deve aparecer." });
  if (!opts.needsForm && hasFormSlot(page.html)) issues.push({ code: "form_extra", message: "Remova <atrako-form>: esta página não tem formulário." });
  if (!opts.needsCheckout && hasCheckoutSlot(page.html)) issues.push({ code: "checkout_extra", message: "Remova <atrako-checkout>: esta página não tem checkout." });
  if (/<img\b(?![^>]*\salt=)/i.test(page.html)) issues.push({ code: "img_alt", message: "Toda <img> precisa de alt." });
  if (/placeholder|lorem ipsum|cliente satisfeito|seu nome aqui|9{4}[\s\-‑]?9{4}|@(exemplo|example)\./i.test(text)) {
    issues.push({
      code: "placeholder",
      message: "Há texto de placeholder ou dado inventado (depoimento genérico, telefone 9999-9999, e-mail de exemplo). Remova a seção ou troque por conteúdo real do briefing.",
    });
  }
  if (/<section\b[^>]*class="[^"]*\bcontainer\b/i.test(page.html)) {
    issues.push({ code: "section_container", message: 'Não use class="container" no <section> (anula o padding da seção); coloque <div class="container"> dentro dele.' });
  }
  if (/<h1\b/i.test(page.html.match(/<header\b[\s\S]*?<\/header>/i)?.[0] ?? "")) {
    issues.push({ code: "hero_header", message: 'O hero está num <header>, sem o padding das seções: use <section class="hero"><div class="container">…</div></section>.' });
  }
  if (opts.source !== undefined) issues.push(...unsupportedClaims(page.html, opts.source));
  if (page.css.length < 600) issues.push({ code: "css_thin", message: "O CSS está curto demais — a página precisa de estilo completo (tipografia, espaçamento, cores, responsivo)." });
  if (!/@media/i.test(page.css)) issues.push({ code: "responsive", message: "Faltam regras @media para celular (max-width: 640px)." });
  return issues;
}
