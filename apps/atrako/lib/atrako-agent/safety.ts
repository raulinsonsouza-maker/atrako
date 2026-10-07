/**
 * Proteções do Atrako: dado pessoal nunca vai em claro para a LLM.
 * E-mails/telefones digitados viram tokens (`[contato#1]`) que só as
 * ferramentas sabem resolver; documentos (CPF/cartão) são removidos.
 */

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CARD = /\b(?:\d[ -]?){13,19}\b/g;
const PHONE = /(?<![\d#])(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}(?!\d)/g;

export type PiiVault = Map<string, string>;

export function createPiiVault(): PiiVault {
  return new Map();
}

function tokenFor(vault: PiiVault, value: string): string {
  for (const [token, v] of vault) if (v === value) return token;
  const token = `[contato#${vault.size + 1}]`;
  vault.set(token, value);
  return token;
}

/** Texto do usuário → texto seguro para a LLM. */
export function protectUserText(text: string, vault: PiiVault): { text: string; redacted: boolean } {
  let redacted = false;
  let out = text.replace(CPF, () => {
    redacted = true;
    return "[documento removido]";
  });
  out = out.replace(EMAIL, (m) => {
    redacted = true;
    return tokenFor(vault, m.toLowerCase());
  });
  out = out.replace(PHONE, (m) => {
    if (m.replace(/\D/g, "").length < 10) return m;
    redacted = true;
    return tokenFor(vault, m.replace(/\D/g, ""));
  });
  out = out.replace(CARD, (m) => {
    if (m.replace(/\D/g, "").length < 13) return m;
    redacted = true;
    return "[cartão removido]";
  });
  return { text: out, redacted };
}

/** Argumento vindo da LLM → valor real (resolve `[contato#N]`). */
export function revealToken(value: string, vault: PiiVault | undefined): string {
  if (!vault) return value;
  return value.replace(/\[contato#\d+\]/g, (t) => vault.get(t) ?? t);
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  return `${user.slice(0, 2)}•••@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  return `•••${digits.slice(-4)}`;
}

/** Limita o JSON que volta para a LLM (custo + janela de contexto). */
export function compactJson(value: unknown, maxChars = 12_000): string {
  const json = JSON.stringify(value, (_k, v) => {
    if (typeof v === "number" && !Number.isInteger(v)) return Math.round(v * 100) / 100;
    if (typeof v === "bigint") return Number(v);
    return v;
  });
  if (!json) return "null";
  if (json.length <= maxChars) return json;
  return `${json.slice(0, maxChars)}…[truncado: ${json.length - maxChars} caracteres omitidos]`;
}
