import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCookieCache } from "better-auth/cookies";

const publicPaths = ["/auth", "/api/auth", "/api/invites/accept", "/api/webhooks"];
const protectedPaths = ["/dashboard", "/super-admin"];
const SESSION_CACHE_TTL = 5000;

function isPublic(pathname: string): boolean {
  if (pathname === "/" || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return true;
  return publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isProtected(pathname: string): boolean {
  return protectedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isProtectedApi(pathname: string): boolean {
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/invites/accept") || pathname.startsWith("/api/webhooks")) return false;
  return pathname.startsWith("/api/");
}

async function getSessionData(req: NextRequest): Promise<{ user?: unknown; session?: unknown } | null> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return null;

  try {
    const cached = await getCookieCache(req.headers, {
      secret,
      cookiePrefix: "better-auth",
      cookieName: "session_data",
      isSecure: req.nextUrl.protocol === "https:",
    });
    if (cached?.session && cached?.user) {
      return { user: cached.user, session: cached.session };
    }
  } catch {
    /* getCookieCache pode falhar em Edge ou cookie inválido, usa fetch */
  }

  const base = req.nextUrl.origin;
  const cookie = req.headers.get("cookie") || "";

  const cookieHash = cookie.length > 0 ? String(cookie.length) + cookie.slice(0, 40) : "none";
  const cacheUrl = `${base}/_mw_session_${encodeURIComponent(cookieHash)}`;

  try {
    const cache = await caches.open("middleware-session");
    const cached = await cache.match(cacheUrl);
    if (cached) {
      const { data, exp } = (await cached.json()) as { data: { user?: unknown; session?: unknown }; exp: number };
      if (exp > Date.now()) return data;
      await cache.delete(cacheUrl);
    }
  } catch {
    /* Cache API pode não estar disponível */
  }

  const res = await fetch(`${base}/api/auth/get-session`, {
    headers: { cookie },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!data?.user) return null;

  try {
    const cache = await caches.open("middleware-session");
    await cache.put(
      cacheUrl,
      new Response(
        JSON.stringify({
          data: { user: data.user, session: data.session },
          exp: Date.now() + SESSION_CACHE_TTL,
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    );
  } catch {
    /* ignora erro de cache */
  }

  return { user: data.user, session: data.session };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Integração Atrako: shell embute o CRM sem login próprio em ambiente local.
  if (process.env.ATRAKO_EMBED_OPEN === "true") {
    return NextResponse.next();
  }

  if (isPublic(pathname)) return NextResponse.next();

  if (isProtected(pathname) || isProtectedApi(pathname)) {
    const data = await getSessionData(req);

    if (!data?.user) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
      }
      const login = new URL("/auth/login", req.url);
      login.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(login);
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-session-data", JSON.stringify({ user: data.user, session: data.session }));
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
