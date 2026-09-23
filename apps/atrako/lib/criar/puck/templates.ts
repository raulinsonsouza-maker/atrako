import type { Data } from "@puckeditor/core";
import type { LpGoal } from "@/lib/criar/lp-schema";
import type { LpPuckComponents } from "@/lib/criar/puck/config";

export type LpPuckData = Data<LpPuckComponents>;

export type LpTemplateId =
  | "captura-saas"
  | "material-gratis"
  | "oferta-digital"
  | "venda-premium"
  | "hibrida"
  | "alameda-vera";

export type LpTemplateMeta = {
  id: LpTemplateId;
  goal: LpGoal;
  title: string;
  description: string;
  /** Tom visual curto para o card do picker */
  tone: "brand" | "light" | "ink";
  recommended?: boolean;
  sortOrder?: number;
};

export const LP_TEMPLATES: LpTemplateMeta[] = [
  {
    id: "captura-saas",
    goal: "leads",
    title: "Captura SaaS",
    description: "Hero azul + formulário ao lado — demo e waitlist.",
    tone: "brand",
    recommended: true,
    sortOrder: 10,
  },
  {
    id: "material-gratis",
    goal: "leads",
    title: "Material grátis",
    description: "Lead magnet claro: hero, benefícios, form e FAQ.",
    tone: "light",
    sortOrder: 20,
  },
  {
    id: "oferta-digital",
    goal: "sales",
    title: "Oferta digital",
    description: "Venda direta com checkout, prova social e garantia.",
    tone: "light",
    recommended: true,
    sortOrder: 30,
  },
  {
    id: "venda-premium",
    goal: "sales",
    title: "Venda premium",
    description: "Hero escuro, números, depoimento e checkout em destaque.",
    tone: "ink",
    sortOrder: 40,
  },
  {
    id: "hibrida",
    goal: "leads",
    title: "Captura + checkout",
    description: "Formulário e checkout na mesma página — funil completo.",
    tone: "light",
    recommended: true,
    sortOrder: 15,
  },
  {
    id: "alameda-vera",
    goal: "leads",
    title: "Alameda Vera",
    description:
      "LP imobiliária: hero, números, formulário, tipologias, galeria e FAQ.",
    tone: "light",
    recommended: true,
    sortOrder: 5,
  },
];

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function templatesForGoal(goal: LpGoal): LpTemplateMeta[] {
  return LP_TEMPLATES.filter((t) => t.goal === goal);
}

export function allTemplates(): LpTemplateMeta[] {
  return [...LP_TEMPLATES].sort(
    (a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99),
  );
}

export function buildEmptyPuck(): LpPuckData {
  return {
    root: { props: { primaryColor: "#0066cc" } },
    content: [],
  };
}

export function getTemplateMeta(id: LpTemplateId): LpTemplateMeta | undefined {
  return LP_TEMPLATES.find((t) => t.id === id);
}

