/**
 * WhatsApp Cloud API — client HTTP via Config (resolveWhatsApp).
 * Doc: https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform
 * Nunca logar access_token.
 */

import { resolveWhatsApp } from "@/lib/config/resolveConnection";
import { metaGraphUrl } from "@/lib/integrations/meta/graph";

export async function waFetch(
  workspaceId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const creds = await resolveWhatsApp(workspaceId);
  if (!creds) throw new Error("WhatsApp não conectado neste workspace (Config → Conexões)");

  const url = metaGraphUrl(path);
  const headers = new Headers(init?.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${creds.accessToken}`);
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...init, headers, cache: "no-store" });
}

export async function getWhatsAppCredsOrThrow(workspaceId: string) {
  const creds = await resolveWhatsApp(workspaceId);
  if (!creds) throw new Error("WhatsApp não conectado neste workspace (Config → Conexões)");
  return creds;
}
