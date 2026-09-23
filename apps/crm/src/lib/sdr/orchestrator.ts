/**
 * Orquestrador SDR: lógica pura que decide próximo estado, copy, handoff e tipo de delay.
 * Sem I/O de envio; usado pelo job handler que aplica delay + typing + send.
 */

import type {
  TenantSdrConfig,
  SdrConversationState,
  SdrEstadoFluxo,
  SdrTom,
  SdrRegrasAtendimento,
  ForcarHandoffKey,
} from "./types";
import { SDR_ESTADOS_FLUXO } from "./types";
import { getCopyForEstado, COPIES_SEGURANCA } from "./copies";

const PROXIMO_ESTADO: Record<SdrEstadoFluxo, SdrEstadoFluxo | null> = {
  inicio: "contexto",
  contexto: "problema",
  problema: "perfil",
  perfil: "orcamento",
  orcamento: "urgencia",
  urgencia: "qualificado",
  qualificado: "handoff",
  handoff: null,
};

/** Score incremental por estado preenchido (simplificado). */
const SCORE_POR_ESTADO: Partial<Record<SdrEstadoFluxo, number>> = {
  contexto: 10,
  problema: 25,
  perfil: 40,
  orcamento: 55,
  urgencia: 70,
  qualificado: 85,
};

const RESPOSTA_VAGA_MIN_CHARS = 5;
const RESPOSTA_VAGA_PALAVRAS = new Set(
  ["sim", "não", "nao", "ok", "talvez", "nada", "sei la", "n"].map((s) => s.toLowerCase().trim())
);

const FORCAR_HANDOFF_TERMOS: Record<ForcarHandoffKey, string[]> = {
  preco_detalhado: ["preço", "preco", "valor", "quanto custa", "custa"],
  contrato: ["contrato", "proposta"],
  juridico: ["jurídico", "juridico", "advogado", "legal"],
  reclamacao: ["reclamação", "reclamacao", "reclamar", "problema com"],
};

export type DelayType = "simples" | "importante" | "handoff";

export interface OrchestratorDecision {
  /** Copy a enviar (pode ser mensagem de handoff, fora de horário, resposta vaga ou próxima pergunta). */
  copy: string;
  /** Próximo estado do fluxo (após esta resposta). */
  nextEstado: SdrEstadoFluxo;
  /** Score após esta interação. */
  score: number;
  /** Se deve fazer handoff (enviar mensagem de transição e marcar handoffEfetuado). */
  handoff: boolean;
  /** Tipo de delay a aplicar (simples, importante, handoff). */
  delayType: DelayType;
  /** Se está fora do horário (só enviar mensagem_fora_horario, não avançar estado). */
  foraHorario: boolean;
  /** Novo estado SDR para persistir em Conversation.metadata.sdr. */
  newSdrState: SdrConversationState;
}

export interface OrchestratorInput {
  config: TenantSdrConfig;
  sdrState: SdrConversationState | null;
  /** Últimas mensagens da conversa (cronológica: [mais antiga, ..., mais recente]). */
  messages: { direction: "IN" | "OUT"; content: string }[];
  /** Conteúdo da última mensagem do lead. */
  lastLeadMessage: string;
}

function isWithinBusinessHours(config: TenantSdrConfig, now: Date): boolean {
  const horarios = config.horarios;
  if (!horarios?.inicio || !horarios?.fim || !horarios.dias?.length) return true;
  const dayMap = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
  const day = dayMap[now.getDay()];
  if (!horarios.dias.includes(day)) return false;
  const [h0, m0] = horarios.inicio.split(":").map(Number);
  const [h1, m1] = horarios.fim.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = h0 * 60 + m0;
  const endMin = h1 * 60 + m1;
  return nowMin >= startMin && nowMin <= endMin;
}

function lastBotMessageState(messages: { direction: "IN" | "OUT"; content: string }[]): SdrEstadoFluxo | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === "OUT") return null; // última do bot não temos estado guardado na mensagem; caller pode passar sdrState.ultimaPerguntaEstado
  }
  return null;
}

function isRespostaVaga(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < RESPOSTA_VAGA_MIN_CHARS) return true;
  if (RESPOSTA_VAGA_PALAVRAS.has(t)) return true;
  return false;
}

function leadWantsHandoff(text: string, config: TenantSdrConfig): boolean {
  const t = text.trim().toLowerCase();
  const palavras = config.handoff?.palavras_criticas ?? [];
  for (const p of palavras) {
    if (t.includes(p.trim().toLowerCase())) return true;
  }
  const forcar = config.seguranca?.forcar_handoff_em ?? [];
  for (const key of forcar) {
    const termos = FORCAR_HANDOFF_TERMOS[key];
    if (termos?.some((term) => t.includes(term))) return true;
  }
  return false;
}