/** Templates de alta conversão — layout no estilo GreatPages. */
export function buildTemplatePuck(templateId: LpTemplateId): LpPuckData {
  switch (templateId) {
    case "captura-saas":
      return {
        root: { props: { primaryColor: "#0066cc" } },
        content: [
          {
            type: "Hero",
            props: {
              id: id("Hero"),
              layout: "split-form",
              bgColor: "#0066cc",
              textColor: "#ffffff",
              ctaBg: "#ffffff",
              ctaText: "#0066cc",
              eyebrow: "Demonstração",
              title: "Vamos desenhar a sua operação comercial.",
              subtitle:
                "Mostre como a sua solução reduz atrito, acelera o fechamento e organiza o funil — em uma demonstração objetiva.",
              ctaLabel: "",
              ctaHref: "#form",
              formTitle: "Agendar demonstração",
              formId: "",
              mediaSrc: "",
            },
          },
          {
            type: "Stats",
            props: {
              id: id("Stats"),
              bgColor: "#ffffff",
              textColor: "#1d1d1f",
              items: [
                { value: "3×", label: "mais conversões" },
                { value: "48h", label: "para o primeiro resultado" },
                { value: "100%", label: "no seu CRM" },
              ],
            },
          },
          {
            type: "Benefits",
            props: {
              id: id("Benefits"),
              bgColor: "#f5f5f7",
              textColor: "#1d1d1f",
              title: "O que você resolve",
              items: [
                { text: "Captura de leads sem planilha" },
                { text: "Follow-up automático no funil" },
                { text: "Métricas claras de conversão" },
                { text: "Time alinhado no mesmo lugar" },
              ],
            },
          },
          {
            type: "Quote",
            props: {
              id: id("Quote"),
              bgColor: "#ffffff",
              textColor: "#1d1d1f",
              text: "Em duas semanas o time já operava com um funil limpo e previsível.",
              author: "Operações · cliente piloto",
            },
          },
          {
            type: "Faq",
            props: {
              id: id("Faq"),
              bgColor: "#f5f5f7",
              textColor: "#1d1d1f",
              accentColor: "#0066cc",
              title: "Perguntas frequentes",
              items: [
                {
                  q: "Quanto tempo dura a demonstração?",
                  a: "Cerca de 30 minutos, com foco no seu fluxo atual.",
                },
                {
                  q: "Preciso de cartão?",
                  a: "Não. Só e-mail e um contato para alinharmos o horário.",
                },
              ],
            },
          },
          {
            type: "CtaBand",
            props: {
              id: id("CtaBand"),
              bgColor: "#1d1d1f",
              textColor: "#ffffff",
              ctaBg: "#ffffff",
              ctaText: "#1d1d1f",
              title: "Pronto para ver na prática?",
              subtitle: "Escolha um horário — sem compromisso.",
              ctaLabel: "Agendar demonstração",
              ctaHref: "#form",
            },
          },
        ],
      };

    case "material-gratis":
      return {
        root: { props: { primaryColor: "#0066cc" } },
        content: [
          {
            type: "Hero",
            props: {
              id: id("Hero"),
              layout: "split-form",
              bgColor: "#f5f5f7",
              textColor: "#1d1d1f",
              ctaBg: "#0066cc",
              ctaText: "#ffffff",
              eyebrow: "Material gratuito",
              title: "O guia prático para acelerar seus resultados.",
              subtitle:
                "Baixe agora e aplique ainda hoje — sem cartão, sem spam.",
              ctaLabel: "",
              ctaHref: "#form",
              formTitle: "Quero receber o material",
              formId: "",
              mediaSrc: "",
            },
          },
          {
            type: "Stats",
            props: {
              id: id("Stats"),
              bgColor: "#ffffff",
              textColor: "#1d1d1f",
              items: [
                { value: "12k+", label: "downloads" },
                { value: "4.8", label: "avaliação" },
                { value: "0", label: "spam" },
              ],
            },
          },
          {
            type: "Benefits",
            props: {
              id: id("Benefits"),
              bgColor: "#ffffff",
              textColor: "#1d1d1f",
              title: "O que você encontra dentro",
              items: [
                { text: "Checklist pronto para usar" },
                { text: "Exemplos reais de oferta" },
                { text: "Roteiro de follow-up" },
                { text: "Acesso imediato no e-mail" },
              ],
            },
          },
          {
            type: "Quote",
            props: {
              id: id("Quote"),
              bgColor: "#f5f5f7",
              textColor: "#1d1d1f",
              text: "Em uma tarde já tinha o funil montado com o que estava no material.",
              author: "Leitor · lista gratuita",
            },
          },
          {
            type: "Faq",
            props: {
              id: id("Faq"),
              bgColor: "#ffffff",
              textColor: "#1d1d1f",
              accentColor: "#0066cc",
              title: "Perguntas frequentes",
              items: [
                {
                  q: "É grátis?",
                  a: "Sim. Preencha o formulário e enviaremos o material.",
                },
                {
                  q: "Precisa de cartão?",
                  a: "Não. Só nome e contato.",
                },
              ],
            },
          },
          {
            type: "CtaBand",
            props: {
              id: id("CtaBand"),
              bgColor: "#1d1d1f",
              textColor: "#ffffff",
              ctaBg: "#ffffff",
              ctaText: "#1d1d1f",
              title: "Receba o material agora",
              subtitle: "Leva menos de um minuto.",
              ctaLabel: "Quero baixar",
              ctaHref: "#form",
            },
          },
        ],
      };

    case "oferta-digital":
      return {
        root: { props: { primaryColor: "#0066cc" } },
        content: [
          {
            type: "Hero",
            props: {
              id: id("Hero"),
              layout: "centered",
              bgColor: "#f5f5f7",
              textColor: "#1d1d1f",
              ctaBg: "#0066cc",
              ctaText: "#ffffff",
              eyebrow: "Oferta especial",
              title: "Transforme seu resultado com um sistema pronto.",
              subtitle:
                "Pagamento seguro, entrega imediata e garantia de 7 dias.",
              ctaLabel: "Comprar agora",
              ctaHref: "#checkout",
              formTitle: "",
              formId: "",
              mediaSrc: "",
            },
          },
          {
            type: "Stats",
            props: {
              id: id("Stats"),
              bgColor: "#ffffff",
              textColor: "#1d1d1f",
              items: [
                { value: "R$ 97", label: "investimento único" },
                { value: "7 dias", label: "de garantia" },
                { value: "Pix", label: "ou cartão" },
              ],
            },
          },
          {
            type: "Benefits",
            props: {
              id: id("Benefits"),
              bgColor: "#ffffff",
              textColor: "#1d1d1f",
              title: "O que está incluso",
              items: [
                { text: "Acesso vitalício ao conteúdo" },
                { text: "Atualizações inclusas" },
                { text: "Garantia de 7 dias" },
                { text: "Suporte por e-mail" },
              ],
            },
          },
          {
            type: "Quote",
            props: {
              id: id("Quote"),
              bgColor: "#f5f5f7",
              textColor: "#1d1d1f",
              text: "Simples de aplicar e resultado rápido — exatamente o que eu precisava.",
              author: "Cliente recente",
            },
          },
          {
            type: "AtrakoCheckout",
            props: {
              id: id("AtrakoCheckout"),
              placeholder: "",
              bgColor: "#ffffff",
              productId: "",
            },
          },
          {
            type: "CtaBand",
            props: {
              id: id("CtaBand"),
              bgColor: "#0066cc",
              textColor: "#ffffff",
              ctaBg: "#ffffff",
              ctaText: "#0066cc",
              title: "Comece hoje com segurança",
              subtitle: "Pix ou cartão · garantia de 7 dias.",
              ctaLabel: "Garantir acesso",
              ctaHref: "#checkout",
            },
          },
          {
            type: "Faq",
            props: {
              id: id("Faq"),
              bgColor: "#f5f5f7",
              textColor: "#1d1d1f",
              accentColor: "#0066cc",
              title: "Perguntas frequentes",
              items: [
                {
                  q: "Como recebo o acesso?",
                  a: "Após o pagamento você recebe o link de acesso por e-mail.",
                },
                {
                  q: "Precisa de cartão?",
                  a: "Aceitamos Pix e cartão via Mercado Pago.",
                },
              ],
            },
          },
        ],
      };

    case "venda-premium":
      return {
        root: { props: { primaryColor: "#0066cc" } },
        content: [
          {
            type: "Hero",
            props: {
              id: id("Hero"),
              layout: "split",
              bgColor: "#1d1d1f",
              textColor: "#ffffff",
              ctaBg: "#ffffff",
              ctaText: "#1d1d1f",
              eyebrow: "Edição limitada",
              title: "O método completo para vender com previsibilidade.",
              subtitle:
                "Do primeiro lead ao pagamento — um sistema pronto para o seu time aplicar esta semana.",
              ctaLabel: "Garantir acesso",
              ctaHref: "#checkout",
              formTitle: "",
              formId: "",
              mediaSrc: "",
            },
          },
          {
            type: "Stats",
            props: {
              id: id("Stats"),
              bgColor: "#ffffff",
              textColor: "#1d1d1f",
              items: [
                { value: "+120", label: "alunos ativos" },
                { value: "4.9", label: "avaliação média" },
                { value: "7 dias", label: "de garantia" },
              ],
            },
          },
          {
            type: "Benefits",
            props: {
              id: id("Benefits"),
              bgColor: "#f5f5f7",
              textColor: "#1d1d1f",
              title: "Tudo que você recebe",
              items: [
                { text: "Playbooks de fechamento" },
                { text: "Scripts de follow-up" },
                { text: "Templates de página e oferta" },
                { text: "Comunidade e atualizações" },
              ],
            },
          },
          {
            type: "Quote",
            props: {
              id: id("Quote"),
              bgColor: "#ffffff",
              textColor: "#1d1d1f",
              text: "Em 30 dias dobramos a taxa de conversão do funil principal.",
              author: "Head de Growth",
            },
          },
          {
            type: "AtrakoCheckout",
            props: {
              id: id("AtrakoCheckout"),
              placeholder: "",
              bgColor: "#f5f5f7",
              productId: "",
            },
          },
          {
            type: "CtaBand",
            props: {
              id: id("CtaBand"),
              bgColor: "#0066cc",
              textColor: "#ffffff",
              ctaBg: "#ffffff",
              ctaText: "#0066cc",
              title: "Vagas desta turma se esgotam",
              subtitle: "Garantia de 7 dias. Pix ou cartão.",
              ctaLabel: "Comprar agora",
              ctaHref: "#checkout",
            },
          },
          {
            type: "Faq",
            props: {
              id: id("Faq"),
              bgColor: "#ffffff",
              textColor: "#1d1d1f",
              accentColor: "#0066cc",
              title: "Perguntas frequentes",
              items: [
                {
                  q: "Como recebo o acesso?",
                  a: "Imediatamente após a confirmação do pagamento, por e-mail.",
                },
                {
                  q: "E se eu não gostar?",
                  a: "Você tem 7 dias para pedir reembolso integral.",
                },
              ],
            },
          },
        ],
      };

    case "hibrida": {
      const base = buildTemplatePuck("material-gratis");
      return {
        ...base,
        content: [
          ...base.content,
          {
            type: "AtrakoCheckout",
            props: {
              id: id("AtrakoCheckout"),
              placeholder: "",
              bgColor: "#f5f5f7",
              productId: "",
            },
          },
        ],
      };
    }

    case "alameda-vera":
      return buildAlamedaVeraTemplate();

    default:
      return buildTemplatePuck("material-gratis");
  }
}

