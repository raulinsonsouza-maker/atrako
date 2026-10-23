import { headers } from "next/headers";
import { publicSiteForRequest } from "@/lib/geo-hub/request";
import { sitemapXml } from "@/lib/geo-hub/public-files";
import { recordGeoHit } from "@/lib/geo-hub/hits";

export const dynamic = "force-dynamic";

export async function GET() {
  const { site } = await publicSiteForRequest();
  if (!site) return new Response("Not found", { status: 404 });
  void recordGeoHit({ host: site.host, clienteId: site.clienteId, path: "/sitemap.xml", headers: await headers() });
  return new Response(await sitemapXml(site), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
