/**
 * Links rastreados (/r/{token}) e descadastro (/u/{token}).
 * Segredo: ATRAKO_CONNECTIONS_SECRET || AUTH_SECRET (não o CRON_SECRET) + salt por uso.
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

function secret(salt: string) {
  const base =
    process.env.ATRAKO_CONNECTIONS_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "atrako-dev-secret";
  return `${base}:${salt}`;
}

function hmac(salt: string, value: string, len = 22) {
  return createHmac("sha256", secret(salt)).update(value).digest("base64url").slice(0, len);
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function newTrackingToken() {
  return randomBytes(16).toString("base64url");
}

/** Link principal: /r/{token}. Links secundários: /r/{token}?u=<b64url>&s=<hmac>. */
export function buildTrackedUrl(origin: string, token: string, url?: string | null) {
  const base = `${origin}/r/${token}`;
  if (!url) return base;
  const u = Buffer.from(url).toString("base64url");
  return `${base}?u=${u}&s=${hmac("r-link", `${token}:${u}`, 16)}`;
}

export function readTrackedTarget(token: string, u: string | null, s: string | null): string | null {
  if (!u || !s) return null;
  if (!safeEqual(hmac("r-link", `${token}:${u}`, 16), s)) return null;
  try {
    const url = Buffer.from(u, "base64url").toString("utf8");
    return /^https?:\/\//i.test(url) ? url : null;
  } catch {
    return null;
  }
}

export function unsubscribeToken(clienteId: string, contactId: string) {
  const payload = Buffer.from(`${clienteId}:${contactId}`).toString("base64url");
  return `${payload}.${hmac("unsub", payload)}`;
}

export function parseUnsubscribeToken(token: string): { clienteId: string; contactId: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(hmac("unsub", payload), sig)) return null;
  const [clienteId, contactId] = Buffer.from(payload, "base64url").toString("utf8").split(":");
  return clienteId && contactId ? { clienteId, contactId } : null;
}

export function buildUnsubscribeUrl(origin: string, clienteId: string, contactId: string) {
  return `${origin}/u/${unsubscribeToken(clienteId, contactId)}`;
}

/** Destino final com UTMs; Shopify aplica cupom via /discount/{code}?redirect=. */
export function buildDestination(
  url: string,
  opts: {
    medium: "email" | "whatsapp";
    campaign: string;
    content?: string | null;
    couponCode?: string | null;
    shopify?: boolean;
  },
): string {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return url;
  }
  target.searchParams.set("utm_source", "atrako");
  target.searchParams.set("utm_medium", opts.medium);
  target.searchParams.set("utm_campaign", opts.campaign);
  if (opts.content) target.searchParams.set("utm_content", opts.content);

  if (opts.shopify && opts.couponCode && !target.pathname.startsWith("/discount/")) {
    const redirect = `${target.pathname}${target.search}`;
    return `${target.origin}/discount/${encodeURIComponent(opts.couponCode)}?redirect=${encodeURIComponent(redirect)}`;
  }
  return target.toString();
}
