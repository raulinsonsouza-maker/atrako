export type TemplateKind = "quick" | "builder" | "soon";

export type FlowTemplate = {
  id: string;
  title: string;
  description: string;
  /** API template or wizard id */
  action: "comment_dm" | "story_dm" | "keyword" | "welcome" | "blank" | "soon";
  kind: TemplateKind;
  /** filters */
  objectives: Array<"followers" | "engage" | "traffic">;
  triggers: Array<"comment" | "dm" | "story" | "live">;
  popular?: boolean;
  pro?: boolean;
  ai?: boolean;
  recommended?: boolean;
  /** Valores iniciais do wizard de comentário → DM */
  preset?: Record<string, unknown>;
};

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "comment-links",
    title: "Enviar links automaticamente por DM a partir dos comentários",
    description:
      "Envie um link sempre que alguém comentar em uma publicação ou reel",
    action: "comment_dm",
    kind: "quick",
    objectives: ["traffic", "engage"],
    triggers: ["comment"],
    popular: true,
    recommended: true,
  },
  {
    id: "story-leads",
    title: "Gere leads com stories",
    description:
      "Aproveite ofertas exclusivas nos Stories para transformar leads em clientes",
    action: "story_dm",
    kind: "quick",
    objectives: ["traffic", "engage"],
    triggers: ["story"],
    recommended: true,
  },
  {
    id: "reply-all-dms",
    title: "Responda todas as suas DMs",
    description:
      "Envie respostas automaticamente quando alguém te enviar uma DM",
    action: "welcome",
    kind: "quick",
    objectives: ["engage"],
    triggers: ["dm"],
    recommended: true,
  },
  {
    id: "keyword-dm",
    title: "Responda DMs com palavra-chave",
    description:
      "Quando alguém mandar uma keyword na Direct, envie o link ou a oferta",
    action: "keyword",
    kind: "quick",
    objectives: ["traffic", "engage"],
    triggers: ["dm"],
  },
  {
    id: "comment-followers-pro",
    title: "Aumente seus seguidores com comentários",
    description: "Use comentários do Instagram para fazer sua conta crescer",
    action: "comment_dm",
    kind: "quick",
    objectives: ["followers"],
    triggers: ["comment"],
    preset: {
      followEnabled: true,
      welcomeText:
        "Oi! Quero te mandar o conteúdo exclusivo 😊\n\nToque no botão abaixo para continuar ✨",
      welcomeButton: "Quero o guia grátis!",
      followText:
        "Obrigado pelo interesse! 💞 Este conteúdo exclusivo é apenas para seguidores. Siga a página que enviarei o link imediatamente!",
      followButton: "Já sigo",
      rewardText: "Perfeito! Aqui está seu acesso 👇",
    },
  },
  {
    id: "comment-links-reminder",
    title: "Lembrete se o link não for aberto",
    description:
      "Envie um follow-up automático quando alguém não clicar no link da DM",
    action: "comment_dm",
    kind: "quick",
    objectives: ["traffic", "engage"],
    triggers: ["comment"],
    preset: {
      reminderEnabled: true,
      reminderMinutes: 30,
      reminderText:
        "Se ainda estiver curiosa, não esqueça de tocar no link ⬇️ Acho que você irá adorar ❤️",
      rewardText: "Aqui está o link que você pediu. Aproveite!",
      rewardButton: "Abrir",
    },
  },
  {
    id: "affiliate-cards",
    title: "Enviar links de produtos afiliados",
    description:
      "Inclua um cartão do produto com fotos e links das suas colaborações de afiliado",
    action: "comment_dm",
    kind: "builder",
    objectives: ["traffic"],
    triggers: ["comment", "dm"],
    preset: {
      rewardText: "Confira este produto 👇",
      rewardButton: "Ver produto",
    },
  },
  {
    id: "ai-conversations",
    title: "Automatize conversas com IA",
    description:
      "Deixe a IA te ajudar a mostrar suas ofertas e recomendar produtos",
    action: "soon",
    kind: "soon",
    objectives: ["engage", "traffic"],
    triggers: ["dm"],
    ai: true,
    pro: true,
  },
  {
    id: "story-leads-builder",
    title: "Gere leads dos stories",
    description:
      "Use ofertas por tempo limitado nos Stories para converter leads",
    action: "story_dm",
    kind: "builder",
    objectives: ["traffic"],
    triggers: ["story"],
  },
  {
    id: "comment-products",
    title: "Responda comentários via DM",
    description: "Envie uma linha de produtos usando DMs do Instagram",
    action: "comment_dm",
    kind: "builder",
    objectives: ["traffic"],
    triggers: ["comment"],
  },
  {
    id: "auto-links-dm",
    title: "Envio automático de links por DM",
    description:
      "Automatize suas DMs para direcionar seguidores à sua página — sem “link na bio”",
    action: "keyword",
    kind: "builder",
    objectives: ["traffic"],
    triggers: ["dm"],
  },
  {
    id: "email-magnet",
    title: "Cresça sua lista de e-mails",
    description: "Capture dados de clientes com o Ímã de Leads",
    action: "comment_dm",
    kind: "quick",
    objectives: ["traffic"],
    triggers: ["dm", "story", "comment"],
    preset: {
      emailEnabled: true,
      emailText: "Diga-me qual é seu e-mail para receber o link!",
      rewardText: "Obrigado! 💞 Aqui está o link que você pediu. Aproveite!",
      rewardButton: "Abrir",
    },
  },
  {
    id: "contest",
    title: "Faça um concurso",
    description:
      "Concurso para aumentar seguidores — as pessoas interagem para ganhar",
    action: "comment_dm",
    kind: "quick",
    objectives: ["followers", "engage"],
    triggers: ["comment"],
    preset: {
      anyKeyword: false,
      keywords: ["quero", "participar"],
      welcomeText:
        "🎉 Obrigado por participar! Toque no botão abaixo para confirmar sua inscrição.",
      rewardText: "Inscrição confirmada! Fique de olho — avisaremos os ganhadores por aqui.",
    },
  },
  {
    id: "ai-faq-dm",
    title: "Reconheça perguntas em DMs com IA",
    description: "Identifique e responda às perguntas comuns dos usuários",
    action: "soon",
    kind: "soon",
    objectives: ["engage"],
    triggers: ["dm"],
    ai: true,
    pro: true,
  },
  {
    id: "ig-to-wa",
    title: "Encaminhe Leads do Instagram para o WhatsApp",
    description: "Leve os seguidores do Instagram para o WhatsApp",
    action: "soon",
    kind: "soon",
    objectives: ["traffic"],
    triggers: ["dm", "comment"],
  },
  {
    id: "story-coupon",
    title: "Envie cupons nos stories",
    description: "Alguém viu seu story? Dê um cupom secreto via DM",
    action: "story_dm",
    kind: "builder",
    objectives: ["engage", "traffic"],
    triggers: ["story"],
  },
  {
    id: "story-faq",
    title: "Responda a Perguntas frequentes de Stories",
    description: "Responda o mais rápido possível às perguntas dos seguidores",
    action: "story_dm",
    kind: "builder",
    objectives: ["engage"],
    triggers: ["story"],
  },
  {
    id: "phone-list",
    title: "Aumente sua lista de números de telefone",
    description: "Pegue o número de telefone dos seus seguidores do Instagram",
    action: "keyword",
    kind: "builder",
    objectives: ["traffic"],
    triggers: ["dm"],
    preset: {
      keywords: ["whatsapp", "telefone"],
      welcomeText: "Qual seu WhatsApp? 📱",
    },
  },
  {
    id: "reels-sales",
    title: "Venda pelos comentários de Reels",
    description: "Um reel tá gerando conversas? Entre nas DMs com uma boa oferta",
    action: "comment_dm",
    kind: "builder",
    objectives: ["traffic"],
    triggers: ["comment"],
  },
  {
    id: "live-offers",
    title: "Envie ofertas nas DMs durante Lives",
    description:
      "Cada “DE ONDE É ISSO?” vira venda — a automação cuida enquanto a vibe está no ar",
    action: "soon",
    kind: "soon",
    objectives: ["traffic", "engage"],
    triggers: ["live", "comment"],
  },
  {
    id: "live-convert",
    title: "Converta na Live",
    description: "Dispare DMs durante Lives do IG",
    action: "soon",
    kind: "soon",
    objectives: ["traffic"],
    triggers: ["live"],
  },
  {
    id: "poll-qualify",
    title: "Qualifique leads com uma enquete",
    description: "Envie uma enquete com a oferta certa, na hora certa",
    action: "keyword",
    kind: "builder",
    objectives: ["engage", "traffic"],
    triggers: ["dm"],
    preset: {
      keywords: ["quero", "info"],
      welcomeText: "Qual opção te interessa mais?",
    },
  },
  {
    id: "live-game",
    title: "Gamifique Lives do Instagram",
    description:
      "Transforme a audiência em participantes com desafios disparados por DM",
    action: "soon",
    kind: "soon",
    objectives: ["engage"],
    triggers: ["live"],
  },
  {
    id: "rsvp-comments",
    title: "Converta comentários em confirmações de presença",
    description:
      "“Comente para participar” vira confirmação — sem formulário",
    action: "comment_dm",
    kind: "builder",
    objectives: ["engage"],
    triggers: ["comment"],
    preset: {
      keywords: ["confirmo", "vou", "participar"],
      welcomeButton: "Confirmar presença",
      rewardText: "Presença confirmada! Te vemos lá 🎉",
    },
  },
];

export const OBJECTIVE_FILTERS = [
  { id: "all", label: "Todos os modelos" },
  { id: "followers", label: "Aumente seus seguidores" },
  { id: "engage", label: "Engaje seu público" },
  { id: "traffic", label: "Direcionar tráfego" },
] as const;

export const TRIGGER_FILTERS = [
  { id: "comment", label: "Comentário na publicação ou reel" },
  { id: "dm", label: "DM" },
  { id: "story", label: "Resposta ao story" },
  { id: "live", label: "Comentário em tempo real" },
] as const;
