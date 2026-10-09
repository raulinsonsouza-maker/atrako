import "server-only";
import type OpenAI from "openai";
import { lpFxPromptSection } from "@/lib/criar/lp-fx/catalog";
import { LP_SECTION_KINDS } from "@/lib/criar/lp-library/kinds";
import { classifyLlmFailure, setCooldown } from "./failover";
import { createLlmClient, resolveLlmChain, type LlmCandidate } from "./llm";

/**
 * Designer de landing pages: chamada dedicada à cadeia de modelos (mesmo failover do chat),
 * com saída em blocos delimitados — HTML dentro de JSON quebra fácil em modelos abertos.
 */

export type DesignBrief = {
  negocio: string;
  segmento: string | null;
  objetivo: "leads" | "sales";
  nome: string;
  briefing: string;
  estilo: string | null;
  referencias: string | null;
  cta: string | null;
  corMarca: string | null;
  logoUrl: string | null;
  /** Fotos liberadas (banco ou usuário). A IA só pode usar estas URLs. */
  imagens?: Array<{ rotulo: string; url: string; alt: string; papel: string }> | null;
  /** Vídeos enviados pela pessoa. A IA só pode usar estas URLs. */
  videos?: Array<{ url: string; nome: string }> | null;
  /** Seções da biblioteca, já anonimizadas, para adaptar. */
  referenciasBiblioteca?: string | null;
  produto: { nome: string; precoReais: number | null } | null;
  /** Página real do produto na loja. Fatos de ativo, uso e resultado saem daqui. */
  fichaProduto?: string | null;
  formulario: { nome: string; campos: string[] } | null;
  /** Mensagens do usuário na conversa: fonte de verdade para fatos (o briefing é resumo do assistente). */
  pedidoOriginal?: string | null;
};

export type DesignOutput = {
  html: string;
  css: string;
  fonts: string[];
  theme: { accent?: string; surface?: "light" | "dark" };
  notes: string;
  model: string;
};

export class DesignError extends Error {}

const FIRST_CHUNK_MS = 45_000;
const ATTEMPT_MS = 150_000;
const DEFAULT_BUDGET_MS = 210_000;
const MAX_ATTEMPTS = 4;

/**
 * Página pede modelo grande. O chat do workspace (muitas vezes um modelo rápido)
 * fica depois destes. Versão paga vem antes da grátis do mesmo nível.
 */
const DESIGN_PREFERENCE = [
  /claude|gpt-5|gpt-4\.1(?!-mini)|gemini-2\.5-pro|gemini-3/i,
  /nemotron-3-ultra|ultra-550/i,
  /command-a-plus/i,
  /gpt-oss-120b|gpt-oss:120b/i,
  /gemma-?4|gemma4/i,
  /command-a(?!-plus)/i,
];

export function orderForDesign(candidates: LlmCandidate[]): LlmCandidate[] {
  const rank = (c: LlmCandidate) => {
    const i = DESIGN_PREFERENCE.findIndex((re) => re.test(c.model));
    const tier = i === -1 ? (c.source === "workspace" ? DESIGN_PREFERENCE.length : DESIGN_PREFERENCE.length + 1) : i;
    return tier * 2 + (/:free\b/i.test(c.model) ? 1 : 0);
  };
  return candidates
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map((x) => x.c);
}

function maxTokensFor(c: LlmCandidate) {
  return c.provider === "cohere" ? 8000 : 14000;
}

