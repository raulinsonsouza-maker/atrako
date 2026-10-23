import { headers } from "next/headers";
import { publicSiteForRequest } from "@/lib/geo-hub/request";
import { appRobots, lpRobots, TEXT_HEADERS } from "@/lib/geo-hub/public-files";
import { recordGeoHit } from "@/lib/geo-hub/hits";

export const dynamic = "force-dynamic";

export async function GET() {
  const { lp, site } = await publicSiteForRequest();
  if (!lp) return new Response(appRobots(), { headers: TEXT_HEADERS });
  void recordGeoHit({ host: lp.canonicalHost, clienteId: site?.clienteId, path: "/robots.txt", headers: await headers() });
  return new Response(lpRobots(`https://${lp.canonicalHost}`, Boolean(site)), { headers: TEXT_HEADERS });
}
