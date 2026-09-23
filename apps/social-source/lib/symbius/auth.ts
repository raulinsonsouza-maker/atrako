import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  SYMBIUS_SESSION_COOKIE,
  verifySessionToken,
  type SymbiusSession,
} from "./session-token";

export { SYMBIUS_SESSION_COOKIE, type SymbiusSession };
export { createSessionToken, verifySessionToken } from "./session-token";

export const SYMBIUS_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export function attachSessionCookie(
  response: NextResponse,
  token: string,
): NextResponse {
  response.cookies.set(
    SYMBIUS_SESSION_COOKIE,
    token,
    SYMBIUS_SESSION_COOKIE_OPTIONS,
  );
  return response;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SYMBIUS_SESSION_COOKIE, token, SYMBIUS_SESSION_COOKIE_OPTIONS);
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SYMBIUS_SESSION_COOKIE);
}

export async function getSession(): Promise<SymbiusSession | null> {
  if (process.env.ATRAKO_EMBED_OPEN === "true") {
    const { getOrCreateEmbedSession, ensureEmbedIgFromHub } = await import("./atrako-embed");
    const session = await getOrCreateEmbedSession();
    await ensureEmbedIgFromHub(session.organizationId);
    return session;
  }

  const jar = await cookies();
  const token = jar.get(SYMBIUS_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { status: true },
  });
  if (!org || org.status !== "ACTIVE") return null;

  return session;
}

export async function requireSession(): Promise<SymbiusSession> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

/** Emite JWT de sessão para um usuário (sem gravar cookie). */
export async function createSessionForUser(userId: string): Promise<{
  token: string;
  organizationId: string;
}> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      memberships: {
        include: { organization: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  const membership = user.memberships[0];
  if (!membership || membership.organization.status !== "ACTIVE") {
    throw new Error("Conta suspensa");
  }

  const token = await createSessionToken({
    userId: user.id,
    organizationId: membership.organizationId,
    role: membership.role,
    email: user.email,
    nome: user.nome,
  });

  return { token, organizationId: membership.organizationId };
}

export function slugifyOrgName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function uniqueOrgSlug(base: string): Promise<string> {
  let slug = slugifyOrgName(base) || "org";
  let n = 0;
  while (true) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const exists = await prisma.organization.findUnique({
      where: { slug: candidate },
    });
    if (!exists) return candidate;
    n++;
  }
}

export const PLAN_LIMITS = {
  FREE: { maxIgAccounts: 1, maxFluxos: 3, maxMembers: 1 },
  PRO: { maxIgAccounts: 3, maxFluxos: 999, maxMembers: 5 },
  AGENCY: { maxIgAccounts: 10, maxFluxos: 999, maxMembers: 20 },
} as const;

export type SymbiusPlan = keyof typeof PLAN_LIMITS;

export function limitsForPlan(plan: string) {
  return PLAN_LIMITS[plan as SymbiusPlan] ?? PLAN_LIMITS.FREE;
}
