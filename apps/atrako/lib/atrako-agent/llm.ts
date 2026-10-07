import "server-only";
import OpenAI from "openai";
import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { resolvePlatformApp } from "@/lib/config/platformApps";
import { getActiveCooldowns, type CooldownInfo } from "./failover";
import {
  AI_CONNECTION_PROVIDER,
  DEFAULT_AI_MODEL,
  PLATFORM_LLM_APPS,
  findAiProvider,
  interleave,
  parseModelList,
  type AiConnectionMetadata,
  type AiProviderId,
} from "./providers";

/**
 * LLM do Atrako: a IA do workspace (Config → IA) primeiro, depois a cadeia
 * gratuita da plataforma (PlatformApp AI_*). Quem responde é invisível ao usuário.
 */

export type LlmConfig = {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  baseUrl: string | null;
  source: "workspace" | "platform";
};

/** Um elo da cadeia; `key` identifica o descanso em `AtrakoLlmCooldown`. */
export type LlmCandidate = LlmConfig & { key: string };

export function maskApiKey(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return "••••";
  const prefix = ["sk-or-", "sk-", "nvapi-", "gsk_"].find((p) => k.startsWith(p)) ?? "";
  return `${prefix}…${k.slice(-4)}`;
}

export function workspaceCooldownPrefix(clienteId: string) {
  return `ws:${clienteId}:`;
}

async function workspaceCandidate(clienteId: string): Promise<LlmCandidate | null> {
  const row = await getWorkspaceConnection(clienteId, AI_CONNECTION_PROVIDER).catch(() => null);
  const apiKey = typeof row?.credentials.apiKey === "string" ? row.credentials.apiKey.trim() : "";
  if (!row || row.status !== "ACTIVE" || !apiKey) return null;
  const meta = (row.metadata ?? {}) as AiConnectionMetadata;
  const provider = findAiProvider(meta.provider)?.id ?? "openai";
  const model = meta.model?.trim() || DEFAULT_AI_MODEL;
  return {
    key: `${workspaceCooldownPrefix(clienteId)}${model}`,
    provider,
    model,
    apiKey,
    baseUrl: meta.baseUrl?.trim() || findAiProvider(provider)?.baseUrl || null,
    source: "workspace",
  };
}

/** Cadeia da plataforma na ordem intercalada, sem filtrar descanso. */
export async function platformCandidates(): Promise<LlmCandidate[]> {
  const perApp = await Promise.all(
    PLATFORM_LLM_APPS.map(async (def) => {
      const app = await resolvePlatformApp(def.app).catch(() => null);
      const apiKey = typeof app?.credentials.clientSecret === "string" ? app.credentials.clientSecret.trim() : "";
      if (!app?.enabled || !apiKey) return [];
      const baseUrl = findAiProvider(def.provider)?.baseUrl ?? null;
      return parseModelList(app.credentials.models, def.defaultModels).map(
        (model): LlmCandidate => ({
          key: `platform:${def.provider}:${model}`,
          provider: def.provider,
          model,
          apiKey,
          baseUrl,
          source: "platform",
        }),
      );
    }),
  );
  return interleave(perApp);
}

export function orderChain(
  workspace: LlmCandidate | null,
  platform: LlmCandidate[],
  cooldowns: Map<string, CooldownInfo>,
): LlmCandidate[] {
  return [...(workspace ? [workspace] : []), ...platform].filter((c) => !cooldowns.has(c.key));
}

export type LlmChain = {
  candidates: LlmCandidate[];
  /** Há alguma IA configurada (mesmo que toda em descanso agora). */
  configured: boolean;
  hasWorkspaceAi: boolean;
};

export async function resolveLlmChain(clienteId: string): Promise<LlmChain> {
  const [workspace, platform, cooldowns] = await Promise.all([
    workspaceCandidate(clienteId),
    platformCandidates(),
    getActiveCooldowns(),
  ]);
  return {
    candidates: orderChain(workspace, platform, cooldowns),
    configured: Boolean(workspace) || platform.length > 0,
    hasWorkspaceAi: Boolean(workspace),
  };
}

export async function platformChainAvailable(): Promise<boolean> {
  return (await platformCandidates()).length > 0;
}

export type PlatformModelStatus = {
  provider: AiProviderId;
  model: string;
  until: string | null;
  reason: string | null;
};

/** Estado de cada modelo da cadeia da plataforma (admin). */
export async function platformChainStatus(): Promise<PlatformModelStatus[]> {
  const [platform, cooldowns] = await Promise.all([platformCandidates(), getActiveCooldowns()]);
  return platform.map((c) => {
    const cd = cooldowns.get(c.key);
    return {
      provider: c.provider,
      model: c.model,
      until: cd ? cd.until.toISOString() : null,
      reason: cd?.reason ?? null,
    };
  });
}

/** Na cadeia, sem retry do SDK: ele esperaria o `retry-after` em vez de passar ao próximo modelo. */
export function createLlmClient(cfg: Pick<LlmConfig, "apiKey" | "baseUrl">, maxRetries = 0): OpenAI {
  return new OpenAI({
    apiKey: cfg.apiKey,
    ...(cfg.baseUrl ? { baseURL: cfg.baseUrl } : {}),
    maxRetries,
  });
}

/** Chamada mínima para validar chave + modelo antes de salvar. */
export async function testLlmConfig(
  cfg: Pick<LlmConfig, "apiKey" | "baseUrl" | "model">,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    await createLlmClient(cfg, 1).chat.completions.create(
      {
        model: cfg.model,
        messages: [{ role: "user", content: "Responda apenas: ok" }],
      },
      { signal: controller.signal },
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeLlmError(err) };
  } finally {
    clearTimeout(timer);
  }
}

export function describeLlmError(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 401) return "Chave de API inválida ou revogada.";
  if (status === 403) return "A chave não tem permissão para este modelo.";
  if (status === 404 || status === 410) {
    return "Este modelo foi descontinuado ou não está liberado na sua conta. Escolha outro modelo.";
  }
  if (status === 429) return "Limite de uso ou créditos esgotados na sua conta de IA.";
  if ((err as { name?: string })?.name === "AbortError") return "O provedor de IA demorou demais para responder.";
  const message = (err as { message?: string })?.message;
  return message ? `Falha ao falar com a IA: ${message.slice(0, 160)}` : "Falha ao falar com a IA.";
}
