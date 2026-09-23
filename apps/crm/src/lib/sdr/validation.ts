/**
 * Validação da configuração SDR antes de persistir.
 * Garante tipos, enums, limites numéricos e que perguntas_ativas e score não quebrem a lógica.
 */

import type {
  TenantSdrConfig,
  SdrTom,
  SdrIdioma,
  PerguntaAtivaKey,
  DiaSemana,
  ForcarHandoffKey,
} from "./types";
import {
  SDR_TOM_VALUES,
  SDR_IDIOMAS,
  PERGUNTAS_ATIVAS_KEYS,
  DIAS_SEMANA,
  FORCAR_HANDOFF_KEYS,
} from "./types";

export interface ValidationError {
  field?: string;
  message: string;
}

const TOM_SET = new Set<string>(SDR_TOM_VALUES);
const IDIOMA_SET = new Set<string>(SDR_IDIOMAS);
const PERGUNTA_SET = new Set<string>(PERGUNTAS_ATIVAS_KEYS);
const DIA_SET = new Set<string>(DIAS_SEMANA);
const FORCAR_HANDOFF_SET = new Set<string>(FORCAR_HANDOFF_KEYS);

export function validateSdrConfig(data: unknown): {
  ok: boolean;
  errors: ValidationError[];
  normalized?: TenantSdrConfig;
} {
  const errors: ValidationError[] = [];
  const raw = data as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: [{ message: "Configuração inválida." }] };
  }

  // Identidade
  const identidade = raw.identidade as Record<string, unknown> | undefined;
  if (identidade && typeof identidade === "object") {
    if (identidade.idioma !== undefined && !IDIOMA_SET.has(String(identidade.idioma))) {
      errors.push({ field: "identidade.idioma", message: "Idioma inválido." });
    }
  }

  // Tom
  const tom = raw.tom as Record<string, unknown> | undefined;
  if (tom && typeof tom === "object" && tom.tom !== undefined) {
    if (!TOM_SET.has(String(tom.tom))) {
      errors.push({
        field: "tom.tom",
        message: "Tom deve ser: muito_informal, conversacional, profissional_direto ou consultivo.",
      });
    }
  }

  // Regras
  const regras = raw.regras as Record<string, unknown> | undefined;
  if (regras && typeof regras === "object") {
    const maxPerg = regras.max_perguntas_seguidas;
    if (maxPerg !== undefined) {
      const n = Number(maxPerg);
      if (Number.isNaN(n) || n < 1 || n > 5) {
        errors.push({
          field: "regras.max_perguntas_seguidas",
          message: "Máximo de perguntas seguidas deve ser entre 1 e 5.",
        });
      }
    }
    const tempoMax = regras.tempo_max_conversa_min;
    if (tempoMax !== undefined) {
      const n = Number(tempoMax);
      if (Number.isNaN(n) || n < 5 || n > 120) {
        errors.push({
          field: "regras.tempo_max_conversa_min",
          message: "Tempo máximo de conversa deve ser entre 5 e 120 minutos.",
        });
      }
    }
    const qtdMax = regras.quantidade_max_mensagens;
    if (qtdMax !== undefined) {
      const n = Number(qtdMax);
      if (Number.isNaN(n) || n < 10 || n > 200) {
        errors.push({
          field: "regras.quantidade_max_mensagens",
          message: "Quantidade máxima de mensagens deve ser entre 10 e 200.",
        });
      }
    }
    const validateDelayRange = (key: string, val: unknown) => {
      const r = val as Record<string, unknown> | undefined;
      if (r && typeof r === "object" && r.min !== undefined && r.max !== undefined) {
        const min = Number(r.min);
        const max = Number(r.max);
        if (Number.isNaN(min) || Number.isNaN(max) || min < 500 || max > 15000 || min > max) {
          errors.push({
            field: `regras.${key}`,
            message: "Delay deve ter min/max entre 500 e 15000 ms, com min <= max.",
          });
        }
      }
    };
    validateDelayRange("delay_pergunta_simples_ms", regras.delay_pergunta_simples_ms);
    validateDelayRange("delay_pergunta_importante_ms", regras.delay_pergunta_importante_ms);
    validateDelayRange("delay_antes_handoff_ms", regras.delay_antes_handoff_ms);
    const delayEntre = regras.delay_entre_mensagens_quebradas_ms;
    if (delayEntre !== undefined) {
      const n = Number(delayEntre);
      if (Number.isNaN(n) || n < 300 || n > 3000) {
        errors.push({
          field: "regras.delay_entre_mensagens_quebradas_ms",
          message: "Delay entre mensagens quebradas deve ser entre 300 e 3000 ms.",
        });
      }
    }
  }

  // Qualificação: perguntas_ativas e score
  const qualificacao = raw.qualificacao as Record<string, unknown> | undefined;
  if (qualificacao && typeof qualificacao === "object") {
    const perguntas = qualificacao.perguntas_ativas;
    if (Array.isArray(perguntas)) {
      for (const p of perguntas) {
        if (!PERGUNTA_SET.has(String(p))) {
          errors.push({
            field: "qualificacao.perguntas_ativas",
            message: `Pergunta inválida: ${p}. Use apenas: ${PERGUNTAS_ATIVAS_KEYS.join(", ")}.`,
          });
          break;
        }
      }
    }
    const score = qualificacao.score as Record<string, unknown> | undefined;
    if (score && typeof score === "object") {
      const foraIcp = score.fora_icp;
      if (foraIcp !== undefined) {
        const n = Number(foraIcp);
        if (Number.isNaN(n) || n > -1) {
          errors.push({
            field: "qualificacao.score.fora_icp",
            message: "Penalidade fora_icp deve ser negativa (ex.: -100).",
          });
        }
      }
      const decisor = Number(score.decisor);
      const impacto = Number(score.impacto_alto);
      const orcamento = Number(score.orcamento_definido);
      const urgencia = Number(score.urgencia_imediata);
      if (
        !Number.isNaN(decisor) &&
        !Number.isNaN(impacto) &&
        !Number.isNaN(orcamento) &&
        !Number.isNaN(urgencia)
      ) {
        const somaPositiva = decisor + impacto + orcamento + urgencia;
        if (somaPositiva > 100) {
          errors.push({
            field: "qualificacao.score",
            message: "Soma dos pesos positivos do score não deve ultrapassar 100.",
          });
        }
      }
    }
    const limiar = qualificacao.limiar_qualificado;
    if (limiar !== undefined) {
      const n = Number(limiar);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        errors.push({
          field: "qualificacao.limiar_qualificado",
          message: "Limiar qualificado deve ser entre 0 e 100.",
        });
      }
    }
  }

  // Handoff
  const handoff = raw.handoff as Record<string, unknown> | undefined;
  if (handoff && typeof handoff === "object") {
    const scoreMin = handoff.score_minimo_handoff;
    if (scoreMin !== undefined) {
      const n = Number(scoreMin);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        errors.push({
          field: "handoff.score_minimo_handoff",
          message: "Score mínimo para handoff deve ser entre 0 e 100.",
        });
      }
    }
  }

  // Horários: dias
  const horarios = raw.horarios as Record<string, unknown> | undefined;
  if (horarios && typeof horarios === "object" && Array.isArray(horarios.dias)) {
    for (const d of horarios.dias) {
      if (!DIA_SET.has(String(d))) {
        errors.push({
          field: "horarios.dias",
          message: `Dia inválido: ${d}. Use: seg, ter, qua, qui, sex, sab, dom.`,
        });
        break;
      }
    }
  }

  // Segurança: forcar_handoff_em
  const seguranca = raw.seguranca as Record<string, unknown> | undefined;
  if (seguranca && typeof seguranca === "object" && Array.isArray(seguranca.forcar_handoff_em)) {
    for (const f of seguranca.forcar_handoff_em) {
      if (!FORCAR_HANDOFF_SET.has(String(f))) {
        errors.push({
          field: "seguranca.forcar_handoff_em",
          message: `Item inválido: ${f}. Use: ${FORCAR_HANDOFF_KEYS.join(", ")}.`,
        });
        break;
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Normalizado para persistência (tipos seguros)
  const normalized: TenantSdrConfig = {};
  if (raw.identidade && typeof raw.identidade === "object") {
    const i = raw.identidade as Record<string, unknown>;
    normalized.identidade = {
      nome_sdr: String(i.nome_sdr ?? "Atendente").trim(),
      apresentacao: String(i.apresentacao ?? "").trim(),
      empresa_marca: String(i.empresa_marca ?? "").trim(),
      idioma: (SDR_IDIOMAS as readonly string[]).includes(String(i.idioma ?? "pt-BR"))
        ? (i.idioma as SdrIdioma)
        : "pt-BR",
      usar_emojis: Boolean(i.usar_emojis),
    };
  }
  if (raw.tom && typeof raw.tom === "object") {
    const t = raw.tom as Record<string, unknown>;
    normalized.tom = {
      tom: (SDR_TOM_VALUES as readonly string[]).includes(String(t.tom ?? "conversacional"))
        ? (t.tom as SdrTom)
        : "conversacional",
    };
  }
  if (raw.regras && typeof raw.regras === "object") {
    const r = raw.regras as Record<string, unknown>;
    const clampDelay = (v: unknown, defMin: number, defMax: number) => {
      const o = v as Record<string, unknown> | undefined;
      if (o && typeof o === "object" && o.min != null && o.max != null) {
        const min = Math.max(500, Math.min(15000, Number(o.min) || defMin));
        const max = Math.max(500, Math.min(15000, Number(o.max) || defMax));
        return { min: Math.min(min, max), max: Math.max(min, max) };
      }
      return { min: defMin, max: defMax };
    };
    normalized.regras = {
      max_perguntas_seguidas: Math.min(5, Math.max(1, Number(r.max_perguntas_seguidas) || 2)),
      tentar_clarificar_resposta_vaga: Boolean(r.tentar_clarificar_resposta_vaga),
      tempo_max_conversa_min: Math.min(120, Math.max(5, Number(r.tempo_max_conversa_min) || 15)),
      quantidade_max_mensagens: Math.min(200, Math.max(10, Number(r.quantidade_max_mensagens) || 50)),
      delay_pergunta_simples_ms: clampDelay(r.delay_pergunta_simples_ms, 1500, 2500),
      delay_pergunta_importante_ms: clampDelay(r.delay_pergunta_importante_ms, 3000, 5000),
      delay_antes_handoff_ms: clampDelay(r.delay_antes_handoff_ms, 4000, 6000),
      delay_entre_mensagens_quebradas_ms: Math.min(3000, Math.max(300, Number(r.delay_entre_mensagens_quebradas_ms) || 800)),
    };
  }
  if (raw.qualificacao && typeof raw.qualificacao === "object") {
    const q = raw.qualificacao as Record<string, unknown>;
    const perguntas = Array.isArray(q.perguntas_ativas)
      ? (q.perguntas_ativas as string[]).filter((p) => PERGUNTA_SET.has(p)) as PerguntaAtivaKey[]
      : (["contexto", "problema", "perfil", "orcamento", "urgencia"] as PerguntaAtivaKey[]);
    const sc = (q.score as Record<string, unknown>) || {};
    normalized.qualificacao = {
      perguntas_ativas: perguntas.length ? perguntas : (["contexto", "problema", "perfil", "orcamento", "urgencia"] as PerguntaAtivaKey[]),
      score: {
        decisor: Math.min(100, Math.max(0, Number(sc.decisor) || 25)),
        impacto_alto: Math.min(100, Math.max(0, Number(sc.impacto_alto) || 20)),
        orcamento_definido: Math.min(100, Math.max(0, Number(sc.orcamento_definido) || 30)),
        urgencia_imediata: Math.min(100, Math.max(0, Number(sc.urgencia_imediata) || 15)),
        fora_icp: Math.max(-200, Math.min(-1, Number(sc.fora_icp) || -100)),
      },
      limiar_qualificado: Math.min(100, Math.max(0, Number(q.limiar_qualificado) || 70)),
    };
  }
  if (raw.handoff && typeof raw.handoff === "object") {
    const h = raw.handoff as Record<string, unknown>;
    normalized.handoff = {
      score_minimo_handoff: Math.min(100, Math.max(0, Number(h.score_minimo_handoff) || 70)),
      palavras_criticas: Array.isArray(h.palavras_criticas)
        ? (h.palavras_criticas as string[]).map((s) => String(s).trim()).filter(Boolean)
        : ["quero falar com alguém", "humano"],
      destino: String(h.destino ?? "time_comercial").trim(),
      mensagem_handoff: String(h.mensagem_handoff ?? "").trim() || "Vou te colocar em contato com alguém do time agora.",
    };
  }
  if (raw.horarios && typeof raw.horarios === "object") {
    const ho = raw.horarios as Record<string, unknown>;
    const dias = Array.isArray(ho.dias)
      ? (ho.dias as string[]).filter((d) => DIA_SET.has(d)) as DiaSemana[]
      : (["seg", "ter", "qua", "qui", "sex"] as DiaSemana[]);
    normalized.horarios = {
      inicio: String(ho.inicio ?? "08:00").trim(),
      fim: String(ho.fim ?? "18:00").trim(),
      dias: dias.length ? dias : (["seg", "ter", "qua", "qui", "sex"] as DiaSemana[]),
      mensagem_fora_horario: String(ho.mensagem_fora_horario ?? "").trim() ||
        "Agora estamos fora do horário, mas amanhã cedo alguém continua com você.",
      canais_ativos: Array.isArray(ho.canais_ativos)
        ? (ho.canais_ativos as string[]).map((c) => String(c))
        : ["whatsapp"],
    };
  }
  if (raw.seguranca && typeof raw.seguranca === "object") {
    const s = raw.seguranca as Record<string, unknown>;
    const forcar = Array.isArray(s.forcar_handoff_em)
      ? (s.forcar_handoff_em as string[]).filter((f) => FORCAR_HANDOFF_SET.has(f)) as ForcarHandoffKey[]
      : (["preco_detalhado", "contrato", "juridico"] as ForcarHandoffKey[]);
    normalized.seguranca = {
      bloquear_fora_escopo: Boolean(s.bloquear_fora_escopo),
      forcar_handoff_em: forcar,
      limite_tamanho_resposta:
        s.limite_tamanho_resposta !== undefined ? Number(s.limite_tamanho_resposta) || undefined : undefined,
      log_decisoes: Boolean(s.log_decisoes),
    };
  }

  return { ok: true, errors: [], normalized };
}