const SYSTEM = `Você é diretor de arte e copywriter sênior de landing pages de alta conversão no Brasil.
Entrega páginas com cara de agência premium: tipografia forte, hierarquia clara, respiro, ritmo entre seções e copy específica do negócio.

FORMATO DA RESPOSTA (obrigatório, nesta ordem, sem nada fora dos blocos):
===NOTAS===
2 a 4 linhas: conceito visual e por que a estrutura converte.
===FONTES===
Até 2 famílias do Google Fonts, uma por linha, no formato "Nome da Fonte:wght@400;600;700".
===TEMA===
accent=#RRGGBB
surface=light ou dark
===CSS===
CSS completo da página.
===HTML===
Só o conteúdo do <body> (sem <html>, <head>, <body>, <style>, <script>).
===FIM===

REGRAS DE HTML
- HTML semântico (header, main, section, footer), um único <h1> com a promessa principal.
- Proibido: <script>, <form>, <input>, <select>, <textarea>, <iframe>, atributos on*, JavaScript.
- Formulário e checkout são do Atrako. Marque o lugar exato com <atrako-form></atrako-form> (captura) ou <atrako-checkout></atrako-checkout> (venda), dentro de uma <section id="form"> ou <section id="checkout"> com título e argumentos ao redor. A plataforma renderiza ali um card branco de até 520px.
- Botões de CTA são links: <a class="..." href="#form"> ou href="#checkout". Use vários CTAs ao longo da página.
- Imagens: use SOMENTE as URLs da lista IMAGENS (e o logo, se houver). A primeira da lista, se for da pessoa, é a foto principal do hero. O hero precisa de um <img> real com essa URL, dentro de <div class="container"><div class="hero-grid"> texto + foto </div></div>. A grade fica no .hero-grid, nunca no <section> (o section só tem o container). Proporção definida, object-fit: cover, loading="lazy" fora do hero, alt descritivo. Mais 1 a 3 fotos em seções. Proibido: <div class="image"> ou <div class="visual"> vazio. Se a lista vier vazia, não reserve coluna de foto: o hero é tipografia, sem inventar URL.
- Vídeo: use <video controls> somente com as URLs da lista VÍDEOS, em <source src>. Sem autoplay. Se a lista vier vazia, não use <video>.
- Nunca invente depoimentos, números, clientes, prêmios, garantias, ingredientes, ativos, prazos de resultado ("12h", "em 7 dias", "imediato"), selo cruelty-free, "usuárias relatam" ou "oferta especial" / "por apenas" / desconto. Se houver FICHA DO PRODUTO, ativos, benefícios, modo de uso, resultado e FAQ saem só dela. O pedido da pessoa manda no público, no visual e no botão. O preço que a pessoa disse vence o da ficha; não chame de desconto se ela não falou em promoção. Sem prova social real, NÃO crie seção de depoimentos. FAQ só com o que a ficha ou o pedido responde; use <details><summary>. Rodapé sem ano, a menos que o ano esteja no pedido.
- Contato (telefone, e-mail, endereço) só se veio no briefing. Nada de 9999-9999 ou e-mail inventado.
- Estrutura de cada seção: <section class="sec-<tipo> nome" data-section="<tipo>"><div class="container">…</div></section>. Nunca class="container" no próprio <section>. O hero é <section class="sec-hero hero" data-section="hero"> (nunca <header> com o h1).
- Tipos de data-section, um por seção: ${LP_SECTION_KINDS.join(", ")}.
- O CSS de cada seção começa com .sec-<tipo> (ex.: .sec-hero h1). :root, body, .container e botões ficam no CSS base, sem prefixo de seção.
- Se usar uma referência da biblioteca, marque a seção com data-lib="ID" (o id vem na referência). Preencha os {{placeholders}} com a copy deste negócio. Não copie texto de exemplo.
- Oferta: o que o comprador recebe (gravação, material, grupo/comunidade, suporte, certificado, prazos de acesso) só se estiver no pedido. Senão, descreva apenas o que foi informado.

REGRAS DE CSS
- Escreva CSS completo: tipografia (escala com clamp()), cores, espaçamentos, botões com estados :hover e :focus-visible, cards, FAQ, rodapé.
- Comece com variáveis em :root (cores, fontes, raios). Elas são aplicadas só dentro da página automaticamente.
- Container de até 1120px centralizado; seções com padding vertical generoso (clamp(64px, 10vw, 128px)).
- Ritmo visual: alterne o fundo das seções (claro, tom suave do acento, uma seção escura de destaque). Se o pedido for claro, clean ou focado no produto, o hero é fundo claro com a foto do produto — sem fx-aurora, fx-beams ou fx-lamp. Hero em duas colunas só quando houver foto, no .hero-grid, uma coluna no celular. Prefira as classes fx-* do catálogo, no máximo um efeito de texto no título.
- Detalhe de agência: eyebrow (rótulo pequeno em caixa alta acima dos títulos), números grandes nos passos, ícones SVG consistentes, cards com borda fina, CTA com contraste forte.
- Mobile first de verdade: inclua @media (max-width: 640px) e @media (min-width: 900px). Nada de rolagem horizontal.
- Use as fontes de ===FONTES=== em font-family. Sem @import, sem !important. Se a direção visual citar uma fonte (ex.: Roboto), ===FONTES=== é essa fonte, não outra.
- Contraste AA. O accent é a cor da marca informada, sem trocar por verde, roxo ou outra cor.

ESTRUTURA SUGERIDA
Captura: hero com promessa + CTA, problema/dor, benefícios, como funciona (3 passos), seção do formulário, FAQ (4-6 objeções reais), CTA final, rodapé simples.
Venda: hero com promessa + preço/CTA, para quem é, o que você recebe, como funciona, oferta (preço em destaque) + checkout, FAQ, CTA final, rodapé.

COPY
Português do Brasil, direto, específico do negócio e do público. Headline com benefício concreto; subheadline que explica como. Nada genérico do tipo "solução completa".

${lpFxPromptSection()}`;

