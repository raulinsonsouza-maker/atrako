/**
 * Tipos e enums da configuração SDR IA.
 * O cliente personaliza comportamento e linguagem, não a lógica nem decisão crítica.
 */

export const SDR_TOM_VALUES = [
  "muito_informal",
  "conversacional",
  "profissional_direto",
  "consultivo",
] as const;
export type SdrTom = (typeof SDR_TOM_VALUES)[number];

export const SDR_IDIOMAS = ["pt-BR", "es", "en"] as const;
export type SdrIdioma = (typeof SDR_IDIOMAS)[number];

export const PERGUNTAS_ATIVAS_KEYS = [
  "contexto",
  "problema",
  "perfil",
  "orcamento",
  "urgencia",
] as const;
export type PerguntaAtivaKey = (typeof PERGUNTAS_ATIVAS_KEYS)[number];

export const DIAS_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

export const FORCAR_HANDOFF_KEYS = [
  "preco_detalhado",
  "contrato",
  "juridico",
  "reclamacao",
] as const;
export type ForcarHandoffKey = (typeof FORCAR_HANDOFF_KEYS)[number];

/** Estados do fluxo de qualificação (state machine) */
export const SDR_ESTADOS_FLUXO = [
  "inicio",
  "contexto",
  "problema",
  "perfil",
  "orcamento",
  "urgencia",
  "qualificado",
  "handoff",
] as const;
export type SdrEstadoFluxo = (typeof SDR_ESTADOS_FLUXO)[number];

/** Situações de follow-up */
export const SDR_SITUACOES_FOLLOWUP = [
  "parou_responder",
  "resposta_parcial",
  "aguardando_humano",
  "pediu_tempo",
  "reativacao",
  "ultima_tentativa",
] as const;
export type SdrSituacaoFollowup = (typeof SDR_SITUACOES_FOLLOWUP)[number];

// --- Blocos da config

export interface SdrIdentidade {
  nome_sdr: string;
  apresentacao: string;
  empresa_marca: string;
  idioma: SdrIdioma;
  usar_emojis: boolean;
}

export interface SdrTomConfig {
  tom: SdrTom;
}

/** Faixa de delay em ms (min/max para sortear valor humano) */
export interface SdrDelayRange {
  min: number;
  max: number;
}

export interface SdrRegrasAtendimento {
  max_perguntas_seguidas: number;
  tentar_clarificar_resposta_vaga: boolean;
  tempo_max_conversa_min: number;
  quantidade_max_mensagens: number;
  /** Delay antes de enviar: perguntas simples (1,5–2,5 s) */
  delay_pergunta_simples_ms?: SdrDelayRange;
  /** Delay: perguntas importantes (3–5 s) */
  delay_pergunta_importante_ms?: SdrDelayRange;
  /** Delay: antes de handoff (4–6 s) */
  delay_antes_handoff_ms?: SdrDelayRange;
  /** Delay entre mensagens quebradas (ex.: 800 ms) */
  delay_entre_mensagens_quebradas_ms?: number;
}

export interface SdrScoreWeights {
  decisor: number;
  impacto_alto: number;
  orcamento_definido: number;
  urgencia_imediata: number;
  fora_icp: number; // penalidade, deve ser negativo
}

export interface SdrQualificacao {
  perguntas_ativas: PerguntaAtivaKey[];
  score: SdrScoreWeights;
  limiar_qualificado: number;
}

export interface SdrHandoff {
  score_minimo_handoff: number;
  palavras_criticas: string[];
  destino: string; // grupo ou userId
  mensagem_handoff: string;
}

export interface SdrHorarios {
  inicio: string; // "08:00"
  fim: string;   // "18:00"
  dias: DiaSemana[];
  mensagem_fora_horario: string;
  canais_ativos: string[]; // ex: ["whatsapp"]
}

export interface SdrSeguranca {
  bloquear_fora_escopo: boolean;
  forcar_handoff_em: ForcarHandoffKey[];
  limite_tamanho_resposta?: number;
  log_decisoes: boolean;
}

export interface TenantSdrConfig {
  identidade?: SdrIdentidade;
  tom?: SdrTomConfig;
  regras?: SdrRegrasAtendimento;
  qualificacao?: SdrQualificacao;
  handoff?: SdrHandoff;
  horarios?: SdrHorarios;
  seguranca?: SdrSeguranca;
}

