/**
 * Nutrição da franquia Regicenter: 15 e-mails em 30 dias (D0–D6 diário, depois a cada 3 dias).
 * Botão sem URL leva ao `destination` da matrícula (formulário de qualificação);
 * reunião/handoff e ganho/perda encerram a cadência.
 */

import type { EmailBlock, EmailContent } from "@/lib/flows/types";
import type { PlaybookDef } from "@/lib/flows/playbooks";

const D = 24 * 60;
const LP_URL = "https://lp.regicenter.com";
const VIDEO_URL = "https://www.youtube.com/watch?v=mMRtrGFhIWg";
const SITE_URL = "https://regicenter.com/";

type Mail = {
  day: number;
  subject: string;
  preheader: string;
  heading: string;
  text: string;
  button: string;
  url?: string;
};

function mail(m: Mail): EmailContent {
  const blocks: EmailBlock[] = [
    { type: "heading", text: m.heading },
    { type: "text", text: m.text },
    { type: "button", label: m.button, ...(m.url ? { url: m.url } : {}) },
    { type: "signature" },
  ];
  return { subject: m.subject, preheader: m.preheader, blocks };
}

const NURTURE: Mail[] = [
  {
    day: 0,
    subject: "Recebemos seu interesse na franquia Regicenter",
    preheader: "A equipe de expansão vai falar com você pelo WhatsApp",
    heading: "Que bom ter você por aqui, {{primeiro_nome}}",
    text:
      "Recebemos seu cadastro para conhecer a franquia Regicenter. A equipe de expansão vai chamar você no WhatsApp informado para apresentar o modelo, o investimento e a disponibilidade para a sua cidade.\n\nNos próximos dias, você recebe por aqui o essencial para avaliar a oportunidade com calma: como funciona, quem está por trás da marca e o que esperar do dia a dia.\n\nSe quiser adiantar a conversa, responda algumas perguntas rápidas sobre o seu perfil.",
    button: "Adiantar minha apresentação",
  },
  {
    day: 1,
    subject: "Como funciona a franquia Regicenter",
    preheader: "Você desenvolve clientes. A Regicenter cuida dos processos.",
    heading: "Um modelo fácil de entender",
    text:
      "{{primeiro_nome}}, a franquia Regicenter foi desenhada para você focar no que gera resultado: o relacionamento com os clientes.\n\n**Conecte-se com empresas.** Identifique negócios que precisam proteger suas marcas e apresente as soluções.\n\n**Conte com a operação.** A Regicenter conduz os processos e a gestão dos contratos, com suporte jurídico no segmento.\n\n**Desenvolva sua unidade.** Concentre-se no relacionamento comercial, com treinamento e apoio de marketing.",
    button: "Ver o modelo completo",
    url: LP_URL,
  },
  {
    day: 2,
    subject: "Só o CNPJ não protege uma marca",
    preheader: "Por que proteção de marca é uma necessidade de todo negócio",
    heading: "Um mercado que nasce com cada nova empresa",
    text:
      "Muitos empreendedores acreditam que abrir o CNPJ garante a marca. Não garante: o CNPJ registra a empresa na junta comercial, e a marca só é protegida com o registro no INPI.\n\nToda empresa que cria um nome, um logotipo ou um produto precisa dessa proteção. E perder uma marca custa caro: além do desgaste com clientes, o negócio pode ter de refazer identidade visual, site, placas e materiais.\n\nÉ essa necessidade que o franqueado Regicenter ajuda a resolver na sua região.",
    button: "Quero conversar com a equipe",
  },
  {
    day: 3,
    subject: "Quem estará ao seu lado na Regicenter",
    preheader: "Desde 2012 protegendo marcas no Brasil e no exterior",
    heading: "Especialistas em proteger marcas",
    text:
      "A Regicenter Marcas & Patentes atua desde 2012 com foco exclusivo em proteção de marcas e patentes, no Brasil e no exterior.\n\nSão mais de 5.000 marcas registradas, com assessoria jurídica, técnica e administrativa em cada etapa do processo, e atendimento a registros internacionais em tratados como MERCOSUL, PCT, BENELUX, União Europeia e Tratado de Madri.\n\nAssista ao vídeo e conheça a marca por trás da franquia.",
    button: "Assistir ao vídeo",
    url: VIDEO_URL,
  },
  {
    day: 4,
    subject: "Preciso ser especialista em marcas e patentes?",
    preheader: "Treinamento comercial para você começar com segurança",
    heading: "Você aprende o que precisa para vender",
    text:
      "{{primeiro_nome}}, essa é uma das dúvidas mais comuns. A Regicenter oferece treinamento comercial para você aprender a apresentar os serviços e desenvolver sua atuação junto aos clientes.\n\nA parte técnica e jurídica dos processos fica com a equipe especializada da Regicenter. O seu papel é entender a necessidade do cliente e conectar a solução certa.\n\nNa conversa com a equipe de expansão, você entende o perfil desejado e os requisitos para atuar como franqueado.",
    button: "Entender o perfil do franqueado",
  },
  {
    day: 5,
    subject: "Marketing para a sua unidade",
    preheader: "Apoio especializado na captação de clientes",
    heading: "Você não começa sozinho na captação",
    text:
      "Conquistar os primeiros clientes é um dos maiores desafios de quem empreende. Por isso, o franqueado Regicenter conta com apoio especializado de marketing para a captação de clientes.\n\nAssim, você dedica o seu tempo ao que faz a diferença: conversar com empresários, entender o momento de cada negócio e apresentar a proteção da marca como investimento.",
    button: "Conhecer o suporte da franquia",
    url: LP_URL,
  },
  {
    day: 6,
    subject: "Investimento da franquia: R$ 27.900,00",
    preheader: "Peça as condições e os detalhes do modelo",
    heading: "Quanto custa começar",
    text:
      "O investimento para ser franqueado Regicenter é de **R$ 27.900,00**.\n\nNa apresentação, a equipe de expansão detalha o que está incluído, os custos adicionais e as condições atuais do modelo, para você avaliar com todas as informações na mesa.\n\nSe esse investimento faz sentido para o seu momento, o próximo passo é conversar com a equipe.",
    button: "Solicitar as condições",
  },
  {
    day: 9,
    subject: "O que você vai oferecer aos seus clientes",
    preheader: "Marcas, patentes, software, direitos autorais e mais",
    heading: "Um portfólio completo de proteção",
    text:
      "Como franqueado, você apresenta soluções que toda empresa em crescimento precisa:\n\n**Registro de marca** — nome, identidade visual e logotipo.\n**Registro de patentes** — invenções e processos.\n**Registro de software** — código-fonte e direitos de propriedade.\n**Direitos autorais e desenho industrial** — trabalhos criativos e design de produtos.\n**Busca de anterioridade** — análise de conflitos antes do registro.\n\nA estrutura especializada da Regicenter apoia a entrega de cada um desses serviços.",
    button: "Ver o modelo de atuação",
    url: LP_URL,
  },
  {
    day: 12,
    subject: "Como é a rotina de um franqueado Regicenter",
    preheader: "Foco no relacionamento, com a operação do seu lado",
    heading: "O seu dia a dia, na prática",
    text:
      "{{primeiro_nome}}, a rotina do franqueado gira em torno de pessoas: encontrar empresas que estão crescendo, entender o que precisam proteger e apresentar a solução.\n\nDepois do fechamento, a Regicenter conduz os processos, a gestão dos contratos e o suporte jurídico. Você acompanha o cliente e segue desenvolvendo novos negócios.\n\nQuer saber como isso funcionaria na sua região? A equipe de expansão explica em uma conversa rápida.",
    button: "Agendar uma conversa",
  },
  {
    day: 15,
    subject: "A sua cidade ainda está disponível?",
    preheader: "Consulte a disponibilidade para a sua região",
    heading: "Disponibilidade por região",
    text:
      "A disponibilidade da franquia é avaliada por região. Pelo seu cadastro, a equipe de expansão já sabe de onde você é, mas a confirmação acontece na conversa.\n\nSe você ainda tem interesse, vale garantir essa informação antes de seguir avaliando.",
    button: "Consultar disponibilidade",
  },
  {
    day: 18,
    subject: "Suas dúvidas sobre a franquia, respondidas",
    preheader: "Investimento, experiência, operação e próximos passos",
    heading: "Perguntas frequentes",
    text:
      "**Preciso ter experiência?** A Regicenter oferece treinamento comercial e suporte especializado.\n\n**Quem cuida dos processos?** A Regicenter conduz os processos operacionais, com gestão de contratos e suporte jurídico no segmento.\n\n**Posso abrir na minha cidade?** A equipe apresenta a disponibilidade e as condições para a sua região.\n\n**O que acontece depois?** A equipe de expansão fala com você pelo WhatsApp para apresentar o modelo e as condições.\n\nFicou alguma dúvida? É só responder este e-mail.",
    button: "Ver todas as respostas",
    url: LP_URL,
  },
  {
    day: 21,
    subject: "O que dizem os clientes da Regicenter",
    preheader: "A reputação que acompanha o seu negócio",
    heading: "Uma marca que os clientes recomendam",
    text:
      "Como franqueado, você representa uma marca com histórico de clientes satisfeitos:\n\n\"Serviço impecável! A Regicenter nos guiou em cada etapa do registro de marca com muita segurança e agilidade. Total confiança.\" — Anderson Rauber\n\n\"Empresa que prima pela responsabilidade, eficiência e seriedade. Atendimento gentil/humanizado e profissional. Excelente escolha, recomendo!\" — Dieison Fabiano",
    button: "Conhecer a Regicenter",
    url: SITE_URL,
  },
  {
    day: 24,
    subject: "Três passos até conhecer o modelo",
    preheader: "Simples, rápido e sem compromisso",
    heading: "Ainda avaliando? Veja o próximo passo",
    text:
      "{{primeiro_nome}}, o caminho até a apresentação completa é curto:\n\n**1.** Você confirma alguns dados sobre o seu perfil.\n**2.** A equipe de expansão chama você no WhatsApp.\n**3.** Você conhece o modelo, o investimento e as condições para a sua cidade.\n\nA conversa é para tirar dúvidas, sem compromisso.",
    button: "Dar o próximo passo",
  },
  {
    day: 27,
    subject: "Uma conversa de 15 minutos pode esclarecer tudo",
    preheader: "Fale com a equipe de expansão",
    heading: "Que tal conversarmos?",
    text:
      "Avaliar uma franquia leva tempo, e é normal ter dúvidas. Em uma conversa curta com a equipe de expansão, você entende como a Regicenter funciona por dentro, quanto investir e se o modelo combina com o seu perfil.\n\nSe preferir, responda este e-mail com a sua dúvida e a gente retorna.",
    button: "Quero conversar",
  },
  {
    day: 30,
    subject: "Vamos encerrar por aqui, {{primeiro_nome}}?",
    preheader: "Último e-mail desta série sobre a franquia",
    heading: "Este é o nosso último e-mail da série",
    text:
      "Nas últimas semanas, compartilhamos como funciona a franquia Regicenter. Este é o último e-mail desta série.\n\nSe o momento ainda não chegou, tudo bem. Quando quiser retomar, é só responder esta mensagem ou falar com a equipe pelo botão abaixo. Vai ser um prazer apresentar a oportunidade.",
    button: "Retomar a conversa",
  },
];

export const FRANCHISE_NURTURE: PlaybookDef = {
  key: "franchise_nurture",
  name: "Nutrição franquia",
  description: "15 e-mails em 30 dias: diário na 1ª semana, depois a cada 3 dias. Sai em reunião, handoff, ganho ou perda.",
  trigger: "franchise_nurture",
  priority: 35,
  steps: NURTURE.map((m) => ({
    copyKey: `franchise.nurture.d${m.day}`,
    delayMinutes: m.day === 0 ? 30 : m.day * D,
    channel: "EMAIL" as const,
    email: () => mail(m),
  })),
};

export const FRANCHISE_PLAYBOOKS: PlaybookDef[] = [FRANCHISE_NURTURE];

/** Cria o fluxo de nutrição da franquia se faltar (idempotente). */
export async function ensureFranchiseFlows(workspaceId: string) {
  const { ensureDefaultFlows } = await import("@/lib/flows/playbooks");
  return ensureDefaultFlows(workspaceId, { playbooks: FRANCHISE_PLAYBOOKS });
}