function briefText(b: DesignBrief): string {
  const lines = [
    `Negócio: ${b.negocio}${b.segmento ? ` (segmento: ${b.segmento})` : ""}`,
    `Página: ${b.nome}`,
    `Objetivo: ${b.objetivo === "leads" ? "captar leads (usar <atrako-form>)" : "vender (usar <atrako-checkout>)"}`,
    b.produto ? `Produto: ${b.produto.nome}${b.produto.precoReais ? ` — R$ ${b.produto.precoReais.toFixed(2).replace(".", ",")}` : ""}` : null,
    b.formulario ? `Formulário "${b.formulario.nome}" pede: ${b.formulario.campos.join(", ")}` : null,
    b.cta ? `Texto do CTA: ${b.cta}` : null,
    b.corMarca ? `Cor da marca: ${b.corMarca}` : null,
    b.logoUrl ? `Logo (pode usar em <img>): ${b.logoUrl}` : null,
    b.imagens?.length
      ? `IMAGENS (só estas URLs):\n${b.imagens.map((img) => `${img.rotulo} (papel ${img.papel}): ${img.url} — alt: ${img.alt}`).join("\n")}`
      : "IMAGENS: nenhuma. Não use <img> além do logo.",
    b.videos?.length
      ? `VÍDEOS (só estas URLs, em <video controls><source src>):\n${b.videos.map((v) => `${v.nome}: ${v.url}`).join("\n")}`
      : "VÍDEOS: nenhum. Não use <video>.",
    b.referenciasBiblioteca ? `REFERÊNCIAS DA BIBLIOTECA (adapte a estrutura; não copie conteúdo):\n${b.referenciasBiblioteca}` : null,
    b.estilo ? `Direção visual pedida: ${b.estilo}` : null,
    b.referencias ? `Referências pesquisadas:\n${b.referencias}` : null,
    b.pedidoOriginal
      ? `Pedido da pessoa (público, visual e botão; também é fato):\n${b.pedidoOriginal}`
      : null,
    b.fichaProduto
      ? `FICHA DO PRODUTO (página real da loja; ativos, modo de uso, benefícios e FAQ só daqui. O briefing pode ter inventado ingrediente: descarte o que não estiver nesta ficha):\n${b.fichaProduto}`
      : null,
    b.pedidoOriginal
      ? `Briefing do assistente (use para tom e estrutura; não acrescente ativo, prazo ou oferta que não estejam na ficha nem no pedido):\n${b.briefing}`
      : `Briefing do usuário:\n${b.briefing}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function parseDesignOutput(text: string): Omit<DesignOutput, "model"> | null {
  const block = (name: string) => {
    const re = new RegExp(`===${name}===\\s*([\\s\\S]*?)(?====[A-Z]+===|$)`);
    return text.match(re)?.[1]?.trim() ?? "";
  };
  let html = block("HTML");
  let css = block("CSS");
  if (!html) {
    html = text.match(/```html\s*([\s\S]*?)```/i)?.[1]?.trim() ?? "";
    css = css || (text.match(/```css\s*([\s\S]*?)```/i)?.[1]?.trim() ?? "");
  }
  html = html.replace(/^```(?:html)?\s*|```\s*$/g, "").trim();
  css = css.replace(/^```(?:css)?\s*|```\s*$/g, "").trim();
  if (!/<(section|header|main|div|h1)\b/i.test(html)) return null;
  const theme = block("TEMA");
  const accent = theme.match(/accent\s*=\s*(#[0-9a-f]{6})/i)?.[1];
  const surface = /surface\s*=\s*dark/i.test(theme) ? "dark" : "light";
  const fonts = block("FONTES")
    .split("\n")
    .map((l) => l.replace(/^[-*\d.\s]+/, "").replace(/["'`]/g, "").trim())
    .filter(Boolean)
    .slice(0, 2);
  return { html, css, fonts, theme: { ...(accent ? { accent } : {}), surface }, notes: block("NOTAS").slice(0, 600) };
}