/** Estado SDR persistido em Conversation.metadata.sdr */
export interface SdrConversationState {
  estado: SdrEstadoFluxo;
  score: number;
  handoffEfetuado: boolean;
  ultimaPerguntaEstado: SdrEstadoFluxo | null;
  ultimaPerguntaEm: string | null; // ISO date
  mensagensEnviadasPeloBot: number;
}

// --- Defaults para merge

export const DEFAULT_IDENTIDADE: SdrIdentidade = {
  nome_sdr: "Atendente",
  apresentacao: "Sou do time comercial.",
  empresa_marca: "",
  idioma: "pt-BR",
  usar_emojis: false,
};

export const DEFAULT_TOM: SdrTomConfig = {
  tom: "conversacional",
};

export const DEFAULT_REGRAS: SdrRegrasAtendimento = {
  max_perguntas_seguidas: 2,
  tentar_clarificar_resposta_vaga: true,
  tempo_max_conversa_min: 15,
  quantidade_max_mensagens: 50,
  delay_pergunta_simples_ms: { min: 1500, max: 2500 },
  delay_pergunta_importante_ms: { min: 3000, max: 5000 },
  delay_antes_handoff_ms: { min: 4000, max: 6000 },
  delay_entre_mensagens_quebradas_ms: 800,
};

export const DEFAULT_SCORE: SdrScoreWeights = {
  decisor: 25,
  impacto_alto: 20,
  orcamento_definido: 30,
  urgencia_imediata: 15,
  fora_icp: -100,
};

export const DEFAULT_QUALIFICACAO: SdrQualificacao = {
  perguntas_ativas: ["contexto", "problema", "perfil", "orcamento", "urgencia"],
  score: { ...DEFAULT_SCORE },
  limiar_qualificado: 70,
};

export const DEFAULT_HANDOFF: SdrHandoff = {
  score_minimo_handoff: 70,
  palavras_criticas: ["quero falar com alguém", "humano", "atendente"],
  destino: "time_comercial",
  mensagem_handoff: "Vou te colocar em contato com alguém do time agora.",
};

export const DEFAULT_HORARIOS: SdrHorarios = {
  inicio: "08:00",
  fim: "18:00",
  dias: ["seg", "ter", "qua", "qui", "sex"],
  mensagem_fora_horario: "Agora estamos fora do horário, mas amanhã cedo alguém continua com você.",
  canais_ativos: ["whatsapp"],
};

export const DEFAULT_SEGURANCA: SdrSeguranca = {
  bloquear_fora_escopo: true,
  forcar_handoff_em: ["preco_detalhado", "contrato", "juridico"],
  log_decisoes: true,
};

export function mergeWithDefaults(config: Partial<TenantSdrConfig> | null): TenantSdrConfig {
  const regras = config?.regras ?? {};
  return {
    identidade: { ...DEFAULT_IDENTIDADE, ...config?.identidade },
    tom: { ...DEFAULT_TOM, ...config?.tom },
    regras: {
      ...DEFAULT_REGRAS,
      ...regras,
      delay_pergunta_simples_ms: (regras as Partial<SdrRegrasAtendimento>).delay_pergunta_simples_ms ?? DEFAULT_REGRAS.delay_pergunta_simples_ms,
      delay_pergunta_importante_ms: (regras as Partial<SdrRegrasAtendimento>).delay_pergunta_importante_ms ?? DEFAULT_REGRAS.delay_pergunta_importante_ms,
      delay_antes_handoff_ms: (regras as Partial<SdrRegrasAtendimento>).delay_antes_handoff_ms ?? DEFAULT_REGRAS.delay_antes_handoff_ms,
      delay_entre_mensagens_quebradas_ms: (regras as Partial<SdrRegrasAtendimento>).delay_entre_mensagens_quebradas_ms ?? DEFAULT_REGRAS.delay_entre_mensagens_quebradas_ms,
    },
    qualificacao: {
      perguntas_ativas: config?.qualificacao?.perguntas_ativas ?? DEFAULT_QUALIFICACAO.perguntas_ativas,
      score: { ...DEFAULT_SCORE, ...config?.qualificacao?.score },
      limiar_qualificado: config?.qualificacao?.limiar_qualificado ?? DEFAULT_QUALIFICACAO.limiar_qualificado,
    },
    handoff: { ...DEFAULT_HANDOFF, ...config?.handoff },
    horarios: { ...DEFAULT_HORARIOS, ...config?.horarios },
    seguranca: { ...DEFAULT_SEGURANCA, ...config?.seguranca },
  };
}
