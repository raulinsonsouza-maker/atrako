/**
 * Fatos publicáveis do GeoSite: a única fonte de números e afirmações sobre a marca
 * usada nas páginas, no JSON-LD e no llms.txt. O que não está aqui não é publicado.
 */

export type GeoFacts = {
  brand: string;
  legalName?: string;
  cnpj?: string;
  foundedYear?: number;
  /** 1-2 frases: quem é a marca. */
  description: string;
  /** O que o guia oferece (ex.: "Franquia de marcas e patentes"). */
  offer: string;
  investment?: { amount: number; currency: string; label: string; note?: string };
  areaServed?: string;
  address?: string;
  contact: { email?: string; phone?: string; whatsapp?: string };
  officialSite?: string;
  /** Perfis oficiais (YouTube, Instagram, LinkedIn…) para `sameAs`. */
  sameAs?: string[];
  logo?: string;
  /** Imagem padrão de compartilhamento (og:image). */
  image?: string;
  /** Afirmações curtas e verificáveis para o quadro "Fatos". */
  highlights: string[];
  /** Temas que a página nunca responde com número (vão para a apresentação comercial). */
  undisclosed: string[];
  /** Frase usada quando a pergunta cai num tema de `undisclosed`. */
  undisclosedAnswer: string;
  units?: number;
};

function str(v: unknown, max = 500): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function strList(v: unknown, max = 30): string[] {
  return Array.isArray(v) ? v.map((x) => str(x, 300)).filter((x): x is string => Boolean(x)).slice(0, max) : [];
}

export function parseFacts(raw: unknown, fallbackBrand = ""): GeoFacts {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const inv = r.investment && typeof r.investment === "object" ? (r.investment as Record<string, unknown>) : null;
  const contact = r.contact && typeof r.contact === "object" ? (r.contact as Record<string, unknown>) : {};
  const amount = inv ? Number(inv.amount) : NaN;
  return {
    brand: str(r.brand, 160) ?? fallbackBrand,
    legalName: str(r.legalName, 200),
    cnpj: str(r.cnpj, 20),
    foundedYear: Number.isInteger(r.foundedYear) ? (r.foundedYear as number) : undefined,
    description: str(r.description, 600) ?? "",
    offer: str(r.offer, 200) ?? "",
    investment:
      inv && Number.isFinite(amount) && amount > 0
        ? {
            amount,
            currency: str(inv.currency, 8) ?? "BRL",
            label: str(inv.label, 60) ?? formatMoney(amount, str(inv.currency, 8) ?? "BRL"),
            note: str(inv.note, 300),
          }
        : undefined,
    areaServed: str(r.areaServed, 120),
    address: str(r.address, 300),
    contact: { email: str(contact.email, 160), phone: str(contact.phone, 40), whatsapp: str(contact.whatsapp, 40) },
    officialSite: str(r.officialSite, 300),
    sameAs: strList(r.sameAs, 12),
    logo: str(r.logo, 500),
    image: str(r.image, 500),
    highlights: strList(r.highlights, 12),
    undisclosed: strList(r.undisclosed, 20),
    undisclosedAnswer:
      str(r.undisclosedAnswer, 400) ??
      "As condições completas são apresentadas pela equipe comercial na Circular de Oferta de Franquia (COF).",
    units: Number.isInteger(r.units) ? (r.units as number) : undefined,
  };
}

export function formatMoney(amount: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

/** Números que podem aparecer no texto (valores, anos, contato). Tudo fora disso é suspeito. */
export function allowedNumbers(facts: GeoFacts): Set<string> {
  const out = new Set<string>();
  const add = (s?: string | number) => {
    if (s == null) return;
    for (const m of String(s).match(/\d[\d.,]*/g) ?? []) out.add(normalizeNumber(m));
  };
  add(facts.foundedYear);
  add(facts.units);
  add(facts.cnpj);
  add(facts.contact.phone);
  add(facts.contact.whatsapp);
  if (facts.investment) {
    add(facts.investment.amount);
    add(facts.investment.label);
    add(facts.investment.note);
  }
  for (const h of facts.highlights) add(h);
  add(facts.description);
  return out;
}

export function normalizeNumber(raw: string): string {
  return raw.replace(/[.,]00$/, "").replace(/[.,]/g, "");
}
