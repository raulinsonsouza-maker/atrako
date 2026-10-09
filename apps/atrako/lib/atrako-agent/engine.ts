import type OpenAI from "openai";
import { buildAtrakoSystemPrompt } from "@atrako/agent";
import { describeWorkspaceContext, type AtrakoWorkspaceContext } from "./context";
import { classifyLlmFailure, type LlmFailure } from "./failover";
import type { LlmCandidate } from "./llm";
import { compactJson, type PiiVault } from "./safety";
import {
  runTool,
  toOpenAITools,
  type AtrakoTool,
  type CoverageState,
  type PendingAction,
  type ToolSource,
} from "./tools";
import { MAX_ARTIFACTS_PER_ANSWER, artifactSummary, pageKey, type Artifact, type RememberedPage } from "./artifacts";

/**
 * Motor do Atrako: o modelo escolhe as ferramentas num loop de tool_calls
 * (não plano fixo). Cada ferramenta vira um evento `step` para o orb; o texto
 * final chega em `token`s.
 */

export type EngineEvent =
  | { type: "step"; id: string; tool: string; label: string }
  | { type: "step_done"; id: string; tool: string; coverage: CoverageState | "error"; ms: number }
  | { type: "token"; text: string }
  /** Texto parcial que precedeu tool_calls — a UI descarta e volta a "pensando". */
  | { type: "discard" }
  | { type: "action"; action: PendingAction }
  | { type: "artifact"; artifact: Artifact };

export type EngineUsage = { prompt: number; completion: number; total: number };

export type EngineStep = {
  tool: string;
  label: string;
  /** Rótulo da fonte consultada ("Vendas consolidadas") — ausente quando a ferramenta falhou. */
  source?: string;
  args: Record<string, unknown>;
  coverage: CoverageState | "error";
  ms: number;
};

export type EngineResult = {
  answer: string;
  /** Modelo que respondeu — só para auditoria, nunca vai ao navegador. */
  model: string;
  usage: EngineUsage;
  steps: EngineStep[];
  sources: ToolSource[];
  pendingAction: PendingAction | null;
  artifacts: Artifact[];
  rounds: number;
};

export type HistoryMessage = { role: "user" | "assistant"; content: string };

/** Subconjunto do SDK que o motor usa (permite mock nos testes). */
export type ChatClient = {
  chat: { completions: { create: OpenAI["chat"]["completions"]["create"] } };
};

export type EngineCandidate = Pick<LlmCandidate, "key" | "provider" | "model">;

export type EngineInput<C extends EngineCandidate = EngineCandidate> = {
  /** Cadeia em ordem; a falha de um passa a vez ao próximo, sem o usuário perceber. */
  candidates: C[];
  makeClient: (candidate: C) => ChatClient;
  /** Chamado a cada modelo que falhou (grava o descanso). */
  onFailover?: (candidate: C, failure: LlmFailure, error: unknown) => void;
  ctx: AtrakoWorkspaceContext;
  tools: AtrakoTool[];
  history: HistoryMessage[];
  /** Pergunta já protegida (sem PII em claro). */
  question: string;
  /** Bloco [Anexos] da mensagem atual. Não entra na checagem de "pode montar". */
  contextNote?: string;
  /** Páginas que esta conversa já leu. ler_pagina não busca de novo. */
  knownPages?: RememberedPage[];
  vault?: PiiVault;
  onEvent?: (event: EngineEvent) => void;
  signal?: AbortSignal;
  maxRounds?: number;
  maxToolCallsPerRound?: number;
  timeoutMs?: number;
  /** Prazo total quando a pergunta usa uma ferramenta `longRunning` (geração de página). */
  longTimeoutMs?: number;
  /** Sem nenhum chunk nesse prazo, o modelo é dado como travado e o próximo assume. */
  firstChunkTimeoutMs?: number;
  maxOutputTokens?: number;
};

