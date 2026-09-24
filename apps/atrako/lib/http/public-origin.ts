/**
 * Origem pública da app atrás de proxy (Traefik/Swarm).
 * `req.nextUrl.origin` vira o bind local (ex.: https://0.0.0.0:5000) — inválido no browser.
 */

const BIND_HOST = /^(0\.0\.0\.0|localhost|127\.0\.0\.1)(:\d+)?$/i;

function envPublicOrigin(): string | null {
  for (const key of ["APP_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"] as const) {
    const raw = process.env[key]?.trim().replace(/\/$/, "");
    if (!raw || !/^https?:\/\//i.test(raw)) continue;
    try {
      if (!BIND_HOST.test(new URL(raw).host)) return raw;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function getPublicOrigin(req: {
  headers: Headers;
  nextUrl: { origin: string };
}): string {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(",")[0]
    .trim();
  if (host && !BIND_HOST.test(host)) {
    const proto = (req.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
    return `${proto}://${host}`;
  }

  const fromEnv = envPublicOrigin();
  if (fromEnv) return fromEnv;

  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}`;
  }

  return req.nextUrl.origin;
}
