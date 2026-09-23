import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/authSecurity";
import { requireSameOrigin } from "@/lib/requestSecurity";
import {
  createMemberSession,
  findMemberByEmailWithPassword,
  setMemberSessionCookie,
} from "@/lib/tenancy/memberAuth";
import { listMemberWorkspaceIds, WORKSPACE_COOKIE } from "@/lib/tenancy/workspace";

const GENERIC = "E-mail ou senha inválidos.";

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  const member = await findMemberByEmailWithPassword(email);
  if (!member?.passwordHash) {
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }
  const ok = await verifyPassword(password, member.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  const token = await createMemberSession(member.id);
  const workspaces = await listMemberWorkspaceIds(member.email);
  const res = NextResponse.json({ ok: true, email: member.email, workspaces });
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
