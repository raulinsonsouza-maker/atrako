/** Saudação pura. Não passa pelo modelo — senão ele abre o panorama do negócio. */

const REPLIES: Record<string, string> = {
  oi: "Olá. Em que posso ajudar?",
  ola: "Olá. Em que posso ajudar?",
  opa: "Olá. Em que posso ajudar?",
  hey: "Olá. Em que posso ajudar?",
  hello: "Olá. Em que posso ajudar?",
  hi: "Olá. Em que posso ajudar?",
  fala: "Olá. Em que posso ajudar?",
  salve: "Olá. Em que posso ajudar?",
  "e ai": "Olá. Em que posso ajudar?",
  "bom dia": "Bom dia. Em que posso ajudar?",
  "boa tarde": "Boa tarde. Em que posso ajudar?",
  "boa noite": "Boa noite. Em que posso ajudar?",
  "tudo bem": "Tudo bem. Em que posso ajudar?",
  "oi tudo bem": "Olá. Em que posso ajudar?",
  "ola tudo bem": "Olá. Em que posso ajudar?",
  "boa noite tudo bem": "Boa noite. Em que posso ajudar?",
  "bom dia tudo bem": "Bom dia. Em que posso ajudar?",
  "boa tarde tudo bem": "Boa tarde. Em que posso ajudar?",
};

export function smallTalkReply(text: string): string | null {
  const t = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[!?.…,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return REPLIES[t] ?? null;
}
