import { createHmac, timingSafeEqual } from "crypto";

export const GUEST_COOKIE = "atrako_guest";
export const GOOGLE_RETURN_COOKIE = "atrako_google_return";
const MAX_AGE = 60 * 60 * 24 * 30;

export type GuestSession = {
  v: 1;
  clienteId: string;
  contactId: string;
  email: string | null;
  name: string;
  phone: string | null;
  birthDate: string | null;
  promoOptOut: boolean;
};

function secret() {
  return process.env.NEXTAUTH_SECRET || process.env.ATRAKO_INTERNAL_TOKEN || "atrako-guest-dev";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function readSigned(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}

export function signGuest(session: GuestSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readGuest(token: string | undefined | null): GuestSession | null {
  const payload = readSigned(token);
  if (!payload) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GuestSession;
    if (data.v !== 1 || !data.clienteId || !data.contactId) return null;
    return data;
  } catch {
    return null;
  }
}

export function signGoogleReturn(value: { state: string; returnTo: string }) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readGoogleReturn(token: string | undefined | null): { state: string; returnTo: string } | null {
  const payload = readSigned(token);
  if (!payload) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      state?: string;
      returnTo?: string;
    };
    if (!data.state || !data.returnTo) return null;
    return { state: data.state, returnTo: safeReturnPath(data.returnTo) };
  } catch {
    return null;
  }
}

export function safeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return "/";
  }
  if (value.length > 300) return "/";
  return value;
}

export function guestCookieOptions(maxAge = MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
