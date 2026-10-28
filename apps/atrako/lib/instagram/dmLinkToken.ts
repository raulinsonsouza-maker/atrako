import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerPublicOrigin } from "@/lib/http/public-origin";

export const DM_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type DmLinkPayload = { c: string; f: string; i: number; u: string; exp: number };

function secret(): string {
  const value =
    process.env.ATRAKO_PREVIEW_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.ATRAKO_CONNECTIONS_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === "production") throw new Error("Segredo do link do Direct ausente");
    return "atrako-dev-preview-secret";
  }
  return value;
}

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function sign(body: string): string {
  return b64(createHmac("sha256", secret()).update(`dm-link.v1.${body}`).digest());
}

export function createDmLinkToken(
  input: { fluxoId: string; contatoId: string; index: number; url: string },
  now = Date.now(),
): string {
  const payload: DmLinkPayload = {
    c: input.contatoId,
    f: input.fluxoId,
    i: input.index,
    u: input.url,
    exp: now + DM_LINK_TTL_MS,
  };
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyDmLinkToken(token: unknown, now = Date.now()): DmLinkPayload | null {
  if (typeof token !== "string" || token.length > 2000) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const good = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DmLinkPayload;
    if (!payload || typeof payload.c !== "string" || typeof payload.f !== "string") return null;
    if (!Number.isInteger(payload.i) || payload.i < 0 || payload.i > 2) return null;
    if (typeof payload.u !== "string" || typeof payload.exp !== "number" || payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function directLinkUrl(
  input: { fluxoId: string; contatoId: string; index: number; url: string },
  now = Date.now(),
): string {
  const token = createDmLinkToken(input, now);
  return `${getServerPublicOrigin()}/api/instagram/dm-link?t=${encodeURIComponent(token)}`;
}

export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isDmLinkPrefetch(headers: { get(name: string): string | null }, method: string): boolean {
  if (method.toUpperCase() === "HEAD") return true;
  const purpose = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""} ${headers.get("x-purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("preview")) return true;
  const ua = headers.get("user-agent") ?? "";
  return /facebookexternalhit|Facebot|Twitterbot|Slackbot|WhatsApp|TelegramBot|LinkedInBot|Googlebot|bingbot|PetalBot|Applebot|Discordbot|\bbot\b/i.test(ua);
}
