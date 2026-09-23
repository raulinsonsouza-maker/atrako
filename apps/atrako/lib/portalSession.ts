import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { InternalAuthError, requireInternalUser } from "@/lib/internalUsers";
import { allowsAnonymousClienteRead, type ClienteAccessMode } from "@/lib/clienteAccessPolicy";

export const PORTAL_SESSION_COOKIE = "inout_portal_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type PortalSessionPayload = {
  clienteId: string;
  tokenFingerprint: string;
  expiresAt: number;
};

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado");
  return secret;
}

function fingerprint(token: string) {
  return createHmac("sha256", sessionSecret()).update(token).digest("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function encodePortalSession(payload: PortalSessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function decodePortalSession(value?: string): PortalSessionPayload | null {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const encoded = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<PortalSessionPayload>;
    if (!payload.clienteId || !payload.tokenFingerprint || !payload.expiresAt || payload.expiresAt <= Date.now()) return null;
    return {
      clienteId: payload.clienteId,
      tokenFingerprint: payload.tokenFingerprint,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function establishPortalSession(token: string) {
  const cliente = await prisma.cliente.findUnique({
    where: { portalToken: token },
    select: { id: true, nome: true, portalToken: true, ativo: true },
  });
  if (!cliente?.ativo || !cliente.portalToken) return null;
  const value = encodePortalSession({
    clienteId: cliente.id,
    tokenFingerprint: fingerprint(cliente.portalToken),
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  });
  return {
    cliente: { id: cliente.id, nome: cliente.nome },
    cookie: { name: PORTAL_SESSION_COOKIE, value },
  };
}

function portalSessionCookieValue(request: Request): string | undefined {
  return request.headers
    .get("cookie")
    ?.match(new RegExp(`(?:^|;\\s*)${PORTAL_SESSION_COOKIE}=([^;]*)`))?.[1];
}

async function readPortalSession(request: Request, clienteId: string) {
  const payload = decodePortalSession(portalSessionCookieValue(request));
  if (!payload || payload.clienteId !== clienteId) return false;
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { portalToken: true, ativo: true },
  });
  return Boolean(cliente?.ativo && cliente.portalToken && fingerprint(cliente.portalToken) === payload.tokenFingerprint);
}

export async function requireClienteAccess(
  request: Request,
  clienteId: string,
  mode: ClienteAccessMode = "read",
) {
  try {
    const internalUser = await requireInternalUser();
    return { internalUser, portal: false, member: null as null, response: null };
  } catch (error) {
    if (!(error instanceof InternalAuthError)) throw error;

    const { getWorkspaceMember } = await import("@/lib/tenancy/memberAuth");
    const memberSession = await getWorkspaceMember();
    if (memberSession) {
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          clienteId_email: {
            clienteId,
            email: memberSession.email.trim().toLowerCase(),
          },
        },
      });
      if (membership?.active) {
        return { internalUser: null, portal: false, member: membership, response: null };
      }
    }

    const portalCookieValue = portalSessionCookieValue(request);
    // Anonymous public-read only in explicit dev open-access mode.
    if (
      process.env.ATRAKO_DEV_OPEN_ACCESS === "1" &&
      allowsAnonymousClienteRead(mode, portalCookieValue !== undefined)
    ) {
      return { internalUser: null, portal: false, member: null, response: null };
    }
    if (mode !== "write" && (await readPortalSession(request, clienteId))) {
      return { internalUser: null, portal: true, member: null, response: null };
    }
    return {
      internalUser: null,
      portal: false,
      member: null,
      response: NextResponse.json({ error: "Acesso ao cliente não autorizado" }, { status: error.status }),
    };
  }
}

export function setPortalSessionCookie(response: NextResponse, value: string) {
  response.cookies.set(PORTAL_SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export async function clearPortalSession() {
  const jar = await cookies();
  jar.delete(PORTAL_SESSION_COOKIE);
}