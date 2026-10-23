/**
 * Primeira origem do visitante (cookie `atk_ft`, 90 dias). Sem isso, quem entra pelo guia vindo
 * do ChatGPT e converte em outra página chega no CRM com o próprio domínio como referrer.
 * O mesmo formato é lido/escrito pelo app.js das LPs estáticas.
 */

export const FIRST_TOUCH_COOKIE = "atk_ft";
const MAX_AGE = 60 * 60 * 24 * 90;

export type FirstTouch = { ref?: string; src?: string; med?: string; cmp?: string; lp?: string; at?: string };

function readCookie(name: string): string {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

export function readFirstTouch(): FirstTouch | null {
  if (typeof document === "undefined") return null;
  try {
    const raw = readCookie(FIRST_TOUCH_COOKIE);
    return raw ? (JSON.parse(raw) as FirstTouch) : null;
  } catch {
    return null;
  }
}

/** Grava a primeira origem uma única vez (não sobrescreve). */
export function captureFirstTouch(): FirstTouch | null {
  if (typeof window === "undefined") return null;
  const existing = readFirstTouch();
  if (existing) return existing;
  const params = new URLSearchParams(window.location.search);
  let ref = document.referrer || "";
  try {
    if (ref && new URL(ref).host === window.location.host) ref = "";
  } catch {
    /* ignore */
  }
  const ft: FirstTouch = {
    ...(ref ? { ref: ref.slice(0, 300) } : {}),
    ...(params.get("utm_source") ? { src: params.get("utm_source")!.slice(0, 120) } : {}),
    ...(params.get("utm_medium") ? { med: params.get("utm_medium")!.slice(0, 120) } : {}),
    ...(params.get("utm_campaign") ? { cmp: params.get("utm_campaign")!.slice(0, 120) } : {}),
    lp: window.location.pathname.slice(0, 200),
    at: new Date().toISOString(),
  };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${FIRST_TOUCH_COOKIE}=${encodeURIComponent(JSON.stringify(ft))}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  return ft;
}

/** Campos enviados junto com o lead (`pickAttributionFromBody` aceita essas chaves). */
export function firstTouchPayload(): Record<string, string> {
  const ft = readFirstTouch();
  if (!ft) return {};
  const out: Record<string, string> = {};
  if (ft.ref) out.first_referrer = ft.ref;
  if (ft.src) out.first_utm_source = ft.src;
  if (ft.med) out.first_utm_medium = ft.med;
  if (ft.cmp) out.first_utm_campaign = ft.cmp;
  if (ft.lp) out.first_landing = ft.lp;
  if (ft.at) out.first_seen_at = ft.at;
  return out;
}
