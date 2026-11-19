/**
 * Nutrição Vilaris Consultoria: 7 e-mails em 7 dias (D0–D6).
 * Eleva consciência do lead PME que pediu conversa na LP /consultoria.
 * CTA sem URL usa `destination` da matrícula (LP consultoria).
 */

import type { EmailBlock, EmailContent } from "@/lib/flows/types";
import type { PlaybookDef } from "@/lib/flows/playbooks";

const D = 24 * 60;
const LP_URL = "https://vilarisgestao.com.br/consultoria";
const SITE_URL = "https://vilarisgestao.com.br/";

type Topic = { label: string; title: string; text: string };
type Stat = { value: string; label: string };

type Mail = {
  day: number;
  subject: string;
  preheader: string;
  heading: string;
  text: string;
  topicsTitle?: string;
  topics?: Topic[];
  stats?: Stat[];
  button: string;
  url?: string;
};

function mail(m: Mail): EmailContent {
  const blocks: EmailBlock[] = [{ type: "heading", text: m.heading }, { type: "text", text: m.text }];
  if (m.stats?.length) blocks.push({ type: "stats", items: m.stats });
  if (m.topics?.length) blocks.push({ type: "topics", title: m.topicsTitle, items: m.topics });
  blocks.push({ type: "button", label: m.button, ...(m.url ? { url: m.url } : {}) }, { type: "signature" });
  return { subject: m.subject, preheader: m.preheader, blocks };
}

