import { createHash } from "node:crypto";
import { isLpSectionKind, type LpSectionKind } from "./kinds";

export type RawSection = {
  kind: LpSectionKind;
  html: string;
  css: string;
};

const SECTION_RE = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;

function attr(tagAttrs: string, name: string): string {
  return tagAttrs.match(new RegExp(`\\s${name}=(["'])([^"']*)\\1`, "i"))?.[2] ?? "";
}

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

function selectorMatches(sel: string, marker: string): boolean {
  const s = sel.trim();
  return s === marker || s.startsWith(`${marker} `) || s.startsWith(`${marker}:`) || s.startsWith(`${marker}.`) || s.startsWith(`${marker}#`) || s.startsWith(`${marker}[`);
}

/** CSS cujo seletor começa com .sec-<tipo>, inclusive dentro de @media. */
export function cssForSection(css: string, kind: LpSectionKind): string {
  const marker = `.sec-${kind}`;
  let out = "";
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) break;
    const prelude = css.slice(i, open).trim();
    const close = matchBrace(css, open);
    const body = css.slice(open + 1, close);
    i = close + 1;
    if (!prelude) continue;
    if (/^@media\b/i.test(prelude)) {
      const inner = cssForSection(body, kind);
      if (inner) out += `${prelude}{${inner}}\n`;
      continue;
    }
    if (prelude.startsWith("@")) continue;
    const selectors = prelude.split(",").map((s) => s.trim()).filter((s) => selectorMatches(s, marker));
    if (selectors.length) out += `${selectors.join(",")}{${body}}\n`;
  }
  return out.trim();
}

export function splitSections(html: string, css: string): RawSection[] {
  const out: RawSection[] = [];
  for (const m of html.matchAll(SECTION_RE)) {
    const kind = attr(m[1], "data-section");
    if (!isLpSectionKind(kind)) continue;
    out.push({ kind, html: `<section${m[1]}>${m[2]}</section>`, css: cssForSection(css, kind) });
  }
  return out;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const HEX = /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi;

function placeholderFor(tag: string, index: number): string {
  if (tag === "h1") return "{{headline}}";
  if (tag === "h2" || tag === "h3") return `{{titulo_${index}}}`;
  if (tag === "a" || tag === "button") return "{{cta}}";
  if (tag === "li") return `{{item_${index}}}`;
  return `{{texto_${index}}}`;
}

/** Tira textos, contatos, imagens e a cor da marca. Sobra a estrutura. */
export function anonymizeSection(
  section: RawSection,
  opts: { brandName?: string | null; accent?: string | null },
): { html: string; css: string } {
  let n = 0;
  let html = section.html.replace(/<(h1|h2|h3|p|a|button|li|span)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag: string, attrs: string, inner: string) => {
    if (/<[a-z]/i.test(inner)) return full;
    const text = inner.replace(/\s+/g, " ").trim();
    if (!text || text.startsWith("{{")) return full;
    n += 1;
    return `<${tag}${attrs}>${placeholderFor(tag.toLowerCase(), n)}</${tag}>`;
  });
  html = html.replace(/<img\b[^>]*>/gi, '<img src="{{img:secao}}" alt="">');
  html = html.replace(EMAIL, "").replace(PHONE, "");
  if (opts.brandName && opts.brandName.length > 2) {
    html = html.replace(new RegExp(opts.brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
  }
  let css = section.css;
  if (opts.accent) {
    css = css.replace(new RegExp(opts.accent.replace("#", "\\#"), "gi"), "var(--primary)");
  }
  css = css.replace(HEX, (hex) => (hex.toLowerCase() === "#fff" || hex.toLowerCase() === "#ffffff" || hex.toLowerCase() === "#000" || hex.toLowerCase() === "#000000" ? hex : "var(--primary)"));
  return { html, css };
}

export function skeletonHash(html: string, css: string): string {
  const skeleton = `${html.replace(/\s+/g, " ").trim()}|${css.replace(/\s+/g, "")}`;
  return createHash("sha256").update(skeleton).digest("hex").slice(0, 24);
}

export function fxUsed(html: string): string[] {
  const data = [...html.matchAll(/\sdata-fx=(["'])([^"']+)\1/gi)].map((m) => m[2]);
  const cls = [...html.matchAll(/\sclass=(["'])([^"']+)\1/gi)].flatMap((m) => m[2].split(/\s+/).filter((c) => c.startsWith("fx-")));
  return [...new Set([...data, ...cls])];
}

const TRIVIAL = new Set(["rodape"]);

export function worthKeeping(section: RawSection): boolean {
  if (TRIVIAL.has(section.kind)) return false;
  const text = section.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length >= 40 || section.kind === "hero";
}
