import { headers } from "next/headers";
import { publicSiteForRequest } from "@/lib/geo-hub/request";
import { llmsTxt, TEXT_HEADERS } from "@/lib/geo-hub/public-files";
import { recordGeoHit } from "@/lib/geo-hub/hits";

export const dynamic = "force-dynamic";

export async function GET() {
  const { site } = await publicSiteForRequest();
  if (!site) return new Response("Not found", { status: 404 });
  void recordGeoHit({ host: site.host, clienteId: site.clienteId, path: "/llms.txt", headers: await headers() });
  return new Response(await llmsTxt(site), { headers: TEXT_HEADERS });
}
