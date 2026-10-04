/**
 * Sugestão de copy (assunto, preheader, blocos de e-mail e texto de WhatsApp) a partir do briefing.
 * A sugestão vai para o rascunho — nunca é enviada sem revisão humana.
 */

import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { loadEmailTheme } from "@/lib/flows/theme";
import { sanitizeEmailContent } from "@/lib/flows/render-email";
import type { CampaignBriefing } from "@/lib/flows/campaigns";
import type { EmailContent } from "@/lib/flows/types";

const TONE_HINT: Record<string, string> = {
  proximo: "próximo e caloroso, tratando por você, frases curtas",
  neutro: "claro e direto, cordial, sem gírias",
  formal: "formal e elegante, sem emojis",
};

export type AiCopySuggestion = {
  subjects: string[];
  email: EmailContent;
  whatsapp: string;
};

export async function suggestCampaignCopy(
  workspaceId: string,
  input: { name: string; briefing: CampaignBriefing; couponCode?: string | null },
): Promise<AiCopySuggestion> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("IA indisponível: OPENAI_API_KEY não configurada");
  const { theme, brand } = await loadEmailTheme(workspaceId, { draft: true });
  const ws = await prisma.cliente.findUnique({ where: { id: workspaceId }, select: { nome: true } });
  const b = input.briefing;
  const client = new OpenAI({ apiKey: key });
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const system = [
    "Você é redator de CRM para e-commerce brasileiro.",
    `Tom de voz: ${TONE_HINT[b.tone || theme.tone] ?? b.tone ?? TONE_HINT.proximo}.`,
    "Escreva em português do Brasil. Nada de promessas falsas, urgência inventada ou caixa alta.",
    "Variáveis disponíveis: {{primeiro_nome}}, {{loja}}, {{cupom}}. Use {{primeiro_nome}} na saudação.",
    "Responda SOMENTE JSON válido no formato:",
    '{"subjects":["até 5 assuntos com no máximo 50 caracteres"],"preheader":"até 90 caracteres","heading":"título curto","paragraphs":["2 a 3 parágrafos curtos"],"button":"texto do botão até 24 caracteres","whatsapp":"mensagem de até 400 caracteres com {{primeiro_nome}}"}',
  ].join("\n");
  const user = [
    `Loja: ${brand.storeName || ws?.nome || "Loja"}`,
    `Campanha: ${input.name}`,
    b.objective ? `Objetivo: ${b.objective}` : "",
    b.offer ? `Oferta: ${b.offer}` : "",
    input.couponCode ? `Cupom: ${input.couponCode}` : "",
    b.audienceNote ? `Público: ${b.audienceNote}` : "",
    b.products?.length ? `Produtos em destaque: ${b.products.slice(0, 8).join(", ")}` : "",
    b.references ? `Referências: ${b.references}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await client.chat.completions.create({
    model,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const raw = res.choices[0]?.message?.content ?? "{}";
  let j: {
    subjects?: unknown;
    preheader?: unknown;
    heading?: unknown;
    paragraphs?: unknown;
    button?: unknown;
    whatsapp?: unknown;
  };
  try {
    j = JSON.parse(raw);
  } catch {
    throw new Error("A IA não retornou uma sugestão válida — tente de novo");
  }
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const subjects = Array.isArray(j.subjects) ? j.subjects.map((x) => s(x, 80)).filter(Boolean).slice(0, 5) : [];
  const paragraphs = Array.isArray(j.paragraphs) ? j.paragraphs.map((x) => s(x, 800)).filter(Boolean).slice(0, 4) : [];
  const email = sanitizeEmailContent({
    subject: subjects[0] ?? input.name,
    preheader: s(j.preheader, 120),
    blocks: [
      { type: "heading", text: s(j.heading, 120) || input.name },
      ...paragraphs.map((text) => ({ type: "text", text })),
      ...(input.couponCode ? [{ type: "coupon" }] : []),
      { type: "recommendations", title: "Selecionamos para você", limit: 4 },
      { type: "button", label: s(j.button, 40) || "Ver na loja" },
      { type: "signature" },
    ],
  });
  return { subjects, email, whatsapp: s(j.whatsapp, 1000) };
}
