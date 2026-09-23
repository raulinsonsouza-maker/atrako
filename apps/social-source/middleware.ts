import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SYMBIUS_SESSION_COOKIE } from "@/lib/symbius/session-token";

const FLOW_HOST =
  process.env.SYMBIUS_FLOW_HOST ?? "flow.symbius.com.br";
const CENTRAL_HOST =
  process.env.SYMBIUS_CENTRAL_HOST ?? "central.symbius.com.br";

const SYMBIUS_APP_PREFIX = "/app";
const SYMBIUS_PUBLIC = ["/login", "/signup", "/pricing"];

const FLOW_ONLY_PREFIXES = [
  "/signup",
  "/login",
  "/pricing",
  "/app",
];

const CENTRAL_ONLY_PREFIXES = [
  "/clientes",
  "/admin",
  "/gestao",
  "/planejamento",
  "/portal",
];

function hostnameOf(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host")?.split(":")[0] ??
    ""
  ).toLowerCase();
}

function isFlowHost(host: string): boolean {
  return host === FLOW_HOST || host.startsWith("flow.");
}

function isCentralHost(host: string): boolean {
  return host === CENTRAL_HOST || host.startsWith("central.");
}

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function crossRedirect(
  request: NextRequest,
  targetHost: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.host = targetHost;
  url.protocol = "https:";
  url.port = "";
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = hostnameOf(request);

  // Integração Atrako: shell embute o Social sem login próprio em ambiente local.
  if (process.env.ATRAKO_EMBED_OPEN === "true" && pathname.startsWith(SYMBIUS_APP_PREFIX)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Host-based product split (production domains)
  if (isCentralHost(host)) {
    if (pathname === "/" || pathname === "") {
      return NextResponse.redirect(new URL("/clientes", request.url));
    }
    if (startsWithAny(pathname, FLOW_ONLY_PREFIXES)) {
      return crossRedirect(request, FLOW_HOST);
    }
  }

  if (isFlowHost(host)) {
    if (startsWithAny(pathname, CENTRAL_ONLY_PREFIXES)) {
      return crossRedirect(request, CENTRAL_HOST);
    }
  }

  // Symbius app auth
  if (pathname.startsWith(SYMBIUS_APP_PREFIX)) {
    const isPublicApp =
      SYMBIUS_PUBLIC.some((p) => pathname === p) ||
      pathname.startsWith("/app/api");

    if (!isPublicApp) {
      const token = request.cookies.get(SYMBIUS_SESSION_COOKIE)?.value;
      if (!token) {
        const login = new URL("/login", request.url);
        login.searchParams.set("next", pathname);
        return NextResponse.redirect(login);
      }

      const session = await verifySessionToken(token);
      if (!session) {
        const login = new URL("/login", request.url);
        login.searchParams.set("next", pathname);
        const res = NextResponse.redirect(login);
        res.cookies.delete(SYMBIUS_SESSION_COOKIE);
        return res;
      }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/signup",
    "/signup/:path*",
    "/login",
    "/login/:path*",
    "/pricing",
    "/pricing/:path*",
    "/app/:path*",
    "/clientes",
    "/clientes/:path*",
    "/admin",
    "/admin/:path*",
    "/gestao",
    "/gestao/:path*",
    "/planejamento",
    "/planejamento/:path*",
    "/portal",
    "/portal/:path*",
  ],
};
