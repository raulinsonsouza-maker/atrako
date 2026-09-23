import { NextResponse } from "next/server";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MACHINE_ORIGIN_EXEMPTIONS = new Set([
  "/api/sync/daily-global",
  "/api/sync/meta",
  "/api/sync/google-ads",
  "/api/sync/analytics",
  "/api/webhooks/whatsapp",
  "/api/webhooks/meta",
  "/api/atrako/commerce/webhook",
]);
const QUERY_TOKEN_MACHINE_ROUTES = new Set([
  "/api/sync/meta",
  "/api/sync/google-ads",
  "/api/sync/analytics",
]);

function isCanonicalIp(value: string): boolean {
  if (/^[0-9a-f:]+$/i.test(value) && value.includes(":")) return true;
  const octets = value.split(".");
  return octets.length === 4 && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

/**
 * Central policy used by middleware. Automation exemptions are exact,
 * token-validated routes only; all cookie-auth browser APIs remain protected.
 */
export function hasMachineCredential(pathname: string, request: Request): boolean {
  if (!MACHINE_ORIGIN_EXEMPTIONS.has(pathname)) return false;
  // Webhooks Meta/WhatsApp/MP: assinatura validada na rota; sem Origin de browser
  if (pathname.startsWith("/api/webhooks/") || pathname.endsWith("/webhook")) {
    return true;
  }
  if (request.headers.get("x-cron-token")?.trim()) return true;
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ") && authorization.slice(7).trim()) return true;
  if (QUERY_TOKEN_MACHINE_ROUTES.has(pathname)) {
    try {
      return Boolean(new URL(request.url).searchParams.get("token")?.trim());
    } catch {
      return false;
    }
  }
  return false;
}

export function shouldRequireSameOrigin(
  pathname: string,
  method: string,
  production: boolean,
  request?: Request,
): boolean {
  return production
    && pathname.startsWith("/api/")
    && isUnsafeMethod(method)
    && !(request && hasMachineCredential(pathname, request));
}

export function isMachineOriginExemption(pathname: string): boolean {
  return MACHINE_ORIGIN_EXEMPTIONS.has(pathname);
}

/** Trust forwarded client addresses only when running behind Replit's proxy. */
export function getTrustedClientIp(request: Request): string | null {
  const replitProxy = process.env.REPLIT_DEPLOYMENT === "1"
    || process.env.REPLIT_DEPLOYMENT === "true"
    || process.env.REPLIT_PROXY === "true";
  if (!replitProxy) return null;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  const candidate = forwarded || real;
  if (!candidate) return null;
  const withoutPort = candidate.startsWith("[")
    ? candidate.slice(1, candidate.indexOf("]"))
    : candidate;
  if (!isCanonicalIp(withoutPort)) return null;
  return withoutPort;
}

/**
 * Require the browser's Origin to match the origin Next received. We do not
 * reconstruct an origin from x-forwarded-* headers: those headers are only
 * trusted when the deployment's proxy has explicitly normalized them.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    if (originUrl.origin === requestUrl.origin) return true;

    // Replit's preview/deployment proxy can preserve the public Host header
    // while Next receives an internal request URL. Comparing Origin to Host is
    // safe here because browsers cannot choose a cross-site request's Host
    // header independently from its destination.
    const host = request.headers.get("host")?.trim().toLowerCase();
    if (!host || originUrl.host.toLowerCase() !== host) return false;
    if (process.env.NODE_ENV === "production" && originUrl.protocol !== "https:") return false;
    return originUrl.protocol === "http:" || originUrl.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Top-level same-origin navigations commonly omit Origin but include
 * Referer. This retains the same-origin guarantee for GET-based OAuth
 * initiation without breaking the administrator's normal link workflow.
 */
export function isSameOriginNavigation(request: Request): boolean {
  // An explicit Origin is authoritative; never let a matching Referer
  // override a mismatched Origin.
  if (request.headers.get("origin")) return isSameOrigin(request);
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/** Return a consistent 403 response for unsafe cross-origin requests. */
export function requireSameOrigin(request: Request): NextResponse | null {
  if (isSameOrigin(request)) return null;
  return NextResponse.json({ error: "Origem da requisição não permitida" }, { status: 403 });
}