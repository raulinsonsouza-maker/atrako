/**
 * Classificação de origem: assistentes de IA, buscadores e robôs (crawlers).
 * Puro — usado no render do guia, no beacon da LP e na atribuição de canal do lead.
 */

export type AiSource = "chatgpt" | "perplexity" | "claude" | "gemini" | "copilot" | "meta_ai" | "deepseek" | "grok";

export const AI_SOURCE_LABEL: Record<AiSource, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  claude: "Claude",
  gemini: "Gemini",
  copilot: "Copilot",
  meta_ai: "Meta AI",
  deepseek: "DeepSeek",
  grok: "Grok",
};

const AI_PATTERNS: [RegExp, AiSource][] = [
  [/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$|(^|\.)openai\.com$|^chatgpt$/, "chatgpt"],
  [/(^|\.)perplexity\.ai$|^perplexity$/, "perplexity"],
  [/(^|\.)claude\.ai$|(^|\.)anthropic\.com$|^claude$/, "claude"],
  [/(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$|^gemini$/, "gemini"],
  [/(^|\.)copilot\.microsoft\.com$|(^|\.)copilot\.cloud\.microsoft$|^copilot$/, "copilot"],
  [/(^|\.)meta\.ai$/, "meta_ai"],
  [/(^|\.)deepseek\.com$/, "deepseek"],
  [/(^|\.)grok\.com$|(^|\.)x\.ai$/, "grok"],
];

const SEARCH_PATTERNS: [RegExp, string][] = [
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)search\.yahoo\.com$|(^|\.)yahoo\.com$/, "yahoo"],
  [/(^|\.)ecosia\.org$/, "ecosia"],
  [/(^|\.)yandex\.[a-z]+$/, "yandex"],
  [/(^|\.)search\.brave\.com$/, "brave"],
];

function hostOf(value: string | null | undefined): string {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return "";
  try {
    return new URL(v.includes("://") ? v : `https://${v}`).hostname.replace(/^www\./, "");
  } catch {
    return v.replace(/^www\./, "");
  }
}

/** IA de origem pelo referrer ou pelo `utm_source` (o ChatGPT acrescenta `utm_source=chatgpt.com` nos links). */
export function aiSourceOf(referrer?: string | null, utmSource?: string | null): AiSource | null {
  for (const candidate of [hostOf(utmSource), hostOf(referrer)]) {
    if (!candidate) continue;
    const hit = AI_PATTERNS.find(([re]) => re.test(candidate));
    if (hit) return hit[1];
  }
  return null;
}

export function searchSourceOf(referrer?: string | null): string | null {
  const h = hostOf(referrer);
  if (!h) return null;
  return SEARCH_PATTERNS.find(([re]) => re.test(h))?.[1] ?? null;
}

/**
 * training = coleta para treino · search = indexação da busca da IA/buscador ·
 * user = acesso disparado agora por uma pergunta de alguém (sinal mais próximo de lead).
 */
export type BotType = "training" | "search" | "user";

const BOTS: [RegExp, string, BotType][] = [
  [/ChatGPT-User/i, "chatgpt-user", "user"],
  [/OAI-SearchBot/i, "oai-searchbot", "search"],
  [/GPTBot/i, "gptbot", "training"],
  [/Claude-User/i, "claude-user", "user"],
  [/Claude-SearchBot/i, "claude-searchbot", "search"],
  [/ClaudeBot|anthropic-ai|Claude-Web/i, "claudebot", "training"],
  [/Perplexity-User/i, "perplexity-user", "user"],
  [/PerplexityBot/i, "perplexitybot", "search"],
  [/Google-Extended/i, "google-extended", "training"],
  [/Googlebot|Google-InspectionTool|GoogleOther/i, "googlebot", "search"],
  [/bingbot|BingPreview/i, "bingbot", "search"],
  [/Applebot-Extended/i, "applebot-extended", "training"],
  [/Applebot/i, "applebot", "search"],
  [/meta-externalagent|FacebookBot/i, "meta-ai", "training"],
  [/meta-externalfetcher/i, "meta-ai-user", "user"],
  [/DuckAssistBot/i, "duckassist", "user"],
  [/Amazonbot/i, "amazonbot", "training"],
  [/Bytespider/i, "bytespider", "training"],
  [/CCBot/i, "ccbot", "training"],
  [/cohere-ai|cohere-training/i, "cohere", "training"],
  [/MistralAI-User/i, "mistral-user", "user"],
  [/YandexBot/i, "yandexbot", "search"],
  [/DuckDuckBot/i, "duckduckbot", "search"],
];

export function botOf(userAgent?: string | null): { source: string; botType: BotType } | null {
  const ua = userAgent ?? "";
  if (!ua) return null;
  const hit = BOTS.find(([re]) => re.test(ua));
  return hit ? { source: hit[1], botType: hit[2] } : null;
}

/** Robôs de IA/busca que o robots.txt libera explicitamente. */
export const ALLOWED_AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Googlebot",
  "Bingbot",
  "Applebot",
  "Applebot-Extended",
  "DuckAssistBot",
  "meta-externalagent",
];

export type VisitKind = "crawler" | "ai_referral" | "search" | "other";

/** Classifica um acesso. `null` quando é navegação interna/direta (não vale registrar). */
export function classifyVisit(input: {
  userAgent?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  ownHost?: string | null;
}): { kind: VisitKind; source: string; botType?: BotType } | null {
  const bot = botOf(input.userAgent);
  if (bot) return { kind: "crawler", source: bot.source, botType: bot.botType };
  const ai = aiSourceOf(input.referrer, input.utmSource);
  if (ai) return { kind: "ai_referral", source: ai };
  const search = searchSourceOf(input.referrer);
  if (search) return { kind: "search", source: search };
  const ref = hostOf(input.referrer);
  const own = (input.ownHost ?? "").replace(/^www\./, "");
  if (ref && ref !== own && !ref.endsWith(".localhost") && ref !== "localhost") {
    return { kind: "other", source: ref.slice(0, 40) };
  }
  return null;
}
