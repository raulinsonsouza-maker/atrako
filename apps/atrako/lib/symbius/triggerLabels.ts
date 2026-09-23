const TRIGGER_LABELS: Record<string, string> = {
  comment_keyword:
    "O usuário deixa um comentário em uma publicação ou Reel específico do Instagram",
  keyword: "O usuário envia uma mensagem com palavra-chave no Direct",
  welcome: "O usuário envia a primeira mensagem / boas-vindas",
  story_reply: "O usuário responde a um Story do Instagram",
  postback: "O usuário clica em um botão (postback)",
  live_comment: "Comentário em Live do Instagram",
  manual: "Disparo manual",
  tag_entry: "Entrada por tag (sequência)",
  ref: "Link de referência",
  unset: "Gatilho ainda não configurado",
};

export function triggerLabel(triggerType: string): string {
  return TRIGGER_LABELS[triggerType] ?? triggerType;
}

/** Gatilho curto para badges/filtros */
export function triggerShortLabel(triggerType: string): string {
  const short: Record<string, string> = {
    comment_keyword: "Comentário",
    keyword: "Palavra-chave",
    welcome: "Boas-vindas",
    story_reply: "Story",
    postback: "Postback",
    story_mention: "Menção ao Story",
    live_comment: "Live",
    manual: "Manual",
    tag_entry: "Sequência",
    ref: "Referência",
  };
  return short[triggerType] ?? triggerType;
}

export function formatRelativePt(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `há ${days}d`;
  return d.toLocaleDateString("pt-BR");
}
