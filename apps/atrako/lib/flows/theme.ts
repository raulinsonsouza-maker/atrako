/**
 * Tema único de e-mail por loja (EmailTheme rascunho/publicado).
 * Sem tema publicado: tema padrão gerado de logo + cor + nome (resolveBrand) — nunca bloqueia envio.
 */

import { prisma } from "@/lib/db";
import { loadMessagingPrefs, type MessagingPrefs } from "@/lib/flows/prefs";

export type EmailTone = "proximo" | "neutro" | "formal";

export const EMAIL_SAFE_FONTS = [
  { value: "helvetica", label: "Helvetica / Arial", stack: "Helvetica, Arial, sans-serif" },
  { value: "georgia", label: "Georgia (serifada)", stack: "Georgia, 'Times New Roman', serif" },
  { value: "verdana", label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  { value: "trebuchet", label: "Trebuchet", stack: "'Trebuchet MS', Helvetica, sans-serif" },
  { value: "system", label: "Sistema", stack: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
] as const;

export type EmailThemeConfig = {
  logoUrl: string | null;
  logoWidth: number;
  headerAlign: "center" | "left";
  headerBg: string;
  colors: {
    accent: string;
    buttonText: string;
    background: string;
    card: string;
    text: string;
    muted: string;
  };
  font: (typeof EMAIL_SAFE_FONTS)[number]["value"];
  buttonRadius: number;
  buttonUppercase: boolean;
  productCard: { showImage: boolean; showPrice: boolean };
  couponStyle: "dashed" | "solid";
  signature: { name: string | null; role: string | null; photoUrl: string | null };
  footer: {
    address: string | null;
    legal: string | null;
    socials: MessagingPrefs["socials"];
  };
  tone: EmailTone;
};

const HEX = /^#[0-9a-f]{6}$/i;

function hex(v: unknown, fallback: string) {
  return typeof v === "string" && HEX.test(v.trim()) ? v.trim() : fallback;
}

function s(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : null;
}

function httpsUrl(v: unknown): string | null {
  const x = s(v);
  return x && /^https?:\/\//i.test(x) ? x : null;
}

export function defaultTheme(brand: {
  logoUrl: string | null;
  primaryColor: string | null;
  storeName: string;
  prefs?: MessagingPrefs;
}): EmailThemeConfig {
  return {
    logoUrl: brand.logoUrl,
    logoWidth: 140,
    headerAlign: "center",
    headerBg: "#ffffff",
    colors: {
      accent: hex(brand.primaryColor, "#0066cc"),
      buttonText: "#ffffff",
      background: "#f5f5f7",
      card: "#ffffff",
      text: "#1d1d1f",
      muted: "#6e6e73",
    },
    font: "helvetica",
    buttonRadius: 6,
    buttonUppercase: false,
    productCard: { showImage: true, showPrice: true },
    couponStyle: "dashed",
    signature: { name: brand.storeName, role: null, photoUrl: null },
    footer: {
      address: brand.prefs?.footerAddress ?? null,
      legal: brand.prefs?.legalText ?? null,
      socials: brand.prefs?.socials ?? {},
    },
    tone: "proximo",
  };
}

/** Sanitiza JSON vindo da UI/banco sobre uma base. */
export function sanitizeTheme(raw: unknown, base: EmailThemeConfig): EmailThemeConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const c = (r.colors && typeof r.colors === "object" ? r.colors : {}) as Record<string, unknown>;
  const pc = (r.productCard && typeof r.productCard === "object" ? r.productCard : {}) as Record<string, unknown>;
  const sig = (r.signature && typeof r.signature === "object" ? r.signature : {}) as Record<string, unknown>;
  const f = (r.footer && typeof r.footer === "object" ? r.footer : {}) as Record<string, unknown>;
  const fontOk = EMAIL_SAFE_FONTS.some((x) => x.value === r.font);
  return {
    logoUrl: r.logoUrl === null ? null : httpsUrl(r.logoUrl) ?? base.logoUrl,
    logoWidth: Math.min(320, Math.max(60, Number(r.logoWidth) || base.logoWidth)),
    headerAlign: r.headerAlign === "left" ? "left" : r.headerAlign === "center" ? "center" : base.headerAlign,
    headerBg: hex(r.headerBg, base.headerBg),
    colors: {
      accent: hex(c.accent, base.colors.accent),
      buttonText: hex(c.buttonText, base.colors.buttonText),
      background: hex(c.background, base.colors.background),
      card: hex(c.card, base.colors.card),
      text: hex(c.text, base.colors.text),
      muted: hex(c.muted, base.colors.muted),
    },
    font: fontOk ? (r.font as EmailThemeConfig["font"]) : base.font,
    buttonRadius: Math.min(24, Math.max(0, Number(r.buttonRadius ?? base.buttonRadius))),
    buttonUppercase: typeof r.buttonUppercase === "boolean" ? r.buttonUppercase : base.buttonUppercase,
    productCard: {
      showImage: typeof pc.showImage === "boolean" ? pc.showImage : base.productCard.showImage,
      showPrice: typeof pc.showPrice === "boolean" ? pc.showPrice : base.productCard.showPrice,
    },
    couponStyle: r.couponStyle === "solid" ? "solid" : r.couponStyle === "dashed" ? "dashed" : base.couponStyle,
    signature: {
      name: sig.name === undefined ? base.signature.name : s(sig.name),
      role: sig.role === undefined ? base.signature.role : s(sig.role),
      photoUrl: sig.photoUrl === undefined ? base.signature.photoUrl : httpsUrl(sig.photoUrl),
    },
    footer: {
      address: f.address === undefined ? base.footer.address : s(f.address),
      legal: f.legal === undefined ? base.footer.legal : s(f.legal),
      socials:
        f.socials && typeof f.socials === "object"
          ? (f.socials as MessagingPrefs["socials"])
          : base.footer.socials,
    },
    tone: r.tone === "neutro" || r.tone === "formal" || r.tone === "proximo" ? r.tone : base.tone,
  };
}

export function fontStack(font: EmailThemeConfig["font"]) {
  return EMAIL_SAFE_FONTS.find((f) => f.value === font)?.stack ?? EMAIL_SAFE_FONTS[0].stack;
}

export async function loadBrandBase(workspaceId: string) {
  const [cliente, m] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: workspaceId }, select: { nome: true, logoUrl: true } }),
    loadMessagingPrefs(workspaceId),
  ]);
  const storeName = m.prefs.senderName || cliente?.nome || "Loja";
  return {
    storeName,
    prefs: m.prefs,
    timezone: m.timezone,
    currency: m.currency,
    base: defaultTheme({
      logoUrl: cliente?.logoUrl ?? null,
      primaryColor: m.primaryColor,
      storeName,
      prefs: m.prefs,
    }),
  };
}

/** Tema publicado (ou padrão). `draft: true` → rascunho para preview. */
export async function loadEmailTheme(workspaceId: string, opts?: { draft?: boolean }) {
  const [brand, row] = await Promise.all([
    loadBrandBase(workspaceId),
    prisma.emailTheme.findUnique({ where: { clienteId: workspaceId } }),
  ]);
  const raw = opts?.draft ? row?.draft ?? row?.published : row?.published;
  const theme = raw ? sanitizeTheme(raw, brand.base) : brand.base;
  // Rodapé obrigatório: completa com Config → Empresa quando o tema não define
  if (!theme.footer.address) theme.footer.address = brand.prefs.footerAddress;
  if (!Object.keys(theme.footer.socials ?? {}).length) theme.footer.socials = brand.prefs.socials;
  return { theme, brand, published: Boolean(row?.published) };
}
