import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { InternalRole, InternalUser } from "@/lib/generated/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import {
  AUTH_ABSOLUTE_TIMEOUT_MS,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_NAME_PRODUCTION,
  AUTH_IDLE_TIMEOUT_MS,
  clearLoginFailures,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  isInternalBootstrapEligible,
  isLegacyBootstrapCandidate,
  isPendingBootstrapRecoveryCandidate,
  isSessionExpired,
  normalizeUsername,
  validatePassword,
} from "@/lib/authSecurity";

export class InternalAuthError extends Error {
  readonly status: 401 | 403;

  constructor(message: string, status: 401 | 403 = 401) {
    super(message);
    this.name = "InternalAuthError";
    this.status = status;
  }
}

export function internalAuthCookieName(): string {
  return process.env.NODE_ENV === "production" ? AUTH_COOKIE_NAME_PRODUCTION : AUTH_COOKIE_NAME;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(AUTH_ABSOLUTE_TIMEOUT_MS / 1000),
  };
}

export function setInternalSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(internalAuthCookieName(), token, cookieOptions());
}

export function clearInternalSessionCookie(response: NextResponse): void {
  response.cookies.set(internalAuthCookieName(), "", { ...cookieOptions(), maxAge: 0 });
}

export async function createInternalSession(userId: string): Promise<string> {
  const token = createSessionToken();
  const now = new Date();
  await createInternalSessionInTransaction(prisma, userId, token, now);
  return token;
}

export async function createInternalSessionInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  token: string,
  now = new Date(),
): Promise<void> {
  await tx.internalSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      idleExpiresAt: new Date(now.getTime() + AUTH_IDLE_TIMEOUT_MS),
      absoluteExpiresAt: new Date(now.getTime() + AUTH_ABSOLUTE_TIMEOUT_MS),
    },
  });
}

export async function revokeInternalSession(token: string | null | undefined): Promise<void> {
  if (!token) return;
  await prisma.internalSession.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllInternalSessions(userId: string): Promise<void> {
  await prisma.internalSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function sessionUser(): Promise<InternalUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(internalAuthCookieName())?.value;
  if (!token || token.length < 40 || token.length > 100) return null;
  const now = new Date();
  const session = await prisma.internalSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!session || isSessionExpired(session, now) || session.user.active !== true) {
    return null;
  }
  const idleExpiresAt = new Date(
    Math.min(now.getTime() + AUTH_IDLE_TIMEOUT_MS, session.absoluteExpiresAt.getTime()),
  );
  const touched = await prisma.internalSession.updateMany({
    where: {
      id: session.id,
      revokedAt: null,
      idleExpiresAt: { gt: now },
      absoluteExpiresAt: { gt: now },
    },
    data: { lastSeenAt: now, idleExpiresAt },
  });
  if (touched.count !== 1) return null;
  return session.user;
}

