/**
 * Abstração do canal WhatsApp — Evolution, Z-API ou WhatsApp Web (integrado no CRM via QR).
 */

import { sendText, sendTyping as evolutionSendTyping } from "./whatsapp";
import { sendText as zapiSendText } from "./zapi";
import { sendMessage as wwebSend, sendTyping as wwebSendTyping } from "@/lib/wweb-manager";

export type WhatsAppProvider = "evolution" | "wweb" | "zapi";

export type WhatsAppChannelConfig = {
  provider?: WhatsAppProvider;
  evolutionInstance?: string;
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  zapiInstanceId?: string;
  zapiToken?: string;
  wwebServiceUrl?: string;
};

async function sendWwebServiceMessage(serviceUrl: string, to: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const base = serviceUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, text }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const msg = typeof json?.error === "string" ? json.error : `Erro ao enviar (${res.status})`;
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao enviar via serviço externo." };
  }
}

/**
 * Envia mensagem de texto. Usa Evolution ou WhatsApp Web integrado (tenantId obrigatório para wweb).
 */
export async function sendMessage(
  config: WhatsAppChannelConfig,
  to: string,
  text: string,
  tenantId?: string
): Promise<{ ok: boolean; error?: string }> {
  if (config.provider === "wweb" && config.wwebServiceUrl) {
    return sendWwebServiceMessage(config.wwebServiceUrl, to, text);
  }

  // WhatsApp Web integrado: QR nas configurações do CRM
  if (config.provider === "wweb" && !config.wwebServiceUrl && tenantId) {
    return wwebSend(tenantId, to, text);
  }

  // Z-API
  if (config.zapiInstanceId && config.zapiToken) {
    return zapiSendText(
      { zapiInstanceId: config.zapiInstanceId, zapiToken: config.zapiToken },
      to,
      text
    );
  }

  // Evolution API
  if (config.evolutionInstance) {
    return sendText(
      {
        evolutionInstance: config.evolutionInstance,
        evolutionApiUrl: config.evolutionApiUrl,
        evolutionApiKey: config.evolutionApiKey,
      },
      to,
      text
    );
  }

  return { ok: false, error: "Configure WhatsApp em Configurações (QR Code, Z-API ou Evolution API)." };
}

/**
 * Envia indicador "digitando" (typing) para o chat. Usa Evolution ou wweb conforme config.
 */
export async function sendTyping(
  config: WhatsAppChannelConfig,
  to: string,
  tenantId?: string
): Promise<{ ok: boolean; error?: string }> {
  if (config.provider === "wweb" && config.wwebServiceUrl) {
    // Serviço externo wweb pode não expor typing; falha silenciosa
    return { ok: true };
  }
  if (config.provider === "wweb" && !config.wwebServiceUrl && tenantId) {
    return wwebSendTyping(tenantId, to);
  }
  if (config.zapiInstanceId && config.zapiToken) {
    // Z-API não expõe typing via API; retorna sucesso silencioso
    return { ok: true };
  }
  if (config.evolutionInstance) {
    return evolutionSendTyping(
      {
        evolutionInstance: config.evolutionInstance,
        evolutionApiUrl: config.evolutionApiUrl,
        evolutionApiKey: config.evolutionApiKey,
      },
      to
    );
  }
  return { ok: false, error: "Configure WhatsApp em Configurações (QR Code, Z-API ou Evolution API)." };
}
