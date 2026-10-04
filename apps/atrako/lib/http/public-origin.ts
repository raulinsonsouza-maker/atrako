/**
 * Origem pública da app atrás de proxy (Traefik/Swarm).
 * `req.nextUrl.origin` vira o bind local (ex.: https://0.0.0.0:5000) — inválido no browser.
 */

/** Host que o browser realmente usa (dev local). Não substituir por APP_URL. */
const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/i;
/** Bind do container — inválido como redirect OAuth. */
const UNSPECIFIED_BIND = /^(0\.0\.0\.0)(:\d+)?$/i;

function envPublicOrigin(): string | null {
  for (const key of ["APP_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"] as const) {
    const raw = process.env[key]?.trim().replace(/\/$/, "");
    if (!raw || !/^https?:\/\//i.test(raw)) continue;
    try {
      const host = new URL(raw).host;
      if (!LOOPBACK_HOST.test(host) && !UNSPECIFIED_BIND.test(host)) return raw;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Origem pública sem request (cron/jobs): links de e-mail, /r e /u. */
export function getServerPublicOrigin(): string {
  return (
    envPublicOrigin() ||
    process.env.APP_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function getPublicOrigin(req: {
  headers: Headers;
  nextUrl: { origin: string };
}): string {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(",")[0]
    .trim();

  // Dev em localhost: o callback OAuth tem que voltar para o mesmo processo
  // que gravou o state. APP_URL de produção quebrava o "Conectar" da Meta.
  if (host && LOOPBACK_HOST.test(host)) {
    const proto = (req.headers.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
    return `${proto}://${host}`;
  }

  if (host && !UNSPECIFIED_BIND.test(host)) {
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
