/**
 * Antes de criar a página, o agente precisa ter ouvido a pessoa e lido o plano de volta.
 * Isto não cria nada: só diz se já dá para montar ou o que ainda falar.
 */

export type LpBriefInput = {
  briefing: string;
  publico: string;
  estilo: string;
  cta: string;
  goal: "leads" | "sales";
  precoReais: number | null;
  temProduto: boolean;
  /** Mensagem atual da pessoa, não o histórico inteiro. */
  lastUserMessage: string;
  /** Nomes dos arquivos desta conversa, para o plano citar. */
  anexos?: string[];
};

export type LpBriefGate =
  | { ok: true }
  | { ok: false; falar: string };

const SKIP =
  /sem perguntar|pode montar agora|j[aá] pode criar|n[aã]o precisa perguntar|pegue tudo|de uma vez|pegue as informa|pegue no site|pegue do site/i;
const AGREE =
  /^(sim|ok|pode|bora|fecha|perfeito|isso|confirmo|manda|t[aá]|beleza|fechado|pode sim)\b/i;
const AGREE_IN =
  /\b(pode montar|pode criar|pode fazer a p[aá]gina|pode seguir|manda ver|[eé] isso|t[aá] bom assim|pode ir)\b/i;

function agreed(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (SKIP.test(text)) return true;
  if (text.length <= 80 && (AGREE.test(text) || AGREE_IN.test(text))) return true;
  return false;
}

function plano(input: LpBriefInput): string {
  const fim = input.goal === "sales" ? "vender" : "receber contatos";
  const preco =
    input.goal === "sales" && input.precoReais
      ? ` Preço: R$ ${input.precoReais.toFixed(2).replace(".", ",")}.`
      : "";
  return [
    "Antes de montar, leia este plano para a pessoa, em poucas frases e sem jargão (não diga briefing, CTA, hero nem LP):",
    `A página é para ${fim}. Oferta: ${input.briefing.trim()}`,
    `Para quem: ${input.publico.trim()}.${preco}`,
    `Visual: ${input.estilo.trim()}.`,
    `O botão diz: ${input.cta.trim() || "a pessoa segue para o próximo passo"}.`,
    input.anexos?.length ? `Vou usar o que você enviou: ${input.anexos.join(", ")}.` : null,
    'Termine com: "Posso montar assim?"',
    "Não chame criar_landing_page de novo nesta resposta. Espere a pessoa concordar.",
  ].filter((line): line is string => Boolean(line)).join("\n");
}

/** Pronto para criar, ou o texto que o agente deve falar antes. */
export function assessLpBrief(input: LpBriefInput): LpBriefGate {
  const faltam: string[] = [];
  if (input.briefing.trim().length < 20) {
    faltam.push("O que você quer oferecer nessa página? Me conta em uma frase.");
  }
  if (input.publico.trim().length < 3) {
    faltam.push("Para quem é essa página?");
  }
  if (input.goal === "sales" && !input.temProduto && !(input.precoReais && input.precoReais > 0)) {
    faltam.push("Qual é o preço?");
  }
  if (input.estilo.trim().length < 3) {
    faltam.push(
      "Como você quer o visual? Pode ser simples: clara e tranquila, escura e séria, ou colorida. Se tiver uma cor ou um site de referência, manda.",
    );
  }
  if (input.cta.trim().length < 2) {
    faltam.push("O que a pessoa deve fazer no final? Por exemplo: pedir um orçamento, chamar no WhatsApp ou comprar.");
  }
  if (faltam.length) {
    return {
      ok: false,
      falar: [
        "Ainda não monte a página. Pergunte só o que falta, numa mensagem só, do jeito que está escrito:",
        ...faltam.map((q) => `- ${q}`),
        "Se a pessoa disser que tanto faz o visual, use claro e simples. Não invente oferta, preço nem público.",
      ].join("\n"),
    };
  }
  if (!agreed(input.lastUserMessage)) return { ok: false, falar: plano(input) };
  return { ok: true };
}
