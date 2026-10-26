import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin, shouldRequireSameOrigin } from "@/lib/requestSecurity";
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_NAME_PRODUCTION,
  MEMBER_SESSION_COOKIE,
} from "@/lib/authCookieNames";
import {
  GEO_INTERNAL_PREFIX,
  LP_AREA_PATH,
  LP_AREA_TARGET,
  LP_DOMAIN_ALLOWED_PREFIXES,
  LP_DOMAIN_SITE_PAGES,
  LP_DOMAINS,
} from "@/lib/lp-domains";

const PUBLIC_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/change-password",
  "/invite",
  "/portal",
  "/politica-de-privacidade",
  "/termos-de-uso",
  "/exclusao-de-dados",
  "/b/",
  "/c/",
  "/f/",
  "/p/",
  "/cardapio/",
  "/estadia/",
  "/pagar/",
  "/loja/",
  "/checkout",
  "/obrigado",
  "/r/",
  "/u/",
  "/relatorio/",
  "/api/relatorio/",
  "/api/auth/login",
  "/api/auth/session-login",
  "/api/auth/member",
  "/api/webhooks",
  "/api/atrako/commerce/webhook",
  "/api/atrako/commerce/public",
  "/api/atrako/agenda/public",
  "/api/atrako/oauth/",
  "/api/portal",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function hasSessionCookie(request: NextRequest): boolean {
  const internalName =
    process.env.NODE_ENV === "production" ? AUTH_COOKIE_NAME_PRODUCTION : AUTH_COOKIE_NAME;
  return Boolean(
    request.cookies.get(internalName)?.value ||
      request.cookies.get(MEMBER_SESSION_COOKIE)?.value,
  );
}

/** Auth de páginas: shell SaaS e /admin exigem sessão (exceto ATRAKO_DEV_OPEN_ACCESS=1). */
export default function middleware(request: NextRequest) {
  const production = process.env.NODE_ENV === "production";
  if (
    shouldRequireSameOrigin(request.nextUrl.pathname, request.method, production, request) &&
    !isSameOrigin(request)
  ) {
    return NextResponse.json({ error: "Origem da requisição não permitida" }, { status: 403 });
  }

  const { pathname } = request.nextUrl;
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const lp = LP_DOMAINS[host];
  if (lp) {
    // Atrás do Traefik o request chega em http; o domínio público é sempre https.
    const origin = production ? `https://${host}` : `http://${request.headers.get("host")}`;
    const site = `${GEO_INTERNAL_PREFIX}/${lp.canonicalHost}`;
    const rewriteTo = (internal: string) => {
      const target = request.nextUrl.clone();
      target.pathname = internal;
      return NextResponse.rewrite(target);
    };
    if (pathname === "/") return NextResponse.next();
    if (lp.geoBasePath && (pathname === lp.geoBasePath || pathname.startsWith(`${lp.geoBasePath}/`))) {
      return rewriteTo(`${site}/g${pathname.slice(lp.geoBasePath.length)}`);
    }
    if (LP_DOMAIN_SITE_PAGES.includes(pathname)) return rewriteTo(`${site}${pathname}`);
    if (["/robots.txt", "/sitemap.xml", "/llms.txt", "/llms-full.txt", "/indexnow.txt"].includes(pathname)) return NextResponse.next();
    if (pathname.startsWith("/social/flows")) {
      // Reescreve /social/flows/* para a rota interna do app
      return noindex(rewriteTo(pathname));
    }
    if (LP_DOMAIN_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
      return pathname.startsWith("/api/") ? NextResponse.next() : noindex(NextResponse.next());
    }
    if (pathname === LP_AREA_PATH || pathname.startsWith(`${LP_AREA_PATH}/`)) {
      if (!hasSessionCookie(request)) {
        const signIn = new URL("/sign-in", origin);
        signIn.searchParams.set("next", pathname + request.nextUrl.search);
        return noindex(NextResponse.redirect(signIn));
      }
      return noindex(rewriteTo(LP_AREA_TARGET + pathname.slice(LP_AREA_PATH.length)));
    }
    // Endereço inexistente: 404 de verdade (redirecionar para a home vira "soft 404" no Google).
    return rewriteTo(`${site}/404`);
  }

  if (pathname.startsWith(`${GEO_INTERNAL_PREFIX}/`) || APP_NOINDEX_PREFIXES.some((p) => pathname.startsWith(p))) {
    const res = authGate(request);
    return noindex(res);
  }

  return authGate(request);
}

/** Páginas do host do app que nunca devem aparecer em buscadores. */
const APP_NOINDEX_PREFIXES = ["/sign-in", "/sign-up", "/change-password", "/invite", "/pagar/", "/relatorio/", "/portal", "/checkout", "/obrigado", "/u/", "/r/"];

function noindex(res: NextResponse) {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

function authGate(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (process.env.ATRAKO_DEV_OPEN_ACCESS === "1") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // API routes enforce auth in handlers; middleware only gates pages.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(signIn);
  }

  if (pathname.startsWith("/admin")) {
    // Page gate: cookie present; role checked in APIs / layout.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/(.*)"],
};
