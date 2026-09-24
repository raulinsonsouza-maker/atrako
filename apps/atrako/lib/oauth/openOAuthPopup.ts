export const ATRAKO_OAUTH_MESSAGE = "atrako-oauth" as const;

export type AtrakoOAuthMessage = {
  type: typeof ATRAKO_OAUTH_MESSAGE;
  ok: boolean;
  error: string | null;
  provider: string | null;
  workspaceId: string | null;
  connected: string | null;
  meta: string | null;
  metaError: string | null;
  pick: string | null;
};

const POPUP_NAME = "atrako-oauth";

/** Abre OAuth numa janela centrada. Retorna null se o browser bloquear popup. */
export function openOAuthPopup(url: string): Window | null {
  const width = 560;
  const height = 720;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "scrollbars=yes",
    "resizable=yes",
  ].join(",");

  return window.open(url, POPUP_NAME, features);
}

export function isAtrakoOAuthMessage(data: unknown): data is AtrakoOAuthMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === ATRAKO_OAUTH_MESSAGE
  );
}

/** Path canônico pós-callback (popup postMessage ou same-tab → hub). */
export const OAUTH_COMPLETE_PATH = "/config/conexoes/oauth-complete";

export function buildOAuthCompleteUrl(
  origin: string,
  params: Record<string, string | null | undefined>,
): URL {
  const url = new URL(OAUTH_COMPLETE_PATH, origin);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }
  if (!url.searchParams.has("ok") && !url.searchParams.has("error") && !url.searchParams.has("meta")) {
    // Sucesso implícito quando há connected
    if (params.connected) url.searchParams.set("ok", "1");
  }
  return url;
}
