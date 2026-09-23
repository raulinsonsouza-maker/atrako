export type EmailBrand = {
  slug: string;
  productLabel: string;
  accent: string;
  accentDeep: string;
  paper: string;
  ink: string;
  muted: string;
  hook: string;
  abandonHook: string;
  ctaDelivery: string;
  ctaAbandon: string;
};

const DEFAULT_BRAND: EmailBrand = {
  slug: "default",
  productLabel: "Seu e-book",
  accent: "#c96442",
  accentDeep: "#a84f33",
  paper: "#f5f4ef",
  ink: "#1a1917",
  muted: "#73726c",
  hook: "Seu material digital está pronto para baixar.",
  abandonHook: "Seu pedido ainda está aberto. Finalize agora e libere o acesso na hora.",
  ctaDelivery: "Baixar agora",
  ctaAbandon: "Concluir compra agora",
};

const BRANDS: Record<string, EmailBrand> = {
  "air-fryer-50-receitas": {
    slug: "air-fryer-50-receitas",
    productLabel: "50 Receitas na Air Fryer",
    accent: "#f26b1d",
    accentDeep: "#d85a12",
    paper: "#f7f7f7",
    ink: "#0e0e0e",
    muted: "#737373",
    hook: "Jantares fáceis, crocantes e sem enrolação. Seu guia está liberado.",
    abandonHook:
      "Você quase garantiu as 50 receitas. Finalize o PIX e comece a cozinhar hoje.",
    ctaDelivery: "Baixar meu guia agora",
    ctaAbandon: "Concluir compra agora",
  },
  "plantas-medicinais": {
    slug: "plantas-medicinais",
    productLabel: "Tratado das Plantas Medicinais",
    accent: "#2d4739",
    accentDeep: "#243a2e",
    paper: "#f5f2e9",
    ink: "#1f2e26",
    muted: "#5c6b62",
    hook: "Consulta clara, organizada e sempre à mão. Seu Tratado está liberado.",
    abandonHook:
      "Seu Tratado ainda está reservado. Finalize o pagamento e consulte quando quiser.",
    ctaDelivery: "Baixar o Tratado agora",
    ctaAbandon: "Concluir compra agora",
  },
  "100-melhores-bolos": {
    slug: "100-melhores-bolos",
    productLabel: "Os 100 Melhores Bolos",
    accent: "#d44a22",
    accentDeep: "#b33816",
    paper: "#fff6ee",
    ink: "#1a100c",
    muted: "#7a6356",
    hook: "Bolo caseiro que dá água na boca. Suas 100 receitas estão liberadas.",
    abandonHook:
      "Seu e-book de bolos ainda está esperando. Finalize o PIX e asse hoje mesmo.",
    ctaDelivery: "Baixar as 100 receitas",
    ctaAbandon: "Concluir compra agora",
  },
};

export function getEmailBrand(slug?: string | null): EmailBrand {
  if (!slug) return DEFAULT_BRAND;
  return BRANDS[slug] ?? { ...DEFAULT_BRAND, slug, productLabel: slug };
}

export function brandFromProduct(input: {
  slug?: string | null;
  name?: string | null;
}): EmailBrand {
  const brand = getEmailBrand(input.slug);
  if (!input.slug && input.name) {
    return { ...brand, productLabel: input.name };
  }
  if (input.name && brand.slug === "default") {
    return { ...brand, productLabel: input.name };
  }
  return brand;
}
