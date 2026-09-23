/**
 * Banco de copys do SDR por tom de voz, estado do fluxo e situações de follow-up.
 * Contrato: copy = COPIES[tom][estado] ou COPIES.followUp[tom][situacao].
 * Nenhuma decisão de fluxo depende do texto.
 */

import type { SdrTom, SdrEstadoFluxo, SdrSituacaoFollowup } from "./types";

type CopyByEstado = Record<SdrEstadoFluxo, string>;
type CopyByTom = Record<SdrTom, CopyByEstado>;
type FollowUpBySituacao = Record<SdrSituacaoFollowup, string>;
type FollowUpByTom = Record<SdrTom, FollowUpBySituacao>;

// --- Fluxo principal: [tom][estado] -> mensagem

const MUITO_INFORMAL: CopyByEstado = {
  inicio: "Oi! Tudo bem?\nPosso te fazer umas perguntas rápidas pra entender se consigo te ajudar?",
  contexto: "O que te fez chamar a gente agora?",
  problema: "Hoje isso te atrapalha mais em que ponto?",
  perfil: "Normalmente é você que decide isso ou tem mais alguém junto?",
  orcamento: "Vocês já pensaram em investir nisso ou ainda não chegaram nessa parte?",
  urgencia: "Isso é pra agora ou mais pra frente?",
  qualificado: "Perfeito, já tenho uma boa visão.",
  handoff: "Perfeito.\nVou te colocar com alguém do time pra seguir com você, ok?",
};

const CONVERSACIONAL: CopyByEstado = {
  inicio: "Oi, tudo bem?\nPosso te fazer algumas perguntas rápidas pra entender melhor o seu cenário?",
  contexto: "O que te levou a entrar em contato com a gente agora?",
  problema: "No dia a dia, isso impacta mais em qual área?",
  perfil: "Hoje você participa dessa decisão ou costuma decidir direto?",
  orcamento: "Pra resolver isso, vocês já têm algum valor em mente ou ainda não?",
  urgencia: "Isso é algo mais imediato ou pode esperar um pouco?",
  qualificado: "Perfeito, ficou claro.",
  handoff: "Acho que agora faz sentido alguém do time falar direto com você.\nVou te passar já com tudo organizado.",
};

const PROFISSIONAL_DIRETO: CopyByEstado = {
  inicio: "Olá.\nPosso te fazer algumas perguntas objetivas para entender se há fit?",
  contexto: "Qual foi o motivo principal do seu contato?",
  problema: "Hoje esse ponto gera impacto maior em qual área?",
  perfil: "Você é o decisor para esse tipo de solução?",
  orcamento: "Existe orçamento previsto para essa demanda?",
  urgencia: "Qual o prazo ideal para resolver isso?",
  qualificado: "Entendido.",
  handoff: "Vou direcionar seu atendimento para um responsável do time.\nEle já entra em contato.",
};

const CONSULTIVO: CopyByEstado = {
  inicio: "Oi, tudo bem?\nQuero entender um pouco do seu contexto antes de te direcionar, tudo bem?",
  contexto: "O que está acontecendo hoje que te fez buscar ajuda?",
  problema: "Como isso tem impactado sua rotina ou seus resultados?",
  perfil: "Normalmente, como funciona a decisão sobre esse tipo de solução aí?",
  orcamento: "Pra resolver isso da melhor forma, vocês já pensaram em investimento ou ainda não?",
  urgencia: "Isso é algo que precisa ser resolvido agora ou pode ser planejado?",
  qualificado: "Obrigado por explicar.",
  handoff: "Acho importante alguém do time conversar com você com mais profundidade.\nVou te encaminhar agora.",
};

export const COPIES: CopyByTom = {
  muito_informal: MUITO_INFORMAL,
  conversacional: CONVERSACIONAL,
  profissional_direto: PROFISSIONAL_DIRETO,
  consultivo: CONSULTIVO,
};

// --- Validação (frases curtas por tom)
const VALIDACAO_MUITO_INFORMAL = ["Entendi.", "Faz sentido.", "Boa, ajuda bastante."];
const VALIDACAO_CONVERSACIONAL = ["Entendi.", "Perfeito.", "Ótimo, ficou claro."];
const VALIDACAO_PROFISSIONAL = ["Entendido.", "Perfeito.", "Ok."];
const VALIDACAO_CONSULTIVO = ["Entendo.", "Faz sentido.", "Obrigado por explicar."];

export const COPIES_VALIDACAO: Record<SdrTom, string[]> = {
  muito_informal: VALIDACAO_MUITO_INFORMAL,
  conversacional: VALIDACAO_CONVERSACIONAL,
  profissional_direto: VALIDACAO_PROFISSIONAL,
  consultivo: VALIDACAO_CONSULTIVO,
};

