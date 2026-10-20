export type StoreTheme = {
  logoUrl: string | null;
  /** Vazio: a faixa usa o texto de frete grátis. */
  announce: string;
  about: string;
  instagram: string;
  whatsapp: string;
  email: string;
  hours: string;
};

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function asStoreTheme(raw: unknown): StoreTheme {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const logo = text(row.logoUrl, 500);
  return {
    logoUrl: logo || null,
    announce: text(row.announce, 180),
    about: text(row.about, 600),
    instagram: text(row.instagram, 160),
    whatsapp: text(row.whatsapp, 40),
    email: text(row.email, 160),
    hours: text(row.hours, 80),
  };
}

export function instagramHref(value: string) {
  const handle = value.trim().replace(/^@/, "");
  if (!handle) return null;
  if (/^https?:\/\//i.test(handle)) return handle;
  return `https://instagram.com/${handle}`;
}

export function instagramLabel(value: string) {
  const handle = value.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  return handle ? `@${handle.replace(/\/$/, "")}` : "";
}

export function whatsappHref(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}`;
}