const NURTURE: Mail[] = [
  {
    day: 0,
    subject: "{{primeiro_nome}}, recebemos seu pedido de conversa",
    preheader: "A Vilaris retorna em horário comercial — sem compromisso",
    heading: "Que bom ter você por aqui, {{primeiro_nome}}",
    text: "Recebemos o contato da sua empresa sobre consultoria financeira. Em horário comercial, a Vilaris retorna para entender o momento do caixa e indicar o horizonte certo — 3, 6 ou 12 meses. Enquanto isso, estes e-mails trazem um recorte objetivo do que muda quando o financeiro deixa de ser susto e vira rotina.",
    topics: [
      {
        label: "Próximo passo",
        title: "Conversa objetiva",
        text: "Sem pitch de 40 minutos. Você conta o momento da empresa; a gente mostra onde o caixa some e qual caminho faz sentido.",
      },
      {
        label: "Esta série",
        title: "7 dias, um tema por vez",
        text: "Sintomas, margem, método e horizontes — para você avaliar com calma antes (ou depois) da conversa.",
      },
    ],
    button: "Rever a consultoria",
    url: LP_URL,
  },
  {
    day: 1,
    subject: "Fatura alto. Caixa apertado. Isso tem nome.",
    preheader: "Não é falta de esforço — é falta de sistema financeiro",
    heading: "O dinheiro entra. E some no caminho.",
    text: "{{primeiro_nome}}, o sintoma mais comum das PMEs que nos procuram é este: entra dinheiro todo mês — e no fim sobra dúvida, não sobra caixa. Quando o faturamento sobe e o caixa não acompanha, o problema raramente é “trabalhar mais”. É ausência de sistema: fluxo, margem e regra.",
    stats: [
      { value: "Entrada", label: "Não garante sobra" },
      { value: "Sistema", label: "Torna o caixa previsível" },
    ],
    topics: [
      {
        label: "01",
        title: "Susto no fim do mês",
        text: "Sem fluxo semanal e mensal, o buraco só aparece quando já é tarde — e a decisão vira improviso.",
      },
      {
        label: "02",
        title: "O que a Vilaris muda",
        text: "Entram rotinas de caixa, leitura de margem e governança leve: o número passa a orientar crédito, retirada e investimento.",
      },
    ],
    button: "Quero organizar meu caixa",
    url: LP_URL,
  },
  {
    day: 2,
    subject: "Você sabe o que dá lucro de verdade?",
    preheader: "Produto, cliente ou canal — a margem precisa aparecer",
    heading: "Margem invisível custa caro",
    text: "Muita PME fatura bem e ainda assim não “vê a cor do dinheiro”. Sem margem por produto, cliente e canal, a operação ocupa gente e capital no que não paga a conta — e protege o que deveria ser cortado ou repriced.",
    topics: [
      {
        label: "Sinal",
        title: "DRE que não governa",
        text: "Se o BPO lança e ninguém governa o plano gerencial, o relatório vira decoração. Falta regra de categorização e leitura semanal.",
      },
      {
        label: "Virada",
        title: "Margem que a equipe entende",
        text: "A Vilaris deixa visível o que sobra de fato — para precificar, priorizar e dizer não com lastro.",
      },
    ],
    button: "Ver como funciona",
    url: LP_URL,
  },
  {
    day: 3,
    subject: "Controle real. Não relatório decorativo.",
    preheader: "Quatro entregas que mudam o cenário da empresa",
    heading: "O que você passa a ter",
    text: "{{primeiro_nome}}, a consultoria da Vilaris entra na operação financeira para estancar sangrias e transformar o caixa em rotina. O foco não é mais um PDF bonito — é decisão com número.",
    topicsTitle: "Entregas",
    topics: [
      {
        label: "01",
        title: "Caixa previsível",
        text: "Fluxo semanal e mensal para ver o buraco antes de cair nele.",
      },
      {
        label: "02",
        title: "Margem por produto",
        text: "Saber o que paga a conta — e o que só ocupa a operação.",
      },
      {
        label: "03",
        title: "Rotina que a equipe segue",
        text: "Fechamento, crédito e cobrança com regra, não com improviso.",
      },
      {
        label: "04",
        title: "Decisão com número",
        text: "Crédito, investimento e retirada de sócio com lastro.",
      },
    ],
    button: "Quero esse controle",
    url: LP_URL,
  },
  {
    day: 4,
    subject: "Três passos. Sem teatro.",
    preheader: "Conversa → diagnóstico → plano em ritmo",
    heading: "Como a Vilaris trabalha",
    text: "O método é direto. Seu BPO e a contabilidade continuam lançando; a Vilaris define o plano de contas gerencial e as regras — para o número fazer sentido.",
    topics: [
      {
        label: "1",
        title: "Conversa",
        text: "Você conta o momento da empresa. Sem pitch longo.",
      },
      {
        label: "2",
        title: "Diagnóstico",
        text: "Caixa, dívida e margem com extratos e ERP — não com achismo.",
      },
      {
        label: "3",
        title: "Plano em ritmo",
        text: "3, 6 ou 12 meses. Encontros + canal direto para decisões críticas em horário comercial.",
      },
    ],
    button: "Agendar a conversa",
    url: LP_URL,
  },
  {
    day: 5,
    subject: "3, 6 ou 12 meses — qual horizonte cabe agora?",
    preheader: "Do saneamento à governança. O valor entra na conversa.",
    heading: "Três caminhos. Um método.",
    text: "Não existe pacote único para toda PME. O horizonte depende do sangramento, da margem e do quanto a empresa já consegue sustentar de rotina.",
    topics: [
      {
        label: "3 meses",
        title: "Saneamento",
        text: "Estancar o sangramento: diagnóstico 360º, mapa de dívidas, fluxo/budget e primeira DRE gerencial.",
      },
      {
        label: "6 meses",
        title: "Estruturação",
        text: "Organizar para sobrar: precificação, produtividade da equipe e capital de giro — além do saneamento.",
      },
      {
        label: "12 meses",
        title: "Governança",
        text: "Escalar com método: orçamento, CAPEX, valuation e rituais de conselho.",
      },
    ],
    button: "Quero indicar meu horizonte",
    url: LP_URL,
  },
  {
    day: 6,
    subject: "{{primeiro_nome}}, pronto para enxergar o caixa?",
    preheader: "Conversa objetiva. Sem compromisso. Sem troca obrigatória de BPO.",
    heading: "O próximo passo é uma conversa",
    text: "Se o faturamento sobe e o caixa não acompanha, adiar só aumenta o custo do improviso. Na conversa, alinhamos o momento da empresa e o horizonte — 3, 6 ou 12 meses. Investimento entra na conversa; compromisso, não.",
    topics: [
      {
        label: "Objetivo",
        title: "Sair do ciclo",
        text: "De susto no fim do mês para rotina que a equipe segue — com margem visível e decisão com lastro.",
      },
      {
        label: "Resposta",
        title: "Horário comercial",
        text: "É só responder este e-mail ou pedir a conversa pelo site. A Vilaris retorna com objetividade.",
      },
    ],
    button: "Quero conversar agora",
    url: LP_URL,
  },
];

export const VILARIS_CONSULTORIA_NURTURE: PlaybookDef = {
  key: "vilaris_consultoria_nurture",
  name: "Nutrição consultoria Vilaris",
  description:
    "7 e-mails em 7 dias para leads da LP de consultoria financeira. Eleva consciência sobre caixa, margem e método. Para quando marca reunião com a equipe ou sai do funil.",
  trigger: "vilaris_consultoria_nurture",
  priority: 34,
  steps: NURTURE.map((m) => ({
    copyKey: `vilaris.consultoria.nurture.d${m.day}`,
    delayMinutes: m.day === 0 ? 20 : m.day * D,
    channel: "EMAIL" as const,
    email: () => mail(m),
  })),
};

export const VILARIS_PLAYBOOKS: PlaybookDef[] = [VILARIS_CONSULTORIA_NURTURE];

/** Cria o fluxo de nutrição da consultoria se faltar (idempotente). */
export async function ensureVilarisConsultoriaFlows(workspaceId: string) {
  const { ensureDefaultFlows } = await import("@/lib/flows/playbooks");
  return ensureDefaultFlows(workspaceId, { playbooks: VILARIS_PLAYBOOKS });
}

export const VILARIS_CONSULTORIA_LP_URL = LP_URL;
export const VILARIS_SITE_URL = SITE_URL;
