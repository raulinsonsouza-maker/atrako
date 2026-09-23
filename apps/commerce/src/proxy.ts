import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Camada extra nas rotas admin (páginas + APIs).
 * A verificação fina de role continua em layout/requireAdminApi.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith("/admin");

  if (!isAdminApi && !isAdminPage) {
    return NextResponse.next();
  }

  // Integração Atrako: shell embute o Commerce sem login próprio em ambiente local.
  if (process.env.ATRAKO_EMBED_OPEN === "true") {
    return NextResponse.next();
  }

  const secureCookie =
    request.nextUrl.protocol === "https:" ||
    process.env.NODE_ENV === "production";

  // Auth.js v5: cookie __Secure-authjs.session-token em HTTPS
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie,
    salt: secureCookie
      ? "__Secure-authjs.session-token"
      : "authjs.session-token",
  });

  if (!token || token.role !== "ADMIN") {
    if (isAdminApi) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
