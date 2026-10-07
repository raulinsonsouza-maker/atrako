import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token de prévia (modo teste) para /p e /f: abre rascunhos sem login e
 * faz formulário/checkout simularem o envio — nada vira lead ou pedido.
 */

export type PreviewKind = "lp" | "form";
export type PreviewPayload = { k: PreviewKind; id: string; ws: string; exp: number };

export const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  const s =
    process.env.ATRAKO_PREVIEW_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.ATRAKO_CONNECTIONS_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("Segredo de prévia ausente");
    return "atrako-dev-preview-secret";
  }
  return s;
}

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function sign(body: string): string {
  return b64(createHmac("sha256", secret()).update(`preview.v1.${body}`).digest());
}

export function createPreviewToken(input: { kind: PreviewKind; id: string; clienteId: string }, now = Date.now()): string {
  const payload: PreviewPayload = { k: input.kind, id: input.id, ws: input.clienteId, exp: now + PREVIEW_TTL_MS };
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyPreviewToken(token: unknown, expect?: PreviewKind, now = Date.now()): PreviewPayload | null {
  if (typeof token !== "string" || token.length > 600) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const good = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PreviewPayload;
    if ((p.k !== "lp" && p.k !== "form") || typeof p.id !== "string" || typeof p.ws !== "string") return null;
    if (typeof p.exp !== "number" || p.exp < now) return null;
    if (expect && p.k !== expect) return null;
    return p;
  } catch {
    return null;
  }
}

export function lpPreviewPath(slug: string, token: string) {
  return `/p/${encodeURIComponent(slug)}?preview=${encodeURIComponent(token)}`;
}

export function formPreviewPath(slug: string, token: string) {
  return `/f/${encodeURIComponent(slug)}?preview=${encodeURIComponent(token)}`;
}