async function streamCompletion(
  client: OpenAI,
  c: LlmCandidate,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  signal: AbortSignal,
  onText: (chars: number, text: string) => void,
): Promise<string> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort(signal.reason);
  signal.addEventListener("abort", onAbort, { once: true });
  let firstTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => ctrl.abort(new Error("sem primeiro chunk")), FIRST_CHUNK_MS);
  const attemptTimer = setTimeout(() => ctrl.abort(new Error("tempo esgotado")), ATTEMPT_MS);
  try {
    const stream = await client.chat.completions.create(
      { model: c.model, messages, max_tokens: maxTokensFor(c), temperature: 0.7, stream: true },
      { signal: ctrl.signal },
    );
    let text = "";
    for await (const chunk of stream) {
      if (firstTimer) {
        clearTimeout(firstTimer);
        firstTimer = null;
      }
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        text += delta;
        onText(text.length, text);
      }
    }
    return text;
  } finally {
    if (firstTimer) clearTimeout(firstTimer);
    clearTimeout(attemptTimer);
    signal.removeEventListener("abort", onAbort);
  }
}

export type DesignRequest =
  | { mode: "create"; brief: DesignBrief }
  | { mode: "edit"; brief: DesignBrief; current: { html: string; css: string }; instructions: string }
  | { mode: "fix"; brief: DesignBrief; current: { html: string; css: string }; issues: string[] };

function messagesFor(req: DesignRequest) {
  const base = [{ role: "system" as const, content: SYSTEM }];
  if (req.mode === "create") {
    return [...base, { role: "user" as const, content: `Crie a landing page.\n\n${briefText(req.brief)}` }];
  }
  const current = `===CSS===\n${req.current.css}\n===HTML===\n${req.current.html}\n===FIM===`;
  const ask =
    req.mode === "edit"
      ? `Edite a página abaixo aplicando SÓ estas mudanças, preservando todo o resto:\n${req.instructions}`
      : `A página abaixo tem problemas. Corrija todos e mantenha o resto:\n- ${req.issues.join("\n- ")}`;
  return [
    ...base,
    {
      role: "user" as const,
      content: `${ask}\n\nContexto do negócio:\n${briefText(req.brief)}\n\nPágina atual:\n${current}\n\nDevolva a página COMPLETA no formato combinado.`,
    },
  ];
}

export async function runDesigner(
  clienteId: string,
  req: DesignRequest,
  opts: { signal?: AbortSignal; onProgress?: (label: string) => void; budgetMs?: number; candidates?: LlmCandidate[] } = {},
): Promise<DesignOutput> {
  const chain = opts.candidates ?? orderForDesign((await resolveLlmChain(clienteId)).candidates);
  if (!chain.length) throw new DesignError("Nenhum modelo de IA disponível agora.");
  const deadline = Date.now() + (opts.budgetMs ?? DEFAULT_BUDGET_MS);
  const outer = opts.signal ?? new AbortController().signal;
  const messages = messagesFor(req);
  let lastError: unknown = null;

  for (const c of chain.slice(0, MAX_ATTEMPTS)) {
    if (outer.aborted) throw outer.reason ?? new Error("cancelado");
    const remaining = deadline - Date.now();
    if (remaining < 20_000) break;
    const signal = AbortSignal.any([outer, AbortSignal.timeout(remaining)]);
    let stage = "";
    try {
      const text = await streamCompletion(createLlmClient(c), c, messages, signal, (chars, t) => {
        const next = t.includes("===HTML===") ? "html" : t.includes("===CSS===") ? "css" : "plan";
        if (next !== stage) {
          stage = next;
          opts.onProgress?.(
            next === "html" ? "Escrevendo as seções" : next === "css" ? "Definindo o visual" : "Planejando a página",
          );
        }
        void chars;
      });
      const parsed = parseDesignOutput(text);
      if (!parsed) {
        lastError = new DesignError(`Modelo ${c.model} devolveu formato inválido`);
        continue;
      }
      return { ...parsed, model: c.model };
    } catch (error) {
      if (outer.aborted) throw error;
      lastError = error;
      const failure = classifyLlmFailure(error);
      if (failure.status !== 400 && failure.status !== 413 && failure.status !== 422) {
        void setCooldown(c.key, failure).catch(() => undefined);
      }
      console.warn("[atrako-designer]", c.key, failure.reason, error instanceof Error ? error.message.slice(0, 160) : "");
    }
  }
  throw new DesignError(
    lastError instanceof DesignError ? lastError.message : "Os modelos de IA não conseguiram gerar a página agora.",
  );
}