const ALAMEDA_IMGS = {
  hero: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=80",
  about:
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80",
  tipo1:
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80",
  tipo2:
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80",
  tipo3:
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80",
  slide1:
    "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80",
  slide2:
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80",
  slide3:
    "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=900&q=80",
  slide4:
    "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=900&q=80",
  slide5:
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80",
  loc: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80",
  cta: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=2000&q=80",
} as const;

function buildAlamedaVeraTemplate(): LpPuckData {
  const copper = "#9a6b45";
  const ink = "#14181c";
  const stone = "#f2eee6";
  const stoneDeep = "#e4ddd2";
  const white = "#ffffff";

  return {
    root: { props: { primaryColor: copper } },
    content: [
      {
        type: "Menu",
        props: {
          id: id("Menu"),
          items: [
            { label: "O projeto", href: "#sobre" },
            { label: "Tipologias", href: "#tipologias" },
            { label: "Localização", href: "#localizacao" },
            { label: "FAQ", href: "#faq" },
          ],
          ctaLabel: "Quero ser contactado",
          ctaHref: "#form",
          ctaBg: white,
          ctaText: ink,
        },
      },
      {
        type: "Hero",
        props: {
          id: id("Hero"),
          layout: "split",
          bgColor: ink,
          textColor: white,
          ctaBg: copper,
          ctaText: white,
          eyebrow: "Residencial · Jardim das Acácias",
          title: "Viva com amplitude onde a cidade respira",
          subtitle:
            "Apartamentos de 2 e 3 dormitórios com varanda generosa, a poucos minutos do Parque das Figueiras.",
          ctaLabel: "Receber plantas e preços",
          ctaHref: "#form",
          formTitle: "",
          formId: "",
          mediaSrc: ALAMEDA_IMGS.hero,
        },
      },
      {
        type: "Stats",
        props: {
          id: id("Stats"),
          bgColor: ink,
          textColor: white,
          items: [
            { value: "2 e 3 dorms", label: "68 a 142 m²" },
            { value: "Entrega 2028", label: "2º semestre" },
            { value: "Fase Reserva", label: "Condições especiais" },
            { value: "Riviera & Campos", label: "Construtora" },
          ],
        },
      },
      {
        type: "Heading",
        props: {
          id: id("Heading"),
          level: "h2",
          text: "Receba o memorial e agende sua visita",
          textColor: ink,
        },
      },
      {
        type: "Paragraph",
        props: {
          id: id("Paragraph"),
          text: "Preencha seus dados e a equipe da Nova Horizonte Imóveis entra em contato em até um dia útil. Memorial em PDF, simulação e tour presencial ou por videochamada.",
          textColor: "#6b757e",
        },
      },
      {
        type: "AtrakoForm",
        props: {
          id: id("AtrakoForm"),
          title: "Quero receber o material",
          formId: "",
          bgColor: stoneDeep,
          textColor: ink,
        },
      },
      {
        type: "Image",
        props: {
          id: id("Image"),
          src: ALAMEDA_IMGS.about,
          alt: "Área externa do residencial Alameda Vera",
        },
      },
      {
        type: "Box",
        props: {
          id: id("Box"),
          title: "Um endereço pensado para rotina leve e vista permanente",
          text: "O Alameda Vera reúne 86 unidades em torre única, com lazer completo no térreo e rooftop. Incorporação fictícia — substitua pelos dados reais do empreendimento.",
          bgColor: stone,
          textColor: ink,
          accentColor: copper,
        },
      },
      {
        type: "Stats",
        props: {
          id: id("Stats"),
          bgColor: stone,
          textColor: ink,
          items: [
            { value: "86", label: "unidades" },
            { value: "12", label: "andares" },
            { value: "1.200", label: "m² de lazer" },
          ],
        },
      },
      {
        type: "Benefits",
        props: {
          id: id("Benefits"),
          bgColor: ink,
          textColor: white,
          title: "Projetado para quem troca pressa por presença",
          items: [
            {
              text: "Pé-direito generoso — salas com 2,80 m e iluminação cruzada nas tipologias de canto.",
            },
            {
              text: "Lazer sem fila — piscina aquecida, coworking e salão gourmet para 24 convidados.",
            },
            {
              text: "Garagem inteligente — preparo para carregador elétrico em 40% das unidades.",
            },
            {
              text: "Entrega prevista — obra em ritmo de estrutura, chaves no 2º semestre de 2028.",
            },
          ],
        },
      },
      {
        type: "Heading",
        props: {
          id: id("Heading"),
          level: "h2",
          text: "Três formas de morar no mesmo endereço",
          textColor: ink,
        },
      },
      {
        type: "Paragraph",
        props: {
          id: id("Paragraph"),
          text: "Todas as unidades incluem ar-condicionado nas suítes e persiana blackout.",
          textColor: "#6b757e",
        },
      },
      {
        type: "Image",
        props: {
          id: id("Image"),
          src: ALAMEDA_IMGS.tipo1,
          alt: "Vera Compacta — 68 m²",
        },
      },
      {
        type: "Box",
        props: {
          id: id("Box"),
          title: "Vera Compacta · 68 m² · 2 dorms",
          text: "Cozinha americana, varanda de 7 m² e suíte com closet linear.",
          bgColor: stone,
          textColor: ink,
          accentColor: copper,
        },
      },
      {
        type: "Image",
        props: {
          id: id("Image"),
          src: ALAMEDA_IMGS.tipo2,
          alt: "Vera Família — 96 m²",
        },
      },
      {
        type: "Box",
        props: {
          id: id("Box"),
          title: "Vera Família · 96 m² · 3 dorms",
          text: "Dois banheiros, lavabo e espaço gourmet na varanda.",
          bgColor: stone,
          textColor: ink,
          accentColor: copper,
        },
      },
      {
        type: "Image",
        props: {
          id: id("Image"),
          src: ALAMEDA_IMGS.tipo3,
          alt: "Vera Horizonte — 142 m² Garden",
        },
      },
      {
        type: "Box",
        props: {
          id: id("Box"),
          title: "Vera Horizonte · 142 m² · Garden",
          text: "Terraço privativo, jacuzzi e vista para o Parque das Figueiras.",
          bgColor: stone,
          textColor: ink,
          accentColor: copper,
        },
      },
      {
        type: "Heading",
        props: {
          id: id("Heading"),
          level: "h2",
          text: "Ambientes e acabamentos",
          textColor: ink,
        },
      },
      {
        type: "Slider",
        props: {
          id: id("Slider"),
          bgColor: stoneDeep,
          items: [
            { src: ALAMEDA_IMGS.slide1, alt: "Living" },
            { src: ALAMEDA_IMGS.slide2, alt: "Cozinha" },
            { src: ALAMEDA_IMGS.slide3, alt: "Suíte" },
            { src: ALAMEDA_IMGS.slide4, alt: "Piscina" },
            { src: ALAMEDA_IMGS.slide5, alt: "Fachada" },
          ],
        },
      },
      {
        type: "CtaButton",
        props: {
          id: id("CtaButton"),
          label: "Pedir tour virtual",
          href: "#form",
          bgColor: ink,
          textColor: white,
        },
      },
      {
        type: "Image",
        props: {
          id: id("Image"),
          src: ALAMEDA_IMGS.loc,
          alt: "Região do Jardim das Acácias",
        },
      },
      {
        type: "Box",
        props: {
          id: id("Box"),
          title: "Entre o parque e o eixo da Avenida das Palmeiras",
          text: "Rua das Camélias, 480 — Jardim das Acácias, Vila Serena. Parque das Figueiras (6 min a pé) · Estação Vila Serena (9 min) · Colégio Horizonte Norte (4 min) · Shopping Acácias (12 min).",
          bgColor: stone,
          textColor: ink,
          accentColor: copper,
        },
      },
      {
        type: "Quote",
        props: {
          id: id("Quote"),
          bgColor: ink,
          textColor: white,
          text: "A planta da Vera Família cabe na nossa rotina. A varanda gourmet foi o detalhe que fechou a visita.",
          author: "Helena e Ricardo Prado · Interessados · 3 dormitórios",
        },
      },
      {
        type: "Quote",
        props: {
          id: id("Quote"),
          bgColor: ink,
          textColor: white,
          text: "Comparei três lançamentos na região. Aqui o lazer e a distância do parque pesaram mais.",
          author: "Bruno Nogueira · Investidor · 2 unidades",
        },
      },
      {
        type: "Faq",
        props: {
          id: id("Faq"),
          bgColor: stone,
          textColor: ink,
          accentColor: copper,
          title: "Tudo o que costumam perguntar antes da visita",
          items: [
            {
              q: "Qual o valor de entrada e as condições de pagamento?",
              a: "Na fase Reserva Verde, entrada facilitada em até 6 parcelas e saldo com a construtora. Tabela enviada após o formulário.",
            },
            {
              q: "Posso visitar o stand sem compromisso?",
              a: "Sim. Stand na Rua das Camélias, 480, de terça a domingo. Agende pelo formulário ou WhatsApp.",
            },
            {
              q: "As plantas já estão aprovadas?",
              a: "Sim. Incorporação fictícia nº 12.345 e memorial descritivo em PDF para leads qualificados.",
            },
            {
              q: "Tem vaga de garagem e depósito?",
              a: "Todas as unidades incluem 1 vaga. Tipologias de 3 dorms e garden podem ter 2ª vaga e box.",
            },
            {
              q: "Aceita financiamento e FGTS?",
              a: "Sim, mediante análise de crédito. Orientação sobre bancos parceiros após a reserva.",
            },
            {
              q: "Como funciona o tour por videochamada?",
              a: "Em até 24h úteis enviamos link com plantas, tour 360° e dúvidas ao vivo.",
            },
          ],
        },
      },
      {
        type: "CtaBand",
        props: {
          id: id("CtaBand"),
          bgColor: ink,
          textColor: white,
          ctaBg: copper,
          ctaText: white,
          title: "Garanta prioridade na escolha da planta",
          subtitle:
            "Unidades limitadas nesta fase. Deixe seus dados e receba a tabela atualizada da Reserva Verde.",
          ctaLabel: "Quero receber a tabela",
          ctaHref: "#form",
        },
      },
      {
        type: "Html",
        props: {
          id: id("Html"),
          code: `<footer style="background:#0d1013;color:rgba(255,255,255,.65);padding:2.5rem 1.25rem 1.25rem;font-family:system-ui,sans-serif;font-size:.88rem">
  <div style="max-width:1120px;margin:0 auto;display:grid;gap:1.5rem">
    <div>
      <p style="font-size:1.35rem;font-weight:700;color:#fff;letter-spacing:-.03em;margin:0 0 .5rem">Alameda Vera</p>
      <p style="max-width:36ch;line-height:1.55;margin:0 0 1rem">Residencial fictício para template de captura. Substitua textos e contatos pelos dados reais.</p>
      <p style="margin:0;font-size:.8rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#c9b8a0">Instagram · YouTube · WhatsApp</p>
    </div>
    <div style="display:grid;gap:.75rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,.1)">
      <p style="margin:0"><span style="font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.4)">Imobiliária</span><br/><strong style="font-weight:500;color:rgba(255,255,255,.88)">Nova Horizonte Imóveis</strong></p>
      <p style="margin:0"><span style="font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.4)">Corretora</span><br/><strong style="font-weight:500;color:rgba(255,255,255,.88)">Clara Mendes · CRECI 00000-J</strong></p>
      <p style="margin:0"><span style="font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.4)">Contato</span><br/><strong style="font-weight:500;color:rgba(255,255,255,.88)">(11) 4000-0000 · vendas@novahorizonte.exemplo</strong></p>
      <p style="margin:0"><span style="font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.4)">Stand</span><br/><strong style="font-weight:500;color:rgba(255,255,255,.88)">Rua das Camélias, 480 — Jardim das Acácias</strong></p>
    </div>
    <p style="margin:0;padding-top:1rem;border-top:1px solid rgba(255,255,255,.1);font-size:.78rem;color:rgba(255,255,255,.45)">© 2026 Alameda Vera · Template fictício · Construtora Riviera &amp; Campos · Entrega 2º sem. 2028</p>
  </div>
</footer>`,
        },
      },
    ],
  };
}

