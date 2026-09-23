import { NextRequest, NextResponse } from "next/server";
import { fetchCreativePreview, type MetaAdPreviewFormat } from "@/lib/meta/metaClient";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import { InternalAuthError, requireInternalUser } from "@/lib/internalUsers";
import { resolveMetaCredentials } from "@/lib/config/resolveIntegracao";

const VALID_AD_FORMATS: MetaAdPreviewFormat[] = [
  "DESKTOP_FEED_STANDARD",
  "MOBILE_FEED_STANDARD",
  "INSTAGRAM_EXPLORE_GRID_HOME",
  "INSTAGRAM_SEARCH_CHAIN",
  "FACEBOOK_STORY_MOBILE",
  "RIGHT_COLUMN_STANDARD",
];

export async function GET(request: NextRequest) {
  try {
    await requireInternalUser("ADMIN");
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return NextResponse.json({ error: "Acesso de administrador necessário" }, { status: error.status });
    }
    throw error;
  }

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

  const clienteId = request.nextUrl.searchParams.get("clienteId")?.trim();
  let token: string | null = null;
  if (clienteId) {
    const resolved = await resolveMetaCredentials(clienteId);
    token = resolved?.token ?? null;
  }
  if (!token) {
    const fromDb = await getIntegrationsConfig();
    token = fromDb.metaAccessToken ?? process.env.META_ACCESS_TOKEN ?? null;
  }

  if (!token) {
    return NextResponse.json(
      { error: "Meta não conectada (passe clienteId ou configure token legado)" },
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
