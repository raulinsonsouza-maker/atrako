/**
 * Catálogo de provedores de IA do Config → IA (compartilhado client/server).
 * Só provedores que falam o protocolo OpenAI (chat.completions + tool calling).
 */

export const AI_CONNECTION_PROVIDER = "OPENAI" as const;

export type AiProviderId =
  | "openai"
  | "openrouter"
  | "nvidia"
  | "kilo"
  | "ollama"
  | "groq"
  | "cohere"
  | "custom";

export type AiProviderDef = {
  id: AiProviderId;
  label: string;
  baseUrl: string | null;
  keyPlaceholder: string;
  models: Array<{ value: string; label: string }>;
};

export const AI_PROVIDERS: AiProviderDef[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: null,
    keyPlaceholder: "sk-...",
    models: [
      { value: "gpt-4.1-mini", label: "GPT-4.1 mini — rápido e econômico" },
      { value: "gpt-4.1", label: "GPT-4.1 — análises mais profundas" },
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o mini" },
      { value: "o4-mini", label: "o4-mini — raciocínio" },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyPlaceholder: "sk-or-...",
    models: [
      { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
      { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "openai/gpt-4.1", label: "GPT-4.1 (via OpenRouter)" },
      { value: "openai/gpt-4.1-mini", label: "GPT-4.1 mini (via OpenRouter)" },
    ],
  },
  {
    id: "nvidia",
    label: "NVIDIA (build.nvidia.com)",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    keyPlaceholder: "nvapi-...",
    models: [
      { value: "nvidia/nemotron-3-super-120b-a12b", label: "Nemotron 3 Super — rápido, recomendado" },
      { value: "openai/gpt-oss-20b", label: "gpt-oss 20B" },
      { value: "nvidia/nemotron-3.5-lightning-30b-a3b", label: "Nemotron 3.5 Lightning" },
      { value: "moonshotai/kimi-k3", label: "Kimi K3 — mais lento" },
    ],
  },
  {
    id: "kilo",
    label: "Kilo Gateway",
    baseUrl: "https://api.kilo.ai/api/gateway",
    keyPlaceholder: "eyJ...",
    models: [
      { value: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra (grátis)" },
      { value: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super (grátis)" },
      { value: "kilo-auto/free", label: "Automático (grátis)" },
    ],
  },
  {
    id: "ollama",
    label: "Ollama Cloud",
    baseUrl: "https://ollama.com/v1",
    keyPlaceholder: "Chave de API",
    models: [
      { value: "gpt-oss:120b", label: "gpt-oss 120B" },
      { value: "nemotron-3-super", label: "Nemotron 3 Super" },
      { value: "gemma4:31b", label: "Gemma 4 31B" },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyPlaceholder: "gsk_...",
    models: [
      { value: "openai/gpt-oss-120b", label: "gpt-oss 120B" },
      { value: "openai/gpt-oss-20b", label: "gpt-oss 20B — mais rápido" },
    ],
  },
  {
    id: "cohere",
    label: "Cohere",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    keyPlaceholder: "Chave de API",
    models: [
      { value: "command-a-plus-05-2026", label: "Command A+" },
      { value: "command-a-03-2025", label: "Command A" },
    ],
  },
  {
    id: "custom",
    label: "Outro compatível com OpenAI",
    baseUrl: null,
    keyPlaceholder: "Chave de API",
    models: [],
  },
];

export const DEFAULT_AI_MODEL = "gpt-4.1-mini";

/**
 * Cadeia gratuita da plataforma (PlatformApp AI_*), usada quando o workspace
 * não tem IA própria ou ela falha. Modelos validados com tool calling.
 */
export const PLATFORM_LLM_APPS = [
  {
    app: "AI_OPENROUTER",
    provider: "openrouter",
    label: "OpenRouter",
    defaultModels: [
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-3.5-lightning:free",
      "google/gemma-4-31b-it:free",
    ],
  },
  {
    app: "AI_NVIDIA",
    provider: "nvidia",
    label: "NVIDIA",
    defaultModels: [
      "nvidia/nemotron-3-super-120b-a12b",
      "nvidia/nemotron-3.5-lightning-30b-a3b",
      "openai/gpt-oss-20b",
      "nvidia/nemotron-3-ultra-550b-a55b",
    ],
  },
  {
    app: "AI_KILO",
    provider: "kilo",
    label: "Kilo",
    defaultModels: [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "poolside/laguna-s-2.1:free",
      "inclusionai/ling-3.1-flash",
      "stepfun/step-3.7-flash:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "kilo-auto/free",
    ],
  },
  {
    app: "AI_OLLAMA",
    provider: "ollama",
    label: "Ollama",
    defaultModels: ["gpt-oss:120b", "nemotron-3-super", "gemma4:31b", "gpt-oss:20b"],
  },
  {
    app: "AI_GROQ",
    provider: "groq",
    label: "Groq",
    defaultModels: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
  },
  {
    app: "AI_COHERE",
    provider: "cohere",
    label: "Cohere",
    defaultModels: ["command-a-plus-05-2026", "command-a-03-2025"],
  },
] as const satisfies ReadonlyArray<{
  app: string;
  provider: AiProviderId;
  label: string;
  defaultModels: readonly string[];
}>;

export type PlatformLlmApp = (typeof PLATFORM_LLM_APPS)[number]["app"];

/** Lista do admin (um por linha) ou a padrão. */
export function parseModelList(raw: unknown, fallback: readonly string[]): string[] {
  const list =
    typeof raw === "string"
      ? raw
          .split(/[\r\n,]+/)
          .map((m) => m.trim())
          .filter(Boolean)
      : [];
  return [...new Set(list.length ? list : fallback)];
}

/** Intercala as listas (1º de cada, 2º de cada…) para não esgotar um provedor inteiro de uma vez. */
export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) if (i < list.length) out.push(list[i]);
  }
  return out;
}

export function findAiProvider(id: unknown): AiProviderDef | null {
  return AI_PROVIDERS.find((p) => p.id === id) ?? null;
}

export type AiConnectionMetadata = {
  provider?: AiProviderId;
  model?: string;
  baseUrl?: string | null;
  keyHint?: string;
  testedAt?: string;
};

export function aiModelLabel(provider: unknown, model: string | undefined | null): string {
  if (!model) return "";
  const def = findAiProvider(provider);
  const known = def?.models.find((m) => m.value === model);
  return known ? known.label.split(" — ")[0] : model;
}
