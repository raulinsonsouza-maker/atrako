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

type Topic = { label: string; title: string; text: string };
type Stat = { value: string; label: string };
type Quote = { text: string; name: string; role?: string };

type Mail = {
  day: number;
  subject: string;
  preheader: string;
  heading: string;
  text: string;
  topicsTitle?: string;
  topics?: Topic[];
  stats?: Stat[];
  quotes?: Quote[];
  button: string;
  url?: string;
};

function mail(m: Mail): EmailContent {
  const blocks: EmailBlock[] = [{ type: "heading", text: m.heading }, { type: "text", text: m.text }];
  if (m.stats?.length) blocks.push({ type: "stats", items: m.stats });
  if (m.topics?.length) blocks.push({ type: "topics", title: m.topicsTitle, items: m.topics });
  for (const quote of m.quotes ?? []) blocks.push({ type: "quote", ...quote });
  blocks.push({ type: "button", label: m.button, ...(m.url ? { url: m.url } : {}) }, { type: "signature" });
  return { subject: m.subject, preheader: m.preheader, blocks };
}

const NURTURE: Mail[] = [
  {
    day: 0,
    subject: "Recebemos seu interesse na franquia Regicenter",
    preheader: "A equipe de expansão vai falar com você pelo WhatsApp",
    heading: "Que bom ter você por aqui, {{primeiro_nome}}",
    text: "Recebemos seu cadastro para conhecer a franquia Regicenter. A equipe de expansão chama você no WhatsApp informado para apresentar o modelo e a disponibilidade da sua cidade. Enquanto isso, estes e-mails reúnem o que ajuda a avaliar com calma.",
    topics: [
      {
        label: "WhatsApp",
        title: "O que a equipe pergunta",
        text: "A conversa apresenta o modelo, o investimento de R$ 27.900,00 e se a sua região está disponível. É para tirar dúvidas, sem compromisso de compra.",
      },
      {
        label: "Esta série",
        title: "O que chega nos próximos dias",
        text: "Um recorte por vez, ao longo de 30 dias: como a unidade funciona, quem conduz os processos, o treinamento, o marketing, o portfólio e a rotina do franqueado.",
      },
      {
        label: "Se quiser adiantar",
        title: "Como chegar à apresentação",
        text: "Responda algumas perguntas rápidas sobre o seu perfil. A apresentação já chega alinhada ao seu momento e à sua cidade.",
      },
    ],
    button: "Adiantar minha apresentação",
  },
  {
    day: 1,
    subject: "Como funciona a franquia Regicenter",
    preheader: "Você desenvolve clientes. A Regicenter cuida dos processos.",
    heading: "Um modelo fácil de entender",
    text: "{{primeiro_nome}}, a franquia foi desenhada para o franqueado ficar no relacionamento com as empresas. A operação dos registros fica com a Regicenter, que atua em marcas e patentes desde 2012.",
    topics: [
      {
        label: "01",
        title: "Você conecta as empresas",
        text: "O trabalho começa ao identificar negócios que precisam proteger nome, logotipo ou produto e apresentar as soluções da Regicenter para essa necessidade.",
      },
      {
        label: "02",
        title: "A Regicenter conduz o processo",
        text: "A equipe cuida dos processos e da gestão dos contratos, com suporte jurídico no segmento de marcas e patentes. O cliente não fica sem acompanhamento depois da venda.",
      },
      {
        label: "03",
        title: "Você desenvolve a unidade",
        text: "O seu tempo fica no comercial. O treinamento ensina a apresentar os serviços, e o marketing apoia a captação para a unidade não começar do zero.",
      },
    ],
    button: "Ver o modelo completo",
    url: LP_URL,
  },
  {
    day: 2,
    subject: "Só o CNPJ não protege uma marca",
    preheader: "Por que proteção de marca é uma necessidade de todo negócio",
    heading: "Um mercado que nasce com cada nova empresa",
    text: "Muitos empreendedores acreditam que abrir o CNPJ garante a marca. Não garante: o CNPJ registra a empresa, e a marca só é protegida com o registro no INPI. Essa diferença é a conversa que o franqueado tem com os empresários da região.",
    stats: [{ value: "CNPJ", label: "Não registra a marca" }],
    topics: [
      {
        label: "O custo",
        title: "Perder a identidade sai caro",
        text: "Além do desgaste com clientes, o negócio pode ter de refazer identidade visual, site, placas e materiais quando descobre que o nome ou o logotipo não está protegido.",
      },
      {
        label: "A oportunidade",
        title: "O franqueado atende essa demanda",
        text: "Toda empresa que cria um nome, um logotipo ou um produto precisa dessa proteção. É essa necessidade que a unidade Regicenter ajuda a resolver na região.",
      },
    ],
    button: "Quero conversar com a equipe",
  },
  {
    day: 3,
    subject: "Quem estará ao seu lado na Regicenter",
    preheader: "Desde 2012 protegendo marcas no Brasil e no exterior",
    heading: "Especialistas em proteger marcas",
    text: "A Regicenter Marcas & Patentes atua com foco em proteção de marcas e patentes. A assessoria é jurídica, técnica e administrativa em cada etapa, e os registros internacionais passam por tratados como MERCOSUL, PCT, BENELUX, União Europeia e Tratado de Madri.",
    stats: [
      { value: "2012", label: "Desde" },
      { value: "5.000", label: "Marcas registradas" },
      { value: "Brasil e exterior", label: "Atuação" },
    ],
    button: "Assistir ao vídeo",
    url: VIDEO_URL,
  },
  {
    day: 4,
    subject: "Preciso ser especialista em marcas e patentes?",
    preheader: "Treinamento comercial para você começar com segurança",
    heading: "Você aprende o que precisa para vender",
    text: "{{primeiro_nome}}, não é preciso chegar como especialista em marcas e patentes. O treinamento comercial prepara a apresentação dos serviços, e a parte técnica fica com quem já conduz esses processos.",
    topics: [
      {
        label: "Treinamento",
        title: "O que você aprende",
        text: "A Regicenter ensina a apresentar os serviços e a desenvolver a atuação junto aos clientes. O objetivo é você sair sabendo conduzir a conversa comercial.",
      },
      {
        label: "Equipe jurídica",
        title: "O que fica com a Regicenter",
        text: "A parte técnica e jurídica dos processos fica com a equipe especializada. O seu papel é entender a necessidade do cliente e conectar a solução certa.",
      },
      {
        label: "Expansão",
        title: "O que a conversa esclarece sobre o perfil",
        text: "A equipe de expansão explica o perfil desejado e os requisitos para atuar como franqueado, para você avaliar o encaixe antes de decidir.",
      },
    ],
    button: "Entender o perfil do franqueado",
  },
  {
    day: 5,
    subject: "Marketing para a sua unidade",
    preheader: "Apoio especializado na captação de clientes",
    heading: "Você não começa sozinho na captação",
    text: "Conquistar os primeiros clientes é um dos maiores desafios de quem empreende. O franqueado conta com apoio de marketing para a captação, e o relacionamento com cada empresário continua sendo o trabalho da unidade.",
    topics: [
      {
        label: "Captação",
        title: "O marketing ajuda a encontrar empresas",
        text: "O apoio especializado de marketing existe para a unidade não depender só do improviso na hora de chegar aos primeiros clientes.",
      },
      {
        label: "O seu tempo",
        title: "A conversa fica com você",
        text: "Você dedica o tempo a conversar com empresários, entender o momento de cada negócio e apresentar a proteção da marca como investimento.",
      },
      {
        label: "O limite do apoio",
        title: "Marketing não substitui o relacionamento",
        text: "A campanha abre a porta. Quem escuta a necessidade e explica a solução é o franqueado, no contato direto com o empresário.",
      },
    ],
    button: "Conhecer o suporte da franquia",
    url: LP_URL,
  },
  {
    day: 6,
    subject: "Investimento da franquia: R$ 27.900,00",
    preheader: "Peça as condições e os detalhes do modelo",
    heading: "Quanto custa começar",
    text: "O investimento anunciado para ser franqueado Regicenter é de R$ 27.900,00. O que esse valor cobre, o que fica de fora e as condições do momento são assuntos da apresentação, para você avaliar com a informação atual na mesa.",
    stats: [{ value: "R$ 27.900,00", label: "Investimento anunciado" }],
    topics: [
      {
        label: "Incluso",
        title: "O que está incluído",
        text: "A equipe de expansão detalha o que entra nesse investimento. A lista não está publicada nesta série de propósito: ela é explicada na conversa, com o modelo vigente.",
      },
      {
        label: "Além do valor",
        title: "Custos adicionais",
        text: "Há custos que podem existir fora desse valor. A apresentação separa o que é o investimento anunciado do que pode aparecer depois, sem surpresa no meio do caminho.",
      },
      {
        label: "Agora",
        title: "Condições atuais",
        text: "Condições mudam. O que vale é o que a equipe confirmar na conversa, não um resumo antigo de e-mail.",
      },
    ],
    button: "Solicitar as condições",
  },
  {
    day: 9,
    subject: "O que você vai oferecer aos seus clientes",
    preheader: "Marcas, patentes, software, direitos autorais e mais",
    heading: "Um portfólio completo de proteção",
    text: "Como franqueado, você apresenta o que a empresa em crescimento precisa proteger. A estrutura da Regicenter apoia a entrega de cada serviço: a unidade faz a ponte, e a operação conduz o processo.",
    topics: [
      {
        label: "Marca",
        title: "Registro de marca",
        text: "O cliente protege nome, identidade visual e logotipo. A Regicenter conduz o processo de registro, com a assessoria jurídica, técnica e administrativa de cada etapa.",
      },
      {
        label: "Patente",
        title: "Registro de patentes",
        text: "O cliente protege invenções e processos. A estrutura especializada prepara e acompanha o pedido, para o franqueado não precisar dominar a parte técnica.",
      },
      {
        label: "Software",
        title: "Registro de software",
        text: "O cliente protege código-fonte e direitos de propriedade. A entrega passa pela mesma operação que já conduz os demais registros.",
      },
      {
        label: "Autoral",
        title: "Direitos autorais",
        text: "O cliente protege trabalhos criativos. A Regicenter orienta o caminho do registro e acompanha o processo até a conclusão.",
      },
      {
        label: "Design",
        title: "Desenho industrial",
        text: "O cliente protege o design de produtos. A unidade apresenta a solução, e a equipe técnica cuida da formalização.",
      },
      {
        label: "Antes",
        title: "Busca de anterioridade",
        text: "Antes de registrar, a análise verifica conflitos com o que já existe. É o passo que evita o cliente descobrir o problema tarde demais.",
      },
    ],
    button: "Ver o modelo de atuação",
    url: LP_URL,
  },
  {
    day: 12,
    subject: "Como é a rotina de um franqueado Regicenter",
    preheader: "Foco no relacionamento, com a operação do seu lado",
    heading: "O seu dia a dia, na prática",
    text: "{{primeiro_nome}}, a rotina não é um escritório de processos. É uma sequência comercial: achar quem está crescendo, apresentar a proteção e acompanhar enquanto a operação trabalha.",
    topics: [
      {
        label: "1",
        title: "Encontrar quem está crescendo",
        text: "O dia começa na prospecção: empresas que criaram nome, logotipo ou produto e ainda não protegeram isso. O marketing apoia a captação, e o contato é seu.",
      },
      {
        label: "2",
        title: "Apresentar a proteção",
        text: "Na conversa, você entende o que o negócio precisa proteger e apresenta o serviço correspondente do portfólio, com o treinamento comercial como base.",
      },
      {
        label: "3",
        title: "Acompanhar enquanto a operação segue",
        text: "Depois do fechamento, a Regicenter conduz os processos, a gestão dos contratos e o suporte jurídico. Você acompanha o cliente e segue para o próximo negócio.",
      },
    ],
    button: "Agendar uma conversa",
  },
  {
    day: 15,
    subject: "A sua cidade ainda está disponível?",
    preheader: "Consulte a disponibilidade para a sua região",
    heading: "Disponibilidade por região",
    text: "A franquia é avaliada por região. O cadastro já diz de onde você é. O que ainda falta é a confirmação da equipe, na conversa.",
    topics: [
      {
        label: "Já sabemos",
        title: "O que o cadastro informa",
        text: "A equipe de expansão vê a cidade do seu cadastro e usa isso para preparar a conversa. Não é preciso reenviar os dados para retomar o assunto.",
      },
      {
        label: "Só na conversa",
        title: "O que ainda precisa ser confirmado",
        text: "Disponibilidade e condições da região não saem deste e-mail. Quem confirma é a equipe, para a resposta valer para o seu caso e para o momento atual.",
      },
    ],
    button: "Consultar disponibilidade",
  },
  {
    day: 18,
    subject: "Suas dúvidas sobre a franquia, respondidas",
    preheader: "Investimento, experiência, operação e próximos passos",
    heading: "Perguntas frequentes",
    text: "Estas são as dúvidas que mais aparecem antes da apresentação. Se a sua for outra, responda este e-mail.",
    topics: [
      {
        label: "Experiência",
        title: "Preciso ter experiência?",
        text: "Não é preciso chegar como especialista. A Regicenter oferece treinamento comercial para apresentar os serviços e suporte especializado na operação.",
      },
      {
        label: "Processos",
        title: "Quem cuida dos processos?",
        text: "A Regicenter conduz os processos operacionais, com gestão de contratos e suporte jurídico no segmento de marcas e patentes.",
      },
      {
        label: "Cidade",
        title: "Posso abrir na minha cidade?",
        text: "A disponibilidade é por região. A equipe apresenta a situação e as condições da sua cidade na conversa, a partir do cadastro que você já fez.",
      },
      {
        label: "Próximo passo",
        title: "O que acontece depois?",
        text: "A equipe de expansão fala com você pelo WhatsApp para apresentar o modelo, o investimento de R$ 27.900,00 e as condições. A conversa não é um compromisso de compra.",
      },
    ],
    button: "Ver todas as respostas",
    url: LP_URL,
  },
  {
    day: 21,
    subject: "O que dizem os clientes da Regicenter",
    preheader: "A reputação que acompanha o seu negócio",
    heading: "Uma marca que os clientes recomendam",
    text: "Como franqueado, você representa uma marca que os clientes descrevem pela condução do registro e pelo atendimento. Estes são dois relatos publicados no site.",
    quotes: [
      {
        text: "Serviço impecável! A Regicenter nos guiou em cada etapa do registro de marca com muita segurança e agilidade. Total confiança.",
        name: "Anderson Rauber",
      },
      {
        text: "Empresa que prima pela responsabilidade, eficiência e seriedade. Atendimento gentil/humanizado e profissional. Excelente escolha, recomendo!",
        name: "Dieison Fabiano",
      },
    ],
    button: "Conhecer a Regicenter",
    url: SITE_URL,
  },
  {
    day: 24,
    subject: "Três passos até conhecer o modelo",
    preheader: "Simples, rápido e sem compromisso",
    heading: "Ainda avaliando? Veja o próximo passo",
    text: "{{primeiro_nome}}, o caminho até a apresentação é curto. Nenhum desses passos é um compromisso de compra.",
    topics: [
      {
        label: "1",
        title: "Confirme o perfil",
        text: "Algumas perguntas rápidas sobre o seu momento. Com isso, a equipe chega à conversa já sabendo o que importa para você.",
      },
      {
        label: "2",
        title: "A equipe chama no WhatsApp",
        text: "A expansão usa o número do seu cadastro. A mensagem é para marcar a apresentação, não para pressionar uma decisão.",
      },
      {
        label: "3",
        title: "A apresentação, sem compromisso",
        text: "Você conhece o modelo, o investimento de R$ 27.900,00 e as condições da sua cidade. A conversa existe para tirar dúvidas.",
      },
    ],
    button: "Dar o próximo passo",
  },
  {
    day: 27,
    subject: "Uma conversa de 15 minutos pode esclarecer tudo",
    preheader: "Fale com a equipe de expansão",
    heading: "Que tal conversarmos?",
    text: "Avaliar uma franquia leva tempo, e é normal ainda ter dúvidas. Se preferir escrever, responda este e-mail. Se preferir ouvir, a conversa com a expansão cabe em cerca de 15 minutos.",
    topics: [
      {
        label: "15 minutos",
        title: "O que você sai sabendo",
        text: "Como o modelo funciona, o investimento de R$ 27.900,00 e se ele combina com o seu perfil e com a sua cidade. Três respostas, numa conversa só.",
      },
    ],
    button: "Quero conversar",
  },
  {
    day: 30,
    subject: "Vamos encerrar por aqui, {{primeiro_nome}}?",
    preheader: "Último e-mail desta série sobre a franquia",
    heading: "Este é o nosso último e-mail da série",
    text: "Este é o último e-mail destes 30 dias. Se o momento ainda não chegou, tudo bem. Quando quiser retomar, responda esta mensagem ou fale com a equipe pelo botão.",
    topics: [
      {
        label: "O modelo",
        title: "O que a série mostrou",
        text: "Você conecta empresas que precisam proteger nome, logotipo ou produto. A Regicenter, desde 2012 e com mais de 5.000 marcas, conduz os processos.",
      },
      {
        label: "Quem opera",
        title: "O que fica com a equipe",
        text: "Processos, contratos e suporte jurídico ficam com a Regicenter. Treinamento comercial e marketing de captação apoiam a unidade, sem substituir o seu relacionamento com o empresário.",
      },
      {
        label: "Quando quiser",
        title: "O próximo passo continua o mesmo",
        text: "Uma conversa com a expansão sobre o investimento de R$ 27.900,00, as condições e a disponibilidade da sua cidade. Sem compromisso, no seu tempo.",
      },
    ],
    button: "Retomar a conversa",
  },
];

export const FRANCHISE_NURTURE: PlaybookDef = {
  key: "franchise_nurture",
  name: "Nutrição franquia",
  description: "15 e-mails ao longo de 30 dias. Um por dia na primeira semana e, depois, a cada 3 dias. A série para quando a pessoa marca reunião, passa para a equipe, fecha ou desiste.",
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
