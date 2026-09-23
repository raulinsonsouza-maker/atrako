import { NextRequest, NextResponse } from "next/server";
import { fetchCreativePreview, type MetaAdPreviewFormat } from "@/lib/meta/metaClient";
import { getIntegrationsConfig } from "@/lib/config/integrations";

const VALID_AD_FORMATS: MetaAdPreviewFormat[] = [
  "DESKTOP_FEED_STANDARD",
  "MOBILE_FEED_STANDARD",
  "INSTAGRAM_EXPLORE_GRID_HOME",
  "INSTAGRAM_SEARCH_CHAIN",
  "FACEBOOK_STORY_MOBILE",
  "RIGHT_COLUMN_STANDARD",
];

export async function GET(request: NextRequest) {
  const creativeId = request.nextUrl.searchParams.get("creativeId");
  const adId = request.nextUrl.searchParams.get("adId");
  const adFormatParam = request.nextUrl.searchParams.get("adFormat") ?? "DESKTOP_FEED_STANDARD";

  const id = creativeId ?? adId;
  if (!id) {
    return NextResponse.json(
      { error: "creativeId ou adId é obrigatório" },
      { status: 400 }
    );
  }

  const adFormat = VALID_AD_FORMATS.includes(adFormatParam as MetaAdPreviewFormat)
    ? (adFormatParam as MetaAdPreviewFormat)
    : "DESKTOP_FEED_STANDARD";

  const fromDb = await getIntegrationsConfig();
  const token = fromDb.metaAccessToken ?? process.env.META_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "META_ACCESS_TOKEN não configurado" },
      { status: 503 }
    );
  }

  try {
    const body = await fetchCreativePreview(id, token, adFormat);
    if (!body) {
      return NextResponse.json(
        { error: "Prévia não disponível para este criativo" },
        { status: 404 }
      );
    }
    return NextResponse.json({ body });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