// --- Segurança (universais ou por tom conforme spec)
export const COPIES_SEGURANCA = {
  resposta_vaga: "Só pra eu entender melhor, pode me dar um exemplo rápido?",
  duvida_fora_escopo:
    "Boa pergunta.\nVou chamar alguém do time pra te ajudar melhor nisso.",
  fora_horario:
    "Agora estamos fora do horário, mas amanhã cedo alguém continua com você.",
};

// --- Follow-up: [tom][situacao] -> mensagem

const FOLLOWUP_MUITO_INFORMAL: FollowUpBySituacao = {
  parou_responder: "Oi!\nFiquei na dúvida se você viu minha última mensagem.",
  resposta_parcial:
    "Entendi 🙂\nSó pra completar, você pode me explicar um pouquinho melhor?",
  aguardando_humano: "Já estou te colocando com alguém do time, só um instante.",
  pediu_tempo: "Oi!\nConseguiu pensar melhor sobre aquilo que falamos?",
  reativacao:
    "Oi!\nVi que a gente conversou um tempo atrás e quis retomar contigo.",
  ultima_tentativa:
    "Vou encerrar por aqui pra não te incomodar.\nSe precisar, é só me chamar.",
};

const FOLLOWUP_CONVERSACIONAL: FollowUpBySituacao = {
  parou_responder:
    "Oi, tudo bem?\nSó passando pra ver se você conseguiu ver minha última mensagem.",
  resposta_parcial:
    "Perfeito.\nPra eu conseguir te direcionar melhor, pode me explicar um pouco mais?",
  aguardando_humano: "Já avisei o time por aqui, em instantes alguém fala com você.",
  pediu_tempo:
    "Oi, tudo bem?\nPassando pra ver se ficou alguma dúvida ou se posso te ajudar em algo.",
  reativacao:
    "Oi, tudo bem?\nNós conversamos há um tempo e quis ver se isso ainda faz sentido pra você.",
  ultima_tentativa:
    "Vou encerrar o contato por aqui pra não ser invasivo.\nSe fizer sentido no futuro, fico à disposição.",
};

const FOLLOWUP_PROFISSIONAL: FollowUpBySituacao = {
  parou_responder: "Olá.\nFico no aguardo do seu retorno para seguirmos.",
  resposta_parcial: "Entendido.\nPode detalhar um pouco mais esse ponto?",
  aguardando_humano: "O atendimento já foi direcionado.\nEm breve alguém entra em contato.",
  pediu_tempo: "Olá.\nRetomando nosso contato conforme combinado.",
  reativacao:
    "Olá.\nEntrando em contato para verificar se o tema ainda é relevante.",
  ultima_tentativa: "Encerrando o contato por ora.\nFico à disposição se precisar.",
};

const FOLLOWUP_CONSULTIVO: FollowUpBySituacao = {
  parou_responder:
    "Oi, tudo bem?\nQueria confirmar se você conseguiu ver minha última mensagem.",
  resposta_parcial:
    "Entendo.\nSe puder, me explica um pouco mais pra eu te orientar melhor.",
  aguardando_humano: "Já passei seu contexto para o time.\nEm breve alguém continua com você.",
  pediu_tempo:
    "Oi, tudo bem?\nQueria saber se você já conseguiu avaliar com mais calma.",
  reativacao:
    "Oi, tudo bem?\nQueria retomar nossa conversa e entender se o cenário mudou por aí.",
  ultima_tentativa:
    "Vou encerrar por aqui pra respeitar seu tempo.\nQuando quiser retomar, é só me avisar.",
};

export const COPIES_FOLLOWUP: FollowUpByTom = {
  muito_informal: FOLLOWUP_MUITO_INFORMAL,
  conversacional: FOLLOWUP_CONVERSACIONAL,
  profissional_direto: FOLLOWUP_PROFISSIONAL,
  consultivo: FOLLOWUP_CONSULTIVO,
};

// --- Helpers para o orquestrador

export function getCopyForEstado(tom: SdrTom, estado: SdrEstadoFluxo): string {
  return COPIES[tom][estado];
}

export function getCopyForFollowUp(
  tom: SdrTom,
  situacao: SdrSituacaoFollowup
): string {
  return COPIES_FOLLOWUP[tom][situacao];
}

export function getValidacaoRandom(tom: SdrTom): string {
  const list = COPIES_VALIDACAO[tom];
  return list[Math.floor(Math.random() * list.length)];
}
