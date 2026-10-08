/**
 * Catálogo dos efeitos da LP v3. A IA só pode usar o que está aqui:
 * classes fx-* (CSS) e data-fx (hidratados no cliente).
 */

export type LpFx = {
  id: string;
  kind: "css" | "react";
  label: string;
  use: string;
  snippet: string;
  /** Classe ou data-fx conta como fundo animado (no máximo 1 por página). */
  background?: boolean;
  /** Efeito de texto: no máximo 1 por título. */
  text?: boolean;
  maxPerPage?: number;
};

export const LP_FX_LIMITS = {
  maxPerPage: 5,
  maxBackground: 1,
  maxTextPerHeading: 1,
};

export const LP_FX: LpFx[] = [
  {
    id: "fx-aurora",
    kind: "css",
    background: true,
    label: "Aurora",
    use: "Fundo do hero.",
    snippet: '<section class="sec-hero hero fx-aurora" data-section="hero">',
  },
  {
    id: "fx-grid-bg",
    kind: "css",
    background: true,
    label: "Grade",
    use: "Fundo técnico do hero, alternativa à aurora.",
    snippet: '<div class="fx-grid-bg">…</div>',
  },
  {
    id: "fx-dot-bg",
    kind: "css",
    background: true,
    label: "Pontos",
    use: "Fundo discreto de uma seção.",
    snippet: '<section class="sec-diferenciais fx-dot-bg" data-section="diferenciais">',
  },
  {
    id: "fx-spotlight",
    kind: "css",
    background: true,
    label: "Feixe",
    use: "Feixe de luz no hero escuro.",
    snippet: '<div class="fx-spotlight" aria-hidden="true"></div>',
  },
  {
    id: "fx-beams",
    kind: "css",
    background: true,
    label: "Feixes",
    use: "Linhas de luz no fundo do hero. O SVG abaixo é fixo.",
    snippet:
      '<svg class="fx-beams" viewBox="0 0 400 200" aria-hidden="true"><path d="M0 150 C 80 40, 160 180, 400 30"/></svg>',
  },
  {
    id: "fx-bento",
    kind: "css",
    label: "Bento",
    use: "Grade de benefícios com um item em destaque.",
    snippet: '<div class="fx-bento"><article class="fx-bento-item fx-bento-wide">…</article><article class="fx-bento-item">…</article></div>',
  },
  {
    id: "fx-moving-border",
    kind: "css",
    label: "Borda em movimento",
    use: "Só no CTA principal.",
    snippet: '<a class="fx-moving-border" href="#form">Quero</a>',
    maxPerPage: 1,
  },
  {
    id: "fx-glow-card",
    kind: "css",
    label: "Card com brilho",
    use: "Cards de benefício ou de passo.",
    snippet: '<article class="fx-glow-card">…</article>',
  },
  {
    id: "fx-lamp",
    kind: "css",
    background: true,
    label: "Lâmpada",
    use: "Título de uma seção escura.",
    snippet: '<div class="fx-lamp"><h2>…</h2></div>',
  },
  {
    id: "fx-gradient-text",
    kind: "css",
    text: true,
    label: "Texto em degradê",
    use: "Uma palavra da headline.",
    snippet: '<span class="fx-gradient-text">crescer</span>',
  },
  {
    id: "fx-shimmer-text",
    kind: "css",
    text: true,
    label: "Texto com brilho",
    use: "Uma palavra da headline, no lugar do degradê.",
    snippet: '<span class="fx-shimmer-text">resultado</span>',
  },
  {
    id: "fx-reveal",
    kind: "css",
    label: "Entrada ao rolar",
    use: "Seções abaixo do hero.",
    snippet: '<section class="sec-dor fx-reveal" data-section="dor">',
  },
  {
    id: "fx-marquee",
    kind: "css",
    label: "Faixa (CSS)",
    use: "Faixa de diferenciais. Duplique os itens; a cópia leva aria-hidden.",
    snippet:
      '<div class="fx-marquee"><div class="fx-marquee-track"><span>Item</span><span aria-hidden="true">Item</span></div></div>',
  },
  {
    id: "text-rotate",
    kind: "react",
    text: true,
    label: "Palavra rotativa",
    use: "Uma palavra da headline. data-words separa as opções com |.",
    snippet: '<span data-fx="text-rotate" data-words="vender mais|captar leads|crescer">vender mais</span>',
    maxPerPage: 1,
  },
  {
    id: "cut-reveal",
    kind: "react",
    text: true,
    label: "Revelação em corte",
    use: "Headline ou título de seção.",
    snippet: '<h1 data-fx="cut-reveal">Promessa principal</h1>',
  },
  {
    id: "scramble",
    kind: "react",
    text: true,
    label: "Embaralhamento",
    use: "Só no eyebrow (rótulo curto acima do título).",
    snippet: '<p class="eyebrow" data-fx="scramble">Para clínicas</p>',
    maxPerPage: 1,
  },
  {
    id: "typewriter",
    kind: "react",
    text: true,
    label: "Máquina de escrever",
    use: "Subtítulo curto.",
    snippet: '<p data-fx="typewriter">Como funciona na prática</p>',
    maxPerPage: 1,
  },
  {
    id: "counter",
    kind: "react",
    label: "Contador",
    use: "Número que o briefing informou. Nunca invente o número. data-value é o valor final.",
    snippet: '<span data-fx="counter" data-value="1200">1.200</span>',
  },
  {
    id: "highlight",
    kind: "react",
    text: true,
    label: "Grifo",
    use: "Uma frase curta de dor ou benefício.",
    snippet: '<span data-fx="highlight">agenda lotada</span>',
    maxPerPage: 2,
  },
  {
    id: "letter-swap",
    kind: "react",
    label: "Troca de letras",
    use: "Texto do botão de CTA principal.",
    snippet: '<a data-fx="letter-swap" href="#form">Quero começar</a>',
    maxPerPage: 1,
  },
  {
    id: "marquee",
    kind: "react",
    label: "Faixa",
    use: "Faixa de diferenciais que reage à rolagem. Prefira este ao fx-marquee.",
    snippet: '<div data-fx="marquee"><span>Sem contrato</span><span>Suporte humano</span></div>',
    maxPerPage: 1,
  },
  {
    id: "stack",
    kind: "react",
    label: "Cards empilhados",
    use: "Como funciona ou benefícios. Cada card leva data-fx-card.",
    snippet: '<div data-fx="stack"><article data-fx-card>1</article><article data-fx-card>2</article></div>',
    maxPerPage: 1,
  },
  {
    id: "float",
    kind: "react",
    label: "Flutuação",
    use: "Foto ou mockup do hero.",
    snippet: '<img data-fx="float" src="IMG1" alt="…">',
    maxPerPage: 1,
  },
  {
    id: "text-generate",
    kind: "react",
    text: true,
    label: "Texto palavra a palavra",
    use: "Subtítulo do hero.",
    snippet: '<p data-fx="text-generate">A frase aparece palavra por palavra.</p>',
    maxPerPage: 1,
  },
  {
    id: "tilt",
    kind: "react",
    label: "Inclinação",
    use: "Card visual do hero, no desktop.",
    snippet: '<article data-fx="tilt" class="fx-glow-card">…</article>',
    maxPerPage: 1,
  },
  {
    id: "sparkles",
    kind: "react",
    label: "Faíscas",
    use: "Fundo de um título curto. Não use em parágrafo.",
    snippet: '<h2 data-fx="sparkles">O que muda</h2>',
    maxPerPage: 1,
  },
  {
    id: "spotlight-follow",
    kind: "react",
    label: "Luz que segue",
    use: "Um card de destaque.",
    snippet: '<article data-fx="spotlight-follow" class="fx-glow-card">…</article>',
    maxPerPage: 1,
  },
  {
    id: "tracing-beam",
    kind: "react",
    label: "Linha de progresso",
    use: "Seção como funciona.",
    snippet: '<div data-fx="tracing-beam"><article>Passo</article></div>',
    maxPerPage: 1,
  },
  {
    id: "timeline",
    kind: "react",
    label: "Linha do tempo",
    use: "Passos em sequência.",
    snippet: '<ol data-fx="timeline"><li>Passo 1</li><li>Passo 2</li></ol>',
    maxPerPage: 1,
  },
  {
    id: "reveal",
    kind: "react",
    label: "Revelar ao rolar",
    use: "Fallback do fx-reveal quando a seção precisa de JS.",
    snippet: '<section data-fx="reveal" data-section="faq" class="sec-faq">',
  },
];

export const LP_FX_IDS = new Set(LP_FX.filter((fx) => fx.kind === "react").map((fx) => fx.id));

const BY_ID = new Map(LP_FX.map((fx) => [fx.id, fx]));

export function lpFxById(id: string): LpFx | undefined {
  return BY_ID.get(id);
}

export function lpFxPromptSection(): string {
  const lines = LP_FX.map((fx) => `- ${fx.label} (${fx.id}): ${fx.use} Exemplo: ${fx.snippet}`);
  return `EFEITOS PREMIUM
Use os efeitos abaixo. Não recrie aurora, grade, bento, faixa, brilho ou animação de texto à mão.
O efeito serve à hierarquia: no máximo 1 fundo animado no hero, 1 efeito de texto por título e de 3 a 5 efeitos na página. Sem efeito em parágrafo longo.
Combinação sugerida no hero: data-fx="text-rotate" na headline, data-fx="scramble" no eyebrow, data-fx="letter-swap" no CTA e fundo fx-aurora ou fx-grid-bg.
${lines.join("\n")}`;
}