export class EngineError extends Error {
  constructor(
    message: string,
    readonly code: "timeout" | "aborted" | "llm" | "exhausted",
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

const DEFAULT_MAX_ROUNDS = 6;
const DEFAULT_MAX_TOOL_CALLS = 6;
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_LONG_TIMEOUT_MS = 240_000;
const DEFAULT_FIRST_CHUNK_TIMEOUT_MS = 25_000;

/** Modelos de raciocínio rejeitam `temperature`. */
function supportsTemperature(model: string) {
  const id = model.split("/").pop() ?? model;
  return !/^(o\d|gpt-5)/i.test(id);
}

type ToolCallAcc = { id: string; name: string; arguments: string };
type ToolPayload = Record<string, unknown>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function questionWithNote(input: Pick<EngineInput, "question" | "contextNote">) {
  const note = input.contextNote?.trim();
  return note ? `${input.question}\n\n${note}` : input.question;
}

export function buildMessages(input: Pick<EngineInput, "ctx" | "tools" | "history" | "question" | "contextNote">): Msg[] {
  const system = buildAtrakoSystemPrompt({
    workspace: describeWorkspaceContext(input.ctx),
  });
  return [
    { role: "system", content: system },
    ...input.history.slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }) as Msg),
    { role: "user", content: questionWithNote(input) },
  ];
}

type RoundOutput = { content: string; calls: Map<number, ToolCallAcc> };

