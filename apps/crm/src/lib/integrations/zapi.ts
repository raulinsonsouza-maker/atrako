/**
 * Z-API client – envio de mensagens WhatsApp.
 * Config por tenant em Integration.config: { zapiInstanceId, zapiToken }
 * Documentação: https://developer.z-api.io/
 */

export type ZapiConfig = { zapiInstanceId: string; zapiToken: string };

const ZAPI_BASE = "https://api.z-api.io";

export async function sendText(
  config: ZapiConfig,
  to: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const phone = to.replace(/\D/g, "");
  const url = `${ZAPI_BASE}/instances/${encodeURIComponent(config.zapiInstanceId)}/token/${encodeURIComponent(config.zapiToken)}/send-text`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message: text }),
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

/** Extrai texto do payload de mensagem Z-API (ReceivedCallback) */
export function getTextFromZapiMessage(payload: Record<string, unknown>): string {
  const text = payload.text as { message?: string } | undefined;
  if (text?.message) return String(text.message).slice(0, 4000);

  const hydrated = payload.hydratedTemplate as { message?: string } | undefined;
  if (hydrated?.message) return String(hydrated.message).slice(0, 4000);

  const image = payload.image as { caption?: string } | undefined;
  if (image?.caption) return String(image.caption).slice(0, 4000);

  const video = payload.video as { caption?: string } | undefined;
  if (video?.caption) return String(video.caption).slice(0, 4000);

  const document = payload.document as { caption?: string } | undefined;
  if (document?.caption) return String(document.caption).slice(0, 4000);

  const buttonsResponse = payload.buttonsResponseMessage as { message?: string } | undefined;
  if (buttonsResponse?.message) return String(buttonsResponse.message).slice(0, 4000);

  const listResponse = payload.listResponseMessage as { message?: string } | undefined;
  if (listResponse?.message) return String(listResponse.message).slice(0, 4000);

  return "";
}

/** Extrai número do telefone do payload Z-API. Em grupos, usa participantPhone. */
export function phoneFromZapiPayload(payload: Record<string, unknown>): string {
  const isGroup = payload.isGroup === true;
  const participant = payload.participantPhone as string | undefined;
  const phone = payload.phone as string | undefined;

  if (isGroup && participant) {
    return String(participant).replace(/\D/g, "");
  }
  if (phone) {
    return String(phone).replace(/\D/g, "").replace(/-group$/, "");
  }
  return "";
}
