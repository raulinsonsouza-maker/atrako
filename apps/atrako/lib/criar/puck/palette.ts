/** Lista canônica de blocos LP — sidebar Puck, insert (+) e categorias. */
export const LP_ELEMENT_COMPONENTS = [
  "Heading",
  "Paragraph",
  "Image",
  "Logo",
  "Video",
  "Slider",
  "Icon",
  "AtrakoForm",
  "AtrakoCheckout",
  "CtaButton",
  "CtaBand",
  "Timer",
  "Hero",
  "Benefits",
  "Stats",
  "Quote",
  "Faq",
  "Box",
  "Circle",
  "Line",
  "Menu",
  "Html",
] as const;

export type LpElementComponent = (typeof LP_ELEMENT_COMPONENTS)[number];

export const LP_ELEMENT_LABELS: Record<LpElementComponent, string> = {
  Heading: "Título",
  Paragraph: "Parágrafo",
  Image: "Imagem",
  Logo: "Logo",
  Video: "Vídeo",
  Slider: "Slider",
  Icon: "Ícone",
  AtrakoForm: "Formulário",
  AtrakoCheckout: "Checkout",
  CtaButton: "Botão",
  CtaBand: "Faixa CTA",
  Timer: "Timer",
  Hero: "Hero",
  Benefits: "Benefícios",
  Stats: "Números",
  Quote: "Depoimento",
  Faq: "FAQ",
  Box: "Box",
  Circle: "Círculo",
  Line: "Linha",
  Menu: "Menu",
  Html: "HTML/CSS",
};

export function lpInsertableBlocks(): Array<{ type: string; label: string }> {
  return LP_ELEMENT_COMPONENTS.map((type) => ({
    type,
    label: LP_ELEMENT_LABELS[type],
  }));
}
