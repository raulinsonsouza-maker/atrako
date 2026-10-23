import "server-only";
import { prisma } from "@/lib/db";
import { classifyVisit } from "./ai-sources";

/** País do visitante pelos headers do proxy/CDN (Cloudflare, Vercel ou `GEO_COUNTRY_HEADER` configurado no Traefik). */
export function countryFromHeaders(h: Headers): string | null {
  const custom = process.env.GEO_COUNTRY_HEADER?.trim().toLowerCase();
  for (const name of [custom, "cf-ipcountry", "x-vercel-ip-country", "x-country-code", "x-geoip-country"]) {
    if (!name) continue;
    const v = h.get(name)?.trim().toUpperCase();
    if (v && /^[A-Z]{2}$/.test(v) && v !== "XX") return v;
  }
  return null;
}

/** Registra acesso relevante (crawler, IA, busca, referral). Navegação interna é ignorada. Nunca lança. */
export async function recordGeoHit(input: {
  host: string;
  clienteId?: string | null;
  path: string;
  headers: Headers;
  referrer?: string | null;
  utmSource?: string | null;
  sessionId?: string | null;
}) {
  const userAgent = input.headers.get("user-agent");
  const referrer = input.referrer ?? input.headers.get("referer");
  const visit = classifyVisit({ userAgent, referrer, utmSource: input.utmSource, ownHost: input.host });
  if (!visit) return null;
  // Prefetch/RSC do próprio Next não é visita.
  if (visit.kind !== "crawler" && (input.headers.get("rsc") || input.headers.get("next-router-prefetch"))) return null;
  try {
    return await prisma.geoHit.create({
      data: {
        clienteId: input.clienteId ?? null,
        host: input.host.slice(0, 255),
        kind: visit.kind,
        source: visit.source,
        botType: visit.botType ?? null,
        path: input.path.slice(0, 500),
        country: countryFromHeaders(input.headers),
        referrer: referrer?.slice(0, 500) ?? null,
        utmSource: input.utmSource?.slice(0, 120) ?? null,
        sessionId: input.sessionId?.slice(0, 64) ?? null,
        userAgent: userAgent?.slice(0, 300) ?? null,
      },
      select: { id: true },
    });
  } catch (err) {
    console.warn("[geo] hit", err instanceof Error ? err.message : err);
    return null;
  }
}
