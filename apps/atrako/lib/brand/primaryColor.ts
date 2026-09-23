/** Cor de marca do workspace — default Action Blue do DS. */

export const DEFAULT_PRIMARY = "#0066cc";
export const DEFAULT_PRIMARY_FOCUS = "#0071e3";
export const DEFAULT_PRIMARY_ON_DARK = "#2997ff";

const HEX_RE = /^#([0-9A-Fa-f]{6})$/;

export function normalizePrimaryHex(input: string | null | undefined): string | null {
  if (!input) return null;
  let v = input.trim();
  if (!v.startsWith("#")) v = `#${v}`;
  if (v.length === 4 && /^#[0-9A-Fa-f]{3}$/.test(v)) {
    v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  if (!HEX_RE.test(v)) return null;
  return v.toLowerCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Lighten toward white (for focus / on-dark link). */
function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

export type BrandPrimaryVars = {
  primary: string;
  primaryFocus: string;
  primaryOnDark: string;
  primaryGlow: string;
  highlight: string;
  highlightGlow: string;
  ring: string;
  accent: string;
};

export function resolveBrandPrimaryVars(
  primaryColor: string | null | undefined
): BrandPrimaryVars {
  const primary = normalizePrimaryHex(primaryColor) ?? DEFAULT_PRIMARY;
  const { r, g, b } = hexToRgb(primary);
  const focus =
    primary === DEFAULT_PRIMARY ? DEFAULT_PRIMARY_FOCUS : lighten(primary, 0.12);
  const onDark =
    primary === DEFAULT_PRIMARY ? DEFAULT_PRIMARY_ON_DARK : lighten(primary, 0.28);

  return {
    primary,
    primaryFocus: focus,
    primaryOnDark: onDark,
    primaryGlow: `rgba(${r}, ${g}, ${b}, 0.18)`,
    highlight: primary,
    highlightGlow: `rgba(${r}, ${g}, ${b}, 0.22)`,
    ring: focus,
    accent: primary,
  };
}

/** Aplica vars no elemento (html/body/wrapper). */
export function applyBrandPrimaryToElement(
  el: HTMLElement,
  primaryColor: string | null | undefined
) {
  const v = resolveBrandPrimaryVars(primaryColor);
  el.style.setProperty("--primary", v.primary);
  el.style.setProperty("--primary-focus", v.primaryFocus);
  el.style.setProperty("--primary-on-dark", v.primaryOnDark);
  el.style.setProperty("--primary-strong", v.primary);
  el.style.setProperty("--primary-glow", v.primaryGlow);
  el.style.setProperty("--highlight", v.highlight);
  el.style.setProperty("--highlight-glow", v.highlightGlow);
  el.style.setProperty("--ring", v.ring);
  el.style.setProperty("--accent", v.accent);
  el.style.setProperty("--badge-performance", v.primary);
  el.style.setProperty("--badge-strategy", v.primary);
}

export function clearBrandPrimaryFromElement(el: HTMLElement) {
  [
    "--primary",
    "--primary-focus",
    "--primary-on-dark",
    "--primary-strong",
    "--primary-glow",
    "--highlight",
    "--highlight-glow",
    "--ring",
    "--accent",
    "--badge-performance",
    "--badge-strategy",
  ].forEach((k) => el.style.removeProperty(k));
}
