import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/requestSecurity";
import {
  clearMemberSessionCookie,
  revokeMemberSession,
  MEMBER_SESSION_COOKIE,
} from "@/lib/tenancy/memberAuth";
import { WORKSPACE_COOKIE } from "@/lib/tenancy/workspace";

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const token = request.cookies.get(MEMBER_SESSION_COOKIE)?.value;
  await revokeMemberSession(token);
  const res = NextResponse.json({ ok: true });
  clearMemberSessionCookie(res);
  res.cookies.set(WORKSPACE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
