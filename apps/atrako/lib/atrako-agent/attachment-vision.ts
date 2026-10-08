import "server-only";
import type OpenAI from "openai";
import { createLlmClient, resolveLlmChain } from "./llm";

const ASK = "Descreva a imagem em uma frase, em português, sem inventar texto que não esteja nela.";

/** Primeiro modelo da cadeia que aceite imagem. Os outros seguem se este recusar. */
export async function describeImages(clienteId: string, urls: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const https = urls.filter((url) => url.startsWith("https://")).slice(0, 2);
  if (!https.length) return out;
  const chain = await resolveLlmChain(clienteId).catch(() => null);
  if (!chain?.candidates.length) return out;

  for (const url of https) {
    for (const candidate of chain.candidates.slice(0, 2)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      try {
        const res = await createLlmClient(candidate).chat.completions.create(
          {
            model: candidate.model,
            max_tokens: 80,
            temperature: 0.2,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: ASK },
                  { type: "image_url", image_url: { url } },
                ],
              },
            ],
          } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
          { signal: controller.signal },
        );
        const text = res.choices?.[0]?.message?.content?.trim();
        if (text) {
          out.set(url, text.slice(0, 240));
          break;
        }
      } catch {
        // este modelo não vê imagem — tenta o próximo
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return out;
}
