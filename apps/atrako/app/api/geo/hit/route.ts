import { NextRequest, NextResponse } from "next/server";
import { LP_DOMAINS } from "@/lib/lp-domains";
import { lpDomainWorkspaceId } from "@/lib/geo-hub/lp-workspace";
import { recordGeoHit } from "@/lib/geo-hub/hits";
import { clientIp, rateLimit } from "@/lib/http/rate-limit";

/**
 * Beacon das LPs estáticas dos clientes (`navigator.sendBeacon`): o servidor não vê o
 * `document.referrer`, então a LP manda referrer/UTM e o classificador decide se vale registrar.
 */
export async function POST(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const lp = LP_DOMAINS[host];
  if (!lp) return new NextResponse(null, { status: 204 });
  if (!rateLimit(`hit:${clientIp(request.headers)}`, 30, 60_000)) return new NextResponse(null, { status: 204 });

  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(await request.text()) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const path = str(body.path, 500) ?? "/";

  await recordGeoHit({
    host: lp.canonicalHost,
    clienteId: await lpDomainWorkspaceId(lp.workspaceSlug),
    path: path.startsWith("/") ? path : `/${path}`,
    headers: request.headers,
    referrer: str(body.referrer, 500),
    utmSource: str(body.utm_source, 120),
    sessionId: str(body.sid, 64),
  });
  return new NextResponse(null, { status: 204 });
}
