import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin, shouldRequireSameOrigin } from "@/lib/requestSecurity";

/** Auth de páginas desligada — Atrako opera aberto no shell. */
export default function middleware(request: NextRequest) {
  const production = process.env.NODE_ENV === "production";
  if (
    shouldRequireSameOrigin(request.nextUrl.pathname, request.method, production, request) &&
    !isSameOrigin(request)
  ) {
    return NextResponse.json({ error: "Origem da requisição não permitida" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/(.*)"],
};
