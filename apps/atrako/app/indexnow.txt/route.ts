import { publicSiteForRequest } from "@/lib/geo-hub/request";
import { TEXT_HEADERS } from "@/lib/geo-hub/public-files";

export const dynamic = "force-dynamic";

/** Arquivo de verificação do IndexNow (enviado como `keyLocation`). */
export async function GET() {
  const { site } = await publicSiteForRequest();
  if (!site?.indexNowKey) return new Response("Not found", { status: 404 });
  return new Response(site.indexNowKey, { headers: TEXT_HEADERS });
}
