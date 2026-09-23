import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, normalizeUsername, validatePassword } from "@/lib/authSecurity";
import { InternalAuthError, requireInternalUser, writeAuditLog } from "@/lib/internalUsers";
import { requireSameOrigin } from "@/lib/requestSecurity";

function authError(error: unknown) {
  if (error instanceof InternalAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

function serializeUser(user: {
  id: string; username: string | null; email: string | null; name: string | null;
  role: string; active: boolean; mustChangePassword: boolean; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function GET() {
  try {
    await requireInternalUser("ADMIN");
    const users = await prisma.internalUser.findMany({
      orderBy: [{ active: "desc" }, { username: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ users: users.map(serializeUser) });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Não foi possível carregar os usuários" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const actor = await requireInternalUser("ADMIN");
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const username = normalizeUsername(body.username);
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 160) : "";
    const role = body.role === "ADMIN" ? "ADMIN" : body.role === "ANALYST" ? "ANALYST" : null;
    if (!username) return NextResponse.json({ error: "Informe um nome de usuário válido." }, { status: 400 });
    if (!role) return NextResponse.json({ error: "Informe um perfil válido." }, { status: 400 });
    const passwordError = validatePassword(password, username);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
    const passwordHash = await hashPassword(password);
    const user = await prisma.internalUser.create({
      data: {
        username,
        name: name || null,
        role,
        active: true,
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });
    await writeAuditLog({
      actorInternalUserId: actor.id,
      targetInternalUserId: user.id,
      action: "INTERNAL_USER_CREATED",
      metadata: { username, role },
    });
    return NextResponse.json({ user: serializeUser(user) }, { status: 201 });
  } catch (error) {
    return authError(error) ?? NextResponse.json(
      { error: typeof error === "object" && error && "code" in error && error.code === "P2002"
        ? "Este nome de usuário já está em uso."
        : "Não foi possível criar o usuário" },
      { status: typeof error === "object" && error && "code" in error && error.code === "P2002" ? 409 : 500 },
    );
  }
}