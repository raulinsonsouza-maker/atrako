import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, normalizeUsername, validatePassword } from "@/lib/authSecurity";
import {
  InternalAuthError,
  requireInternalUser,
  writeAuditLog,
} from "@/lib/internalUsers";
import { requireSameOrigin } from "@/lib/requestSecurity";

type Context = { params: Promise<{ id: string }> };

class UserMutationError extends Error {
  status: 400 | 404 | 409;
  constructor(message: string, status: 400 | 404 | 409 = 400) {
    super(message);
    this.status = status;
  }
}

function authError(error: unknown) {
  if (error instanceof InternalAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

function serializeUser(user: {
  id: string; username: string | null; name: string | null; role: string;
  active: boolean; mustChangePassword: boolean; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: user.id, username: user.username, name: user.name, role: user.role,
    active: user.active, mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(),
  };
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const actor = await requireInternalUser("ADMIN");
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const password = typeof body.password === "string" ? body.password : null;
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name.trim().slice(0, 160) || null;
    if (body.role === "ADMIN" || body.role === "ANALYST") data.role = body.role;
    if (typeof body.active === "boolean") data.active = body.active;
    if (body.username !== undefined) {
      const username = normalizeUsername(body.username);
      if (!username) throw new UserMutationError("Informe um nome de usuário válido.");
      data.username = username;
    }
    if (password !== null) {
      const usernameForValidation = (data.username as string | undefined) ??
        (await prisma.internalUser.findUnique({ where: { id }, select: { username: true } }))?.username;
      const passwordError = validatePassword(password, usernameForValidation);
      if (passwordError) throw new UserMutationError(passwordError);
      data.passwordHash = await hashPassword(password);
      data.mustChangePassword = false;
      data.passwordChangedAt = new Date();
      data.failedLoginCount = 0;
      data.failureWindowStartedAt = null;
      data.lockedUntil = null;
    }
    if (!Object.keys(data).length) throw new UserMutationError("Nenhuma alteração informada.");
    const { updated } = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inout:internal-admin-invariant'))`;
      const target = await tx.internalUser.findUnique({ where: { id } });
      if (!target) throw new UserMutationError("Usuário não encontrado", 404);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inout:account:${target.id}`}, 0))`;
      if (target.id === actor.id && data.active === false) {
        throw new UserMutationError("Você não pode desativar o próprio usuário.");
      }
      if (target.id === actor.id && data.role === "ANALYST") {
        throw new UserMutationError("Você não pode remover o próprio acesso administrativo.");
      }
      const changed = await tx.internalUser.update({ where: { id }, data });
      const activeAdmins = await tx.internalUser.count({ where: { role: "ADMIN", active: true } });
      if (activeAdmins < 1) throw new UserMutationError("É necessário manter pelo menos um administrador ativo.");
      if (data.active === false || password !== null) {
        await tx.internalSession.updateMany({
          where: { userId: changed.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return {
        updated: changed,
      };
    }, { isolationLevel: "Serializable" });
    await writeAuditLog({
      actorInternalUserId: actor.id,
      targetInternalUserId: updated.id,
      action: password !== null ? "INTERNAL_USER_PASSWORD_RESET" : "INTERNAL_USER_UPDATED",
      metadata: { changes: Object.keys(data).filter((key) => key !== "passwordHash"), targetId: updated.id },
    });
    return NextResponse.json({ user: serializeUser(updated) });
  } catch (error) {
    return authError(error) ?? NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível atualizar o usuário" },
      { status: error instanceof UserMutationError ? error.status : 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const actor = await requireInternalUser("ADMIN");
    const { id } = await params;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inout:internal-admin-invariant'))`;
      const target = await tx.internalUser.findUnique({ where: { id } });
      if (!target) throw new UserMutationError("Usuário não encontrado", 404);
      if (target.id === actor.id) throw new UserMutationError("Você não pode desativar o próprio usuário.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inout:account:${target.id}`}, 0))`;
      const changed = await tx.internalUser.update({ where: { id }, data: { active: false } });
      const activeAdmins = await tx.internalUser.count({ where: { role: "ADMIN", active: true } });
      if (activeAdmins < 1) throw new UserMutationError("É necessário manter pelo menos um administrador ativo.");
      await tx.internalSession.updateMany({
        where: { userId: changed.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return changed;
    }, { isolationLevel: "Serializable" });
    await writeAuditLog({
      actorInternalUserId: actor.id,
      targetInternalUserId: updated.id,
      action: "INTERNAL_USER_DEACTIVATED",
      metadata: { targetId: updated.id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error) ?? NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível desativar o usuário" },
      { status: error instanceof UserMutationError ? error.status : 500 },
    );
  }
}