export async function runAtrakoEngine<C extends EngineCandidate>(input: EngineInput<C>): Promise<EngineResult> {
  const maxRounds = input.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const maxCalls = input.maxToolCallsPerRound ?? DEFAULT_MAX_TOOL_CALLS;
  const firstChunkMs = input.firstChunkTimeoutMs ?? DEFAULT_FIRST_CHUNK_TIMEOUT_MS;
  const emit = input.onEvent ?? (() => {});
  const byName = new Map(input.tools.map((t) => [t.name, t]));
  /** Quem respondeu bem segue nas próximas rodadas; só desce na cadeia se falhar. */
  let current = 0;

  const controller = new AbortController();
  const startedAt = Date.now();
  let timer = setTimeout(() => controller.abort(new Error("timeout")), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let extended = false;
  const extendDeadline = () => {
    if (extended) return;
    extended = true;
    clearTimeout(timer);
    const remaining = Math.max(1_000, (input.longTimeoutMs ?? DEFAULT_LONG_TIMEOUT_MS) - (Date.now() - startedAt));
    timer = setTimeout(() => controller.abort(new Error("timeout")), remaining);
  };
  const onAbort = () => controller.abort(new Error("aborted"));
  input.signal?.addEventListener("abort", onAbort, { once: true });

  const messages = buildMessages(input);
  const usage: EngineUsage = { prompt: 0, completion: 0, total: 0 };
  const steps: EngineStep[] = [];
  const sources: ToolSource[] = [];
  let pendingAction: PendingAction | null = null;
  const artifacts: Artifact[] = [];
  let answer = "";
  let rounds = 0;

  async function streamRound(candidate: C, finalRound: boolean, emitted: { tokens: boolean }): Promise<RoundOutput> {
    const openaiTools = toOpenAITools(input.tools, candidate.provider === "openai");
    const attempt = new AbortController();
    const relay = () => attempt.abort(controller.signal.reason);
    controller.signal.addEventListener("abort", relay, { once: true });
    let firstChunkTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(
      () => attempt.abort(new Error("first_chunk_timeout")),
      firstChunkMs,
    );
    try {
      const stream = await input.makeClient(candidate).chat.completions.create(
        {
          model: candidate.model,
          messages,
          ...(openaiTools.length ? { tools: openaiTools, tool_choice: finalRound ? "none" : "auto" } : {}),
          ...(supportsTemperature(candidate.model) ? { temperature: 0.3 } : {}),
          ...(input.maxOutputTokens ? { max_completion_tokens: input.maxOutputTokens } : {}),
          stream: true,
          ...(candidate.provider === "openai" ? { stream_options: { include_usage: true } } : {}),
        },
        { signal: attempt.signal },
      );

      let content = "";
      const calls = new Map<number, ToolCallAcc>();
      let reportedUsage = false;
      for await (const chunk of stream) {
        if (firstChunkTimer) {
          clearTimeout(firstChunkTimer);
          firstChunkTimer = undefined;
        }
        if (chunk.usage) {
          usage.prompt += chunk.usage.prompt_tokens ?? 0;
          usage.completion += chunk.usage.completion_tokens ?? 0;
          usage.total += chunk.usage.total_tokens ?? 0;
          reportedUsage = true;
        }
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          content += delta.content;
          emitted.tokens = true;
          emit({ type: "token", text: delta.content });
        }
        for (const tc of delta.tool_calls ?? []) {
          const acc = calls.get(tc.index) ?? { id: "", name: "", arguments: "" };
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name += tc.function.name;
          if (tc.function?.arguments) acc.arguments += tc.function.arguments;
          calls.set(tc.index, acc);
        }
      }
      if (!reportedUsage) {
        const promptChars = messages.reduce((s, m) => s + (typeof m.content === "string" ? m.content.length : 0), 0);
        usage.prompt += Math.ceil(promptChars / 4);
        usage.completion += Math.ceil(content.length / 4);
        usage.total = usage.prompt + usage.completion;
      }
      return { content, calls };
    } finally {
      if (firstChunkTimer) clearTimeout(firstChunkTimer);
      controller.signal.removeEventListener("abort", relay);
    }
  }

  /** Mesma ferramenta + mesmos argumentos na mesma pergunta reaproveitam o resultado. */
  const toolCache = new Map<string, Promise<ToolPayload>>();
  const onceRuns = new Map<string, Promise<ToolPayload>>();
  const remembered = [...(input.knownPages ?? [])];
  const userText = [...input.history.filter((m) => m.role === "user").map((m) => m.content), questionWithNote(input)].join("\n");

  function alreadyRead(url: string): RememberedPage | undefined {
    const key = pageKey(url);
    return remembered.find((page) => pageKey(page.url) === key);
  }

  async function executeTool(tool: AtrakoTool, callId: string, args: Record<string, unknown>): Promise<ToolPayload> {
    const started = Date.now();
    if (tool.name === "ler_pagina") {
      const url = typeof args.url === "string" ? args.url : "";
      const hit = url ? alreadyRead(url) : undefined;
      if (hit) {
        return {
          coverage: "available",
          fonte: { tool: "ler_pagina", label: hit.title, note: "Página já lida nesta conversa." },
          dados: {
            titulo: hit.title,
            url: hit.url,
            conteudo: hit.memo,
            ja_lida: true,
            aviso: "Esta página já foi lida nesta conversa. Use o conteúdo e não leia de novo.",
          },
        };
      }
    }
    if (tool.longRunning) extendDeadline();
    emit({ type: "step", id: callId, tool: tool.name, label: tool.step });
    try {
      const result = await runTool(tool, args, {
        ctx: input.ctx,
        vault: input.vault,
        signal: controller.signal,
        onProgress: (label) => emit({ type: "step", id: callId, tool: tool.name, label }),
        userText,
        lastUserMessage: input.question,
      });
      const ms = Date.now() - started;
      steps.push({ tool: tool.name, label: tool.step, source: result.source.label, args, coverage: result.coverage, ms });
      sources.push(result.source);
      emit({ type: "step_done", id: callId, tool: tool.name, coverage: result.coverage, ms });
      if (result.pendingAction) {
        pendingAction = result.pendingAction;
        emit({ type: "action", action: result.pendingAction });
      }
      const shown: string[] = [];
      for (const artifact of result.artifacts ?? []) {
        if (artifacts.length >= MAX_ARTIFACTS_PER_ANSWER) break;
        artifacts.push(artifact);
        shown.push(artifactSummary(artifact));
        emit({ type: "artifact", artifact });
      }
      if (tool.name === "ler_pagina" && result.data && typeof result.data === "object") {
        const data = result.data as { url?: string; titulo?: string; conteudo?: string };
        if (data.url && data.conteudo && data.conteudo.length >= 80 && !alreadyRead(data.url)) {
          remembered.push({ url: data.url, title: data.titulo || data.url, memo: data.conteudo.slice(0, 1600) });
        }
      }
      return {
        coverage: result.coverage,
        fonte: result.source,
        dados: result.data,
        ...(shown.length ? { exibido_na_conversa: shown } : {}),
        ...(result.pendingAction
          ? {
              acao: "Rascunho preparado. O cartão com o resumo e o botão 'Criar rascunho' aparece logo abaixo da sua resposta, aqui na conversa. Nada foi criado ainda — responda em 1–2 frases pedindo para revisar o cartão e clicar em 'Criar rascunho'; não repita os campos nem cite outra tela.",
            }
          : {}),
      };
    } catch (error) {
      const ms = Date.now() - started;
      steps.push({ tool: tool.name, label: tool.step, args, coverage: "error", ms });
      emit({ type: "step_done", id: callId, tool: tool.name, coverage: "error", ms });
      console.warn("[atrako-agent] tool", tool.name, error instanceof Error ? error.message : error);
      return { erro: "Não foi possível consultar esta fonte agora." };
    }
  }

  try {
    for (let round = 0; round <= maxRounds; round++) {
      rounds = round + 1;
      const finalRound = round === maxRounds;

      let output: RoundOutput | null = null;
      let lastError: unknown;
      while (!output) {
        const candidate = input.candidates[current];
        if (!candidate) {
          throw new EngineError(
            "O Atrako está com muita demanda agora. Tente de novo em alguns minutos.",
            "exhausted",
            lastError,
          );
        }
        const emitted = { tokens: false };
        try {
          output = await streamRound(candidate, finalRound, emitted);
        } catch (error) {
          if (controller.signal.aborted) throw error;
          lastError = error;
          input.onFailover?.(candidate, classifyLlmFailure(error), error);
          if (emitted.tokens) emit({ type: "discard" });
          current++;
        }
      }
      const { content, calls } = output;

      const toolCalls = [...calls.values()].filter((c) => c.name).slice(0, maxCalls);
      if (!toolCalls.length || finalRound) {
        answer = content.trim();
        break;
      }

      if (content) emit({ type: "discard" });
      toolCalls.forEach((c, i) => {
        if (!c.id) c.id = `call_${round}_${i}`;
      });
      messages.push({
        role: "assistant",
        content: content || null,
        tool_calls: toolCalls.map((c) => ({
          id: c.id,
          type: "function" as const,
          function: { name: c.name, arguments: c.arguments || "{}" },
        })),
      });

      const results = await Promise.all(
        toolCalls.map(async (call) => {
          const tool = byName.get(call.name);
          if (!tool) {
            return { call, payload: { erro: `Ferramenta desconhecida: ${call.name}` } as ToolPayload };
          }
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.arguments || "{}");
          } catch {
            args = {};
          }
          if (tool.oncePerTurn) {
            const previous = onceRuns.get(tool.name);
            if (previous) {
              const prev = await previous;
              if (prev.coverage === "available") {
                return {
                  call,
                  payload: {
                    aviso: `${tool.name} já foi executada com sucesso nesta resposta; não repita. Responda ao usuário com base no resultado anterior (ajustes só se ele pedir).`,
                    resultado_anterior: prev.dados,
                  } as ToolPayload,
                };
              }
            }
          }
          const cacheKey = `${tool.name}:${stableJson(args)}`;
          let pending = toolCache.get(cacheKey);
          if (!pending) {
            pending = executeTool(tool, call.id, args);
            toolCache.set(cacheKey, pending);
          }
          if (tool.oncePerTurn) onceRuns.set(tool.name, pending);
          return { call, payload: await pending };
        }),
      );
      for (const { call, payload } of results) {
        messages.push({ role: "tool", tool_call_id: call.id, content: compactJson(payload) });
      }
    }
  } catch (error) {
    if (error instanceof EngineError) throw error;
    if (controller.signal.aborted) {
      const reason = controller.signal.reason;
      const timedOut = reason instanceof Error && reason.message === "timeout";
      throw new EngineError(
        timedOut ? "A análise demorou mais que o esperado. Tente uma pergunta mais específica." : "Resposta interrompida.",
        timedOut ? "timeout" : "aborted",
        error,
      );
    }
    throw new EngineError("Falha ao falar com a IA.", "llm", error);
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", onAbort);
  }

  if (!answer) {
    answer = pendingAction
      ? "Preparei o rascunho. Confira o resumo abaixo e confirme para eu criar."
      : artifacts.length
        ? "Pronto — está logo abaixo, aqui na conversa."
        : "Não consegui montar uma resposta agora. Pode reformular a pergunta?";
    emit({ type: "token", text: answer });
  }

  return {
    answer,
    model: input.candidates[current]?.model ?? "",
    usage,
    steps,
    sources,
    pendingAction,
    artifacts,
    rounds,
  };
}

/** Custo estimado em micro-USD (mesmas taxas configuráveis do analista). */
export function estimateCostMicros(usage: EngineUsage): number {
  const inputRate = Number(process.env.OPENAI_INPUT_USD_PER_MILLION ?? "0.4");
  const outputRate = Number(process.env.OPENAI_OUTPUT_USD_PER_MILLION ?? "1.6");
  return Math.round(usage.prompt * inputRate + usage.completion * outputRate);
}
