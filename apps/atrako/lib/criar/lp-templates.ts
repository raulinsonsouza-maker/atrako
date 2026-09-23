import {
  newSectionId,
  type LpGoal,
  type LpSalesPageV1,
  type LpSection,
} from "@/lib/criar/lp-schema";

export {
  buildPuckTemplate,
  seedPuckFromBrief,
} from "@/lib/criar/puck/templates";

/** @deprecated Prefer seedPuckFromBrief — mantido para v1 legado. */
export function seedLpFromBrief(
  goal: LpGoal,
  brief: string,
): { name: string; priceCents: number; salesPage: LpSalesPageV1 } {
  const text = brief.trim();
  const firstLine = (text.split(/\n/)[0] || "Nova oferta").slice(0, 80);
  const bullets =
    text
      .split(/[.\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 12)
      .slice(0, 4) || [];
  const priceMatch =
    text.match(/R\$\s*([\d.]+,\d{2})/i) || text.match(/R\$\s*([\d.,]+)/i);
  let priceCents = goal === "sales" ? 9700 : 0;
  if (priceMatch) {
    const raw = priceMatch[1];
    const n = raw.includes(",")
      ? Number(raw.replace(/\./g, "").replace(",", "."))
      : Number(raw.replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) {
      priceCents =
        n >= 1000 && !raw.includes(",") ? Math.round(n) : Math.round(n * 100);
    }
  }

  return {
    name: firstLine,
    priceCents,
    salesPage: buildTemplate(goal, {
      headline: firstLine,
      subheadline: text.slice(0, 180) || undefined,
      bullets:
        bullets.length > 0
          ? bullets
          : ["Resultado claro", "Passo a passo", "Suporte incluso"],
    }),
  };
}

/** Template seções v1 (legado / SalesPageView). */
export function buildTemplate(
  goal: LpGoal,
  opts?: {
    headline?: string;
    subheadline?: string;
    bullets?: string[];
  },
): LpSalesPageV1 {
  const headline =
    opts?.headline ||
    (goal === "leads" ? "Receba o material grátis" : "Transforme seu resultado");
  const sub =
    opts?.subheadline ||
    (goal === "leads"
      ? "Preencha o formulário e receba o acesso no e-mail."
      : "Oferta completa com pagamento seguro e entrega imediata.");
  const items =
    opts?.bullets ||
    (goal === "leads"
      ? ["Sem spam", "Acesso imediato", "Conteúdo prático"]
      : ["Acesso vitalício", "Atualizações inclusas", "Garantia de 7 dias"]);

  const sections: LpSection[] = [
    {
      id: newSectionId(),
      type: "hero",
      headline,
      subheadline: sub,
    },
    {
      id: newSectionId(),
      type: "benefits",
      items,
    },
    {
      id: newSectionId(),
      type: "social_proof",
      quotes: [
        {
          text: "Foi exatamente o que eu precisava — simples e direto.",
          author: "Cliente",
        },
      ],
    },
  ];

  if (goal === "leads") {
    sections.push({
      id: newSectionId(),
      type: "form",
      title: "Quero receber",
    });
  } else {
    sections.push({ id: newSectionId(), type: "checkout" });
  }

  sections.push({
    id: newSectionId(),
    type: "faq",
    items: [
      {
        q: goal === "leads" ? "É grátis?" : "Como recebo o acesso?",
        a:
          goal === "leads"
            ? "Sim. Preencha o formulário e enviaremos o material."
            : "Após o pagamento você recebe o link de acesso por e-mail.",
      },
      {
        q: "Precisa de cartão?",
        a:
          goal === "leads"
            ? "Não. Só nome e contato."
            : "Aceitamos Pix e cartão via Mercado Pago.",
      },
    ],
  });

  return { goal, version: 1, sections };
}
