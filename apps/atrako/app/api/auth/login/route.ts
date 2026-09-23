import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  clearLoginFailures,
  createSessionToken,
  isPasswordHashCurrent,
  normalizeUsername,
  verifyPassword,
} from "@/lib/authSecurity";
import {
  bootstrapInternalUser,
  createInternalSessionInTransaction,
  setInternalSessionCookie,
} from "@/lib/internalUsers";
import { requireSameOrigin } from "@/lib/requestSecurity";

const GENERIC_ERROR = "Usuário ou senha inválidos.";

function genericResponse(status = 401, retryAfterSeconds?: number) {
  const response = NextResponse.json({ error: GENERIC_ERROR }, { status });
  if (retryAfterSeconds) response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const username = normalizeUsername(body.username);
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });

  const existingUser = await prisma.internalUser.findUnique({ where: { username } });
  const bootstrapped = await bootstrapInternalUser(username, password);
  const initialUser = bootstrapped ?? existingUser;
  const passwordMatches = await verifyPassword(password, initialUser?.passwordHash);

  if (!initialUser) return genericResponse();

  const sessionToken = createSessionToken();
  let authenticatedUser: typeof initialUser | null = null;
  try {
    authenticatedUser = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inout:account:${initialUser.id}`}, 0))`;
      const user = await tx.internalUser.findUnique({ where: { id: initialUser.id } });
      if (!user || !user.active) return null;
      // The hash comparison closes the reset/change-password TOCTOU window:
      // verification and session creation are valid only for the same version.
      if (!isPasswordHashCurrent(initialUser.passwordHash, user.passwordHash)) return null;
      if (!passwordMatches) return null;
      await tx.internalUser.update({
        where: { id: user.id },
        data: { ...clearLoginFailures(), lastLoginAt: new Date() },
      });
      await createInternalSessionInTransaction(tx, user.id, sessionToken);
      return user;
    }, { isolationLevel: "Serializable" });
  } catch {
    return genericResponse();
  }
  if (!authenticatedUser) return genericResponse();

  const response = NextResponse.json({
    ok: true,
    mustChangePassword: authenticatedUser.mustChangePassword,
  });
  setInternalSessionCookie(response, sessionToken);
  return response;
}