export async function getInternalUser(): Promise<InternalUser | null> {
  const session = await sessionUser();
  if (session) return session;
  // Dev-only open shell. Production / default: null (login required).
  if (process.env.ATRAKO_DEV_OPEN_ACCESS === "1") {
    return {
      id: "atrako-open-access",
      clerkUserId: null,
      email: null,
      username: "atrako",
      passwordHash: null,
      mustChangePassword: false,
      failedLoginCount: 0,
      failureWindowStartedAt: null,
      lockedUntil: null,
      passwordUpdatedAt: null,
      lastLoginAt: null,
      name: "Atrako",
      role: "ADMIN",
      active: true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as InternalUser;
  }
  return null;
}

export async function requireInternalUser(role?: InternalRole): Promise<InternalUser> {
  const user = await getInternalUser();
  if (!user) throw new InternalAuthError("Autenticação interna necessária", 401);
  if (!user.active) throw new InternalAuthError("Usuário interno desativado", 403);
  if (user.id === "atrako-open-access") {
    if (process.env.ATRAKO_DEV_OPEN_ACCESS !== "1") {
      throw new InternalAuthError("Autenticação interna necessária", 401);
    }
    return user;
  }
  if (role && user.role !== role) throw new InternalAuthError("Permissão de administrador necessária", 403);
  return user;
}

export async function writeAuditLog(input: {
  action: string;
  actorInternalUserId?: string | null;
  targetInternalUserId?: string | null;
  // Legacy fields remain accepted for historical integrations, but new
  // callers should always use local IDs.
  targetClerkUserId?: string | null;
  actorClerkUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const actorInternalUserId = input.actorInternalUserId ?? (await getInternalUser())?.id ?? null;
  return prisma.auditLog.create({
    data: {
      actorInternalUserId,
      targetInternalUserId: input.targetInternalUserId ?? null,
      actorClerkUserId: input.actorClerkUserId ?? null,
      targetClerkUserId: input.targetClerkUserId ?? null,
      action: input.action,
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
    },
  });
}

/**
 * Bootstrap and recovery require the exact environment-provided username,
 * password and (for an existing account) selected user ID.
 */
export async function bootstrapInternalUser(
  attemptedUsername: string,
  attemptedPassword: string,
): Promise<InternalUser | null> {
  const username = normalizeUsername(attemptedUsername);
  const configuredUsername = normalizeUsername(process.env.INTERNAL_BOOTSTRAP_USERNAME);
  if (!isInternalBootstrapEligible({
    flag: process.env.INTERNAL_AUTH_BOOTSTRAP,
    configuredUsername,
    attemptedUsername: username,
    configuredPassword: process.env.INTERNAL_BOOTSTRAP_PASSWORD,
    attemptedPassword,
  })) {
    return null;
  }
  // Recovery uses the exact environment secret. The regular password policy
  // still applies to user creation and password changes through admin routes.
  const passwordHash = await hashPassword(attemptedPassword);
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inout:internal-bootstrap'))`;
      const credentialedUsers = await tx.internalUser.count({
        where: { OR: [{ username: { not: null } }, { passwordHash: { not: null } }] },
      });
      const legacyId = process.env.INTERNAL_BOOTSTRAP_LEGACY_USER_ID?.trim();
      if (credentialedUsers === 1 && legacyId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inout:account:${legacyId}`}, 0))`;
        const pendingUser = await tx.internalUser.findUnique({ where: { id: legacyId } });
        if (!pendingUser || !isPendingBootstrapRecoveryCandidate(pendingUser, username!)) return null;
        const user = await tx.internalUser.update({
          where: { id: pendingUser.id },
          data: {
            passwordHash,
            mustChangePassword: false,
            passwordChangedAt: new Date(),
            ...clearLoginFailures(),
          },
        });
        await tx.internalSession.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            actorInternalUserId: user.id,
            targetInternalUserId: user.id,
            action: "INTERNAL_BOOTSTRAP_PASSWORD_RECOVERED",
            metadata: { source: "explicit_environment_bootstrap" },
          },
        });
        return user;
      }
      if (credentialedUsers !== 0) return null;
      const userCount = await tx.internalUser.count();
      let user: InternalUser;
      if (userCount === 0) {
        user = await tx.internalUser.create({
          data: {
            username,
            passwordHash,
            name: "Administrador",
            role: "ADMIN",
            active: true,
            mustChangePassword: false,
            passwordChangedAt: new Date(),
          },
        });
      } else {
        if (!legacyId) return null;
        const legacyUser = await tx.internalUser.findUnique({ where: { id: legacyId } });
        if (!legacyUser || !isLegacyBootstrapCandidate(legacyUser)) return null;
        user = await tx.internalUser.update({
          where: { id: legacyUser.id },
          data: {
            username,
            passwordHash,
            mustChangePassword: false,
            passwordChangedAt: new Date(),
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorInternalUserId: user.id,
          targetInternalUserId: user.id,
          action: "INTERNAL_USER_BOOTSTRAPPED",
          metadata: { source: "explicit_environment_bootstrap" },
        },
      });
      return user;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && String(error.code) === "P2034") {
      return null;
    }
    throw error;
  }
}

export { clearLoginFailures };