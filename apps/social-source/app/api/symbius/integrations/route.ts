import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";
import { ensureApiKey, getOrCreateOrgSettings } from "@/lib/symbius/integrations";
import { getSymbiusAppUrl } from "@/lib/instagram/metaOAuth";

export async function GET() {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const settings = await getOrCreateOrgSettings(session.organizationId);
  const appUrl = getSymbiusAppUrl();
  const snippet = settings.apiKey
    ? `<script>
  window.SYMBIUS_ORG_ID = "${session.organizationId}";
  window.SYMBIUS_API_KEY = "${settings.apiKey}";
  window.SYMBIUS_API_BASE = "${appUrl}";
</script>
<script src="${appUrl}/symbius-tracker.js" async></script>`
    : null;

  return NextResponse.json({
    settings: {
      webhookUrl: settings.webhookUrl,
      webhookEvents: settings.webhookEvents,
      googleSheetId: settings.googleSheetId,
      googleSheetTab: settings.googleSheetTab,
      syncCentralCrm: settings.syncCentralCrm,
      hasApiKey: Boolean(settings.apiKey),
      metaPixelId: settings.metaPixelId,
      hasMetaCapiToken: Boolean(settings.metaCapiToken),
      ga4MeasurementId: settings.ga4MeasurementId,
      hasGa4ApiSecret: Boolean(settings.ga4ApiSecret),
      ecommerceConnectors: settings.ecommerceConnectors ?? {},
    },
    trackingSnippet: snippet,
    organizationId: session.organizationId,
  });
}

const schema = z.object({
  webhookUrl: z.string().url().optional().nullable().or(z.literal("")),
  webhookEvents: z.array(z.string()).optional(),
  googleSheetId: z.string().optional().nullable(),
  googleSheetTab: z.string().optional().nullable(),
  syncCentralCrm: z.boolean().optional(),
  regenerateApiKey: z.boolean().optional(),
  metaPixelId: z.string().optional().nullable(),
  metaCapiToken: z.string().optional().nullable(),
  ga4MeasurementId: z.string().optional().nullable(),
  ga4ApiSecret: z.string().optional().nullable(),
  ecommerceConnectors: z.record(z.unknown()).optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  let apiKey: string | undefined;
  if (parsed.data.regenerateApiKey) {
    apiKey = `sym_${crypto.randomBytes(24).toString("hex")}`;
  }

  const webhookUrl =
    parsed.data.webhookUrl === "" ? null : parsed.data.webhookUrl;

  const existing = await getOrCreateOrgSettings(session.organizationId);
  const prevConnectors =
    (existing.ecommerceConnectors as Record<string, unknown> | null) ?? {};
  const nextConnectors = parsed.data.ecommerceConnectors
    ? {
        ...prevConnectors,
        ...Object.fromEntries(
          Object.entries(parsed.data.ecommerceConnectors).map(([k, v]) => [
            k,
            {
              ...((prevConnectors[k] as object) ?? {}),
              ...(v as object),
            },
          ]),
        ),
      }
    : undefined;

  const settings = await prisma.igOrgSettings.upsert({
    where: { organizationId: session.organizationId },
    create: {
      organizationId: session.organizationId,
      webhookUrl: webhookUrl ?? undefined,
      webhookEvents: parsed.data.webhookEvents ?? [],
      googleSheetId: parsed.data.googleSheetId ?? undefined,
      googleSheetTab: parsed.data.googleSheetTab ?? undefined,
      syncCentralCrm: parsed.data.syncCentralCrm ?? false,
      metaPixelId: parsed.data.metaPixelId ?? undefined,
      metaCapiToken: parsed.data.metaCapiToken ?? undefined,
      ga4MeasurementId: parsed.data.ga4MeasurementId ?? undefined,
      ga4ApiSecret: parsed.data.ga4ApiSecret ?? undefined,
      ecommerceConnectors: (nextConnectors ?? {}) as object,
      apiKey,
    },
    update: {
      webhookUrl: webhookUrl === undefined ? undefined : webhookUrl,
      webhookEvents: parsed.data.webhookEvents,
      googleSheetId: parsed.data.googleSheetId ?? undefined,
      googleSheetTab: parsed.data.googleSheetTab ?? undefined,
      syncCentralCrm: parsed.data.syncCentralCrm,
      metaPixelId: parsed.data.metaPixelId ?? undefined,
      metaCapiToken: parsed.data.metaCapiToken ?? undefined,
      ga4MeasurementId: parsed.data.ga4MeasurementId ?? undefined,
      ga4ApiSecret: parsed.data.ga4ApiSecret ?? undefined,
      ecommerceConnectors: nextConnectors as object | undefined,
      ...(apiKey ? { apiKey } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    apiKey: parsed.data.regenerateApiKey ? settings.apiKey : undefined,
  });
}

export async function POST() {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const apiKey = await ensureApiKey(session.organizationId);
  return NextResponse.json({ apiKey });
}
