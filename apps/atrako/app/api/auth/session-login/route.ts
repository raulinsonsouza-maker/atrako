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
import {
  createMemberSession,
  findMemberByEmailWithPassword,
  setMemberSessionCookie,
} from "@/lib/tenancy/memberAuth";
import { listMemberWorkspaceIds, WORKSPACE_COOKIE } from "@/lib/tenancy/workspace";

const GENERIC = "Credenciais inválidas.";

/**
 * Login único: e-mail → dealer; usuário → staff.
 */
export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const identifier =
    typeof body.identifier === "string"
      ? body.identifier.trim()
      : typeof body.email === "string"
        ? body.email.trim()
        : typeof body.username === "string"
          ? body.username.trim()
          : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || !password) {
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  const looksLikeEmail = identifier.includes("@");

  if (looksLikeEmail) {
    const member = await findMemberByEmailWithPassword(identifier.toLowerCase());
    if (member?.passwordHash) {
      const ok = await verifyPassword(password, member.passwordHash);
      if (ok) {
        const token = await createMemberSession(member.id);
        const workspaces = await listMemberWorkspaceIds(member.email);
        const res = NextResponse.json({
          ok: true,
          kind: "member" as const,
          redirect: "/assistente",
          email: member.email,
          workspaces,
        });
        setMemberSessionCookie(res, token);
        if (workspaces[0]) {
          res.cookies.set(WORKSPACE_COOKIE, workspaces[0], {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
          });
        }
        return res;
      }
    }
  }

  const username = normalizeUsername(identifier);
  if (!username) {
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  const existingUser = await prisma.internalUser.findUnique({ where: { username } });
  const bootstrapped = await bootstrapInternalUser(username, password);
  const initialUser = bootstrapped ?? existingUser;
  const passwordMatches = await verifyPassword(password, initialUser?.passwordHash);
  if (!initialUser) {
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  const sessionToken = createSessionToken();
  let authenticatedUser: typeof initialUser | null = null;
  try {
    authenticatedUser = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inout:account:${initialUser.id}`}, 0))`;
        const user = await tx.internalUser.findUnique({ where: { id: initialUser.id } });
        if (!user || !user.active) return null;
        if (!isPasswordHashCurrent(initialUser.passwordHash, user.passwordHash)) return null;
        if (!passwordMatches) return null;
        await tx.internalUser.update({
          where: { id: user.id },
          data: { ...clearLoginFailures(), lastLoginAt: new Date() },
        });
        await createInternalSessionInTransaction(tx, user.id, sessionToken);
        return user;
      },
      { isolationLevel: "Serializable" },
    );
  } catch {
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  if (!authenticatedUser) {
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  const redirect = authenticatedUser.mustChangePassword
    ? "/change-password"
    : authenticatedUser.role === "ADMIN"
      ? "/admin/clientes"
      : "/assistente";

  const res = NextResponse.json({
    ok: true,
    kind: "platform" as const,
    role: authenticatedUser.role,
    mustChangePassword: authenticatedUser.mustChangePassword,
    redirect,
  });
  setInternalSessionCookie(res, sessionToken);
  return res;
}
