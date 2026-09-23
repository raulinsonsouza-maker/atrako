import {
  ATRAKO_GREETING,
  ATRAKO_STRUCTURE_MAP,
  atrakoOpeningSuggestions,
  humanizeToolResponse,
} from "@atrako/agent";

export { ATRAKO_GREETING, atrakoOpeningSuggestions, humanizeToolResponse };

export function structureAwareReplyFromQuestion(question: string): string | null {
  const normalized = question.toLocaleLowerCase();
  if (
    !/estrutura|módulos|modulos|o que você (sabe|conhece)|como funciona o atrako|o que você faz|quem é você/.test(
      normalized,
    )
  ) {
    return null;
  }
  const modules = ATRAKO_STRUCTURE_MAP.modules
    .map((m) => `• ${m.label} — ${m.knows}`)
    .join("\n");
  return [
    ATRAKO_GREETING,
    "",
    "Conheço a operação inteira — da mídia até a receita.",
    "",
    "Módulos:",
    modules,
    "",
    "Me diga o que quer vender mais ou onde a jornada está travando.",
  ].join("\n");
}
