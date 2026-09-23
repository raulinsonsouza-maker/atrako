import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/requestSecurity";
import {
  clearInternalSessionCookie,
  internalAuthCookieName,
  revokeInternalSession,
} from "@/lib/internalUsers";

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const token = request.cookies.get(internalAuthCookieName())?.value;
  await revokeInternalSession(token);
  const response = NextResponse.json({ ok: true });
  clearInternalSessionCookie(response);
  return response;
}