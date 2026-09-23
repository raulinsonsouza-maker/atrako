import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { WorkspaceMember } from "@/lib/generated/prisma";
import {
  AUTH_ABSOLUTE_TIMEOUT_MS,
  AUTH_IDLE_TIMEOUT_MS,
  createSessionToken,
  hashSessionToken,
  isSessionExpired,
} from "@/lib/authSecurity";

export const MEMBER_SESSION_COOKIE = "atrako_member_session";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(AUTH_ABSOLUTE_TIMEOUT_MS / 1000),
  };
}

export function setMemberSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(MEMBER_SESSION_COOKIE, token, cookieOptions());
}

export function clearMemberSessionCookie(response: NextResponse): void {
  response.cookies.set(MEMBER_SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export async function createMemberSession(memberId: string): Promise<string> {
  const token = createSessionToken();
  const now = new Date();
  await prisma.workspaceMemberSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      memberId,
      idleExpiresAt: new Date(now.getTime() + AUTH_IDLE_TIMEOUT_MS),
      absoluteExpiresAt: new Date(now.getTime() + AUTH_ABSOLUTE_TIMEOUT_MS),
    },
  });
  return token;
}

export async function revokeMemberSession(token: string | null | undefined): Promise<void> {
  if (!token) return;
  await prisma.workspaceMemberSession.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getWorkspaceMember(): Promise<WorkspaceMember | null> {
  const jar = await cookies();
  const token = jar.get(MEMBER_SESSION_COOKIE)?.value;
  if (!token || token.length < 40 || token.length > 100) return null;
  const now = new Date();
  const session = await prisma.workspaceMemberSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { member: true },
  });
  if (
    !session ||
    isSessionExpired(session, now) ||
    !session.member.active ||
    !session.member.passwordHash
  ) {
    return null;
  }
  const idleExpiresAt = new Date(
    Math.min(now.getTime() + AUTH_IDLE_TIMEOUT_MS, session.absoluteExpiresAt.getTime()),
  );
  const touched = await prisma.workspaceMemberSession.updateMany({
    where: {
      id: session.id,
      revokedAt: null,
      idleExpiresAt: { gt: now },
      absoluteExpiresAt: { gt: now },
    },
    data: { lastSeenAt: now, idleExpiresAt },
  });
  if (touched.count !== 1) return null;
  return session.member;
}

export async function findMemberByEmailWithPassword(email: string) {
  const normalized = email.trim().toLowerCase();
  return prisma.workspaceMember.findFirst({
    where: {
      email: normalized,
      active: true,
      passwordHash: { not: null },
    },
    orderBy: { createdAt: "asc" },
  });
}