function pickDelayMs(regras: TenantSdrConfig["regras"], type: DelayType): number {
  const r = (regras ?? {}) as {
    delay_pergunta_simples_ms?: { min?: number; max?: number };
    delay_pergunta_importante_ms?: { min?: number; max?: number };
    delay_antes_handoff_ms?: { min?: number; max?: number };
  };
  const range =
    type === "handoff"
      ? r.delay_antes_handoff_ms
      : type === "importante"
        ? r.delay_pergunta_importante_ms
        : r.delay_pergunta_simples_ms;
  const min = range?.min ?? 1500;
  const max = range?.max ?? 2500;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Decide a próxima ação do SDR: copy, próximo estado, handoff, tipo de delay.
 * Retorna null se não deve responder (ex.: já em handoff, sem config).
 */
export function decideSdrResponse(input: OrchestratorInput): OrchestratorDecision | null {
  const { config, sdrState, messages, lastLeadMessage } = input;
  const tom: SdrTom = config.tom?.tom ?? "conversacional";
  const regras: SdrRegrasAtendimento = (config.regras ?? {}) as SdrRegrasAtendimento;
  const handoffConfig = config.handoff ?? { score_minimo_handoff: 70, palavras_criticas: [], destino: "", mensagem_handoff: "" };
  const limiar = config.qualificacao?.limiar_qualificado ?? 70;
  const now = new Date();

  if (sdrState?.handoffEfetuado) return null;

  const currentEstado: SdrEstadoFluxo = sdrState?.estado ?? "inicio";
  const currentScore = sdrState?.score ?? 0;
  const mensagensEnviadasPeloBot = sdrState?.mensagensEnviadasPeloBot ?? 0;

  // Fora do horário: só enviar mensagem_fora_horario
  if (!isWithinBusinessHours(config, now)) {
    const copy = config.horarios?.mensagem_fora_horario ?? COPIES_SEGURANCA.fora_horario;
    return {
      copy,
      nextEstado: currentEstado,
      score: currentScore,
      handoff: false,
      delayType: "simples",
      foraHorario: true,
      newSdrState: {
        estado: currentEstado,
        score: currentScore,
        handoffEfetuado: false,
        ultimaPerguntaEstado: null,
        ultimaPerguntaEm: null,
        mensagensEnviadasPeloBot,
      },
    };
  }

  // Handoff imediato por palavras-chave ou tema sensível
  if (leadWantsHandoff(lastLeadMessage, config)) {
    const copy = handoffConfig.mensagem_handoff || getCopyForEstado(tom, "handoff");
    return {
      copy,
      nextEstado: "handoff",
      score: currentScore,
      handoff: true,
      delayType: "handoff",
      foraHorario: false,
      newSdrState: {
        estado: "handoff",
        score: currentScore,
        handoffEfetuado: true,
        ultimaPerguntaEstado: "handoff",
        ultimaPerguntaEm: now.toISOString(),
        mensagensEnviadasPeloBot: mensagensEnviadasPeloBot + 1,
      },
    };
  }

  // Resposta vaga: clarificar sem avançar
  const ultimaPerguntaEstado = sdrState?.ultimaPerguntaEstado ?? (messages.some((m) => m.direction === "OUT") ? currentEstado : null);
  if (regras?.tentar_clarificar_resposta_vaga && ultimaPerguntaEstado && isRespostaVaga(lastLeadMessage)) {
    const copy = COPIES_SEGURANCA.resposta_vaga;
    return {
      copy,
      nextEstado: currentEstado,
      score: currentScore,
      handoff: false,
      delayType: "simples",
      foraHorario: false,
      newSdrState: {
        estado: currentEstado,
        score: currentScore,
        handoffEfetuado: false,
        ultimaPerguntaEstado,
        ultimaPerguntaEm: sdrState?.ultimaPerguntaEm ?? null,
        mensagensEnviadasPeloBot: mensagensEnviadasPeloBot + 1,
      },
    };
  }

  // Limite de mensagens
  if (regras?.quantidade_max_mensagens && mensagensEnviadasPeloBot >= regras.quantidade_max_mensagens) {
    return null;
  }

  // Enviar copy do estado atual e avançar para o próximo
  const nextEstado = PROXIMO_ESTADO[currentEstado] ?? currentEstado;
  const newScore = (nextEstado && nextEstado !== "handoff" ? SCORE_POR_ESTADO[nextEstado] : currentScore) ?? currentScore;

  const shouldHandoff =
    nextEstado === "handoff" ||
    (nextEstado === "qualificado" && newScore >= handoffConfig.score_minimo_handoff);

  // Copy a enviar: estado atual (ex.: inicio = boas-vindas; handoff = mensagem de transição)
  const estadoParaCopy: SdrEstadoFluxo = shouldHandoff ? "handoff" : currentEstado;
  const copy = shouldHandoff
    ? (handoffConfig.mensagem_handoff || getCopyForEstado(tom, "handoff"))
    : getCopyForEstado(tom, estadoParaCopy);

  const delayType: DelayType = shouldHandoff ? "handoff" : (["problema", "perfil", "orcamento", "urgencia"].includes(currentEstado) ? "importante" : "simples");

  return {
    copy,
    nextEstado: shouldHandoff ? "handoff" : nextEstado,
    score: newScore,
    handoff: shouldHandoff,
    delayType,
    foraHorario: false,
    newSdrState: {
      estado: shouldHandoff ? "handoff" : nextEstado,
      score: newScore,
      handoffEfetuado: shouldHandoff,
      ultimaPerguntaEstado: shouldHandoff ? null : estadoParaCopy,
      ultimaPerguntaEm: shouldHandoff ? null : now.toISOString(),
      mensagensEnviadasPeloBot: mensagensEnviadasPeloBot + 1,
    },
  };
}

/** Retorna delay em ms para o tipo escolhido. */
export function getDelayMs(config: TenantSdrConfig, delayType: DelayType): number {
  return pickDelayMs((config.regras ?? {}) as SdrRegrasAtendimento, delayType);
}