/** @deprecated use buildTemplatePuck — mantido para seeds antigos */
export function buildPuckTemplate(
  goal: LpGoal,
  opts?: {
    headline?: string;
    subheadline?: string;
    bullets?: string[];
  },
): LpPuckData {
  const base =
    goal === "leads"
      ? buildTemplatePuck("material-gratis")
      : buildTemplatePuck("oferta-digital");

  if (!opts) return base;

  return {
    ...base,
    content: base.content.map((block) => {
      if (block.type === "Hero") {
        return {
          ...block,
          props: {
            ...block.props,
            title: opts.headline || block.props.title,
            subtitle: opts.subheadline || block.props.subtitle,
          },
        };
      }
      if (block.type === "Benefits" && opts.bullets?.length) {
        return {
          ...block,
          props: {
            ...block.props,
            items: opts.bullets.map((text) => ({ text })),
          },
        };
      }
      return block;
    }),
  };
}

export function seedPuckFromBrief(
  goal: LpGoal,
  brief: string,
): { name: string; priceCents: number; puck: LpPuckData } {
  const text = brief.trim();
  const firstLine = (text.split(/\n/)[0] || "Nova oferta").slice(0, 80);
  const bullets = text
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
    .slice(0, 4);

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
    puck: buildPuckTemplate(goal, {
      headline: firstLine,
      subheadline: text.slice(0, 180) || undefined,
      bullets:
        bullets.length > 0
          ? bullets
          : ["Resultado claro", "Passo a passo", "Suporte incluso"],
    }),
  };
}
