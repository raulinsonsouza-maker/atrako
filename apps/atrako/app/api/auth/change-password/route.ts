import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, hashPassword, isPasswordHashCurrent, validatePassword, verifyPassword } from "@/lib/authSecurity";
import {
  createInternalSessionInTransaction,
  getInternalUser,
  setInternalSessionCookie,
} from "@/lib/internalUsers";
import { requireSameOrigin } from "@/lib/requestSecurity";

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await getInternalUser();
  if (!user || !user.active) {
    return NextResponse.json({ error: "Autenticação interna necessária" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Senha atual inválida." }, { status: 400 });
  }
  const passwordError = validatePassword(newPassword, user.username);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
  const passwordHash = await hashPassword(newPassword);
  const token = createSessionToken();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inout:account:${user.id}`}, 0))`;
      const fresh = await tx.internalUser.findUnique({ where: { id: user.id } });
      if (!fresh || !fresh.active || !isPasswordHashCurrent(user.passwordHash, fresh.passwordHash)) {
        throw new Error("Senha foi alterada; tente novamente.");
      }
      await tx.internalUser.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
          failureWindowStartedAt: null,
          lockedUntil: null,
        },
      });
      await tx.internalSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await createInternalSessionInTransaction(tx, user.id, token);
    }, { isolationLevel: "Serializable" });
  } catch {
    return NextResponse.json({ error: "Não foi possível alterar a senha. Tente novamente." }, { status: 409 });
  }
  const response = NextResponse.json({ ok: true, mustChangePassword: false });
  setInternalSessionCookie(response, token);
  return response;
}