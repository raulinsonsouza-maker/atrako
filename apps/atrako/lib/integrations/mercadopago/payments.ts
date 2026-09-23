/**
 * Mercado Pago — OAuth + pagamentos do workspace.
 * Tokens: WorkspaceConnection provider=MERCADO_PAGO (via Config).
 * Doc: https://www.mercadopago.com.br/developers/pt/docs
 * Nunca gravar access_token em texto puro; usar credentialsEnc.
 */

import { resolveMercadoPago } from "@/lib/config/resolveConnection";

export async function mpFetch(
  workspaceId: string,
  path: string,
  init?: RequestInit,
) {
  const creds = await resolveMercadoPago(workspaceId);
  if (!creds) throw new Error("Mercado Pago não conectado neste workspace");

  const url = path.startsWith("http")
    ? path
    : `https://api.mercadopago.com${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

export async function getMpPublicKey(workspaceId: string) {
  const creds = await resolveMercadoPago(workspaceId);
  return creds?.publicKey ?? null;
}
