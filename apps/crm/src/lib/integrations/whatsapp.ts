/**
 * Evolution API client – envio de mensagens WhatsApp.
 * URL e instance por tenant em Integration.config: { evolutionInstance, evolutionApiUrl? }
 */

export type EvolutionConfig = { evolutionInstance: string; evolutionApiUrl?: string; evolutionApiKey?: string };

export async function sendText(
  config: EvolutionConfig,
  to: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const base = config.evolutionApiUrl || process.env.EVOLUTION_API_URL || "http://127.0.0.1:8080";
  const num = to.replace(/\D/g, "");
  const url = `${base}/message/sendText/${config.evolutionInstance}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.evolutionApiKey) headers["apikey"] = config.evolutionApiKey;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ number: `${num}@s.whatsapp.net`, text }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: t || res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Extrai texto do payload de mensagem Evolution (messages.upsert) */
export function getTextFromEvolutionMessage(msg: Record<string, unknown>): string {
  const v =
    (msg.conversation as string) ||
    (msg as { extendedTextMessage?: { text?: string } }).extendedTextMessage?.text ||
    (msg as { imageMessage?: { caption?: string } }).imageMessage?.caption ||
    (msg as { documentMessage?: { caption?: string } }).documentMessage?.caption ||
    "";
  return String(v || "").slice(0, 4000);
}

/** Envia indicador "digitando" (typing) para o chat. Evolution API: Send Presence. */
export async function sendTyping(
  config: EvolutionConfig,
  to: string
): Promise<{ ok: boolean; error?: string }> {
  const base = config.evolutionApiUrl || process.env.EVOLUTION_API_URL || "http://127.0.0.1:8080";
  const num = to.replace(/\D/g, "");
  const jid = `${num}@s.whatsapp.net`;
  const url = `${base}/chat/sendPresence/${config.evolutionInstance}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.evolutionApiKey) headers["apikey"] = config.evolutionApiKey;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ number: jid, presence: "composing" }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: t || res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Extrai remoteJid (ex: 5511999999999@s.whatsapp.net) e normaliza para número */
export function phoneFromRemoteJid(remoteJid: string): string {
  return remoteJid.replace(/@.+$/, "").replace(/\D/g, "");
}
