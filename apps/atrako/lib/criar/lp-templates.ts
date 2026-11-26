import {
  newSectionId,
  type LpGoal,
  type LpSalesPageV1,
  type LpSection,
} from "@/lib/criar/lp-schema";
import type { LpSalesPageV3 } from "@/lib/criar/lp-v3";
import { seedPagesFromBrief } from "@/lib/lp-pages/canonical";

export {
  buildPuckTemplate,
  seedPuckFromBrief,
} from "@/lib/criar/puck/templates";

export { seedPagesFromBrief } from "@/lib/lp-pages/canonical";

/**
 * Canônico: LP Pages (v3 HTML/CSS) para qualquer cliente.
 * Puck v2 permanece só via `seedPuckFromBrief` (editor legado).
 */
export function seedLpFromBrief(
  goal: LpGoal,
  brief: string,
): { name: string; priceCents: number; salesPage: LpSalesPageV3 } {
  return seedPagesFromBrief(goal, brief);
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
