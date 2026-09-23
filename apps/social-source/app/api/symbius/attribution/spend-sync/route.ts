import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";
import { upsertAdSpend } from "@/lib/symbius/attribution/reporting";

const schema = z.object({
  date: z.string().min(1),
  since: z.string().optional(),
  until: z.string().optional(),
});

/**
 * Pull simplificado de spend Meta Ads via Marketing API (se houver token na org).
 * Usa o accessToken da primeira IgAccount CONNECTED como fallback de app token
 * quando SYMBIUS_META_ADS_TOKEN não estiver definido.
 */
export async function POST(request: NextRequest) {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const token =
    process.env.SYMBIUS_META_ADS_TOKEN ||
    (
      await prisma.igAccount.findFirst({
        where: {
          organizationId: session.organizationId,
          status: "CONNECTED",
        },
        select: { accessToken: true },
      })
    )?.accessToken;

  if (!token) {
    return NextResponse.json(
      { error: "Sem token Meta Ads. Use o formulário manual de investimento." },
      { status: 400 },
    );
  }

  const adAccountId = process.env.SYMBIUS_META_AD_ACCOUNT_ID;
  if (!adAccountId) {
    return NextResponse.json(
      {
        error:
          "Configure SYMBIUS_META_AD_ACCOUNT_ID ou registre spend manualmente.",
      },
      { status: 400 },
    );
  }

  const since = parsed.data.since ?? parsed.data.date;
  const until = parsed.data.until ?? parsed.data.date;
  const act = adAccountId.startsWith("act_")
    ? adAccountId
    : `act_${adAccountId}`;

  const url = new URL(`https://graph.facebook.com/v21.0/${act}/insights`);
  url.searchParams.set("fields", "campaign_id,campaign_name,spend");
  url.searchParams.set("level", "campaign");
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as {
    data?: Array<{
      campaign_id?: string;
      campaign_name?: string;
      spend?: string;
      date_start?: string;
    }>;
    error?: { message?: string };
  };

  if (!res.ok || json.error) {
    return NextResponse.json(
      {
        error:
          json.error?.message ??
          "Falha ao sincronizar spend da Meta. Use registro manual.",
      },
      { status: 400 },
    );
  }

  let upserted = 0;
  for (const row of json.data ?? []) {
    const spend = Number(row.spend ?? 0);
    if (!Number.isFinite(spend)) continue;
    await upsertAdSpend({
      organizationId: session.organizationId,
      date: row.date_start ?? since,
      platform: "meta",
      campaignId: row.campaign_id ?? "",
      campaignName: row.campaign_name,
      spend,
    });
    upserted += 1;
  }

  return NextResponse.json({ ok: true, upserted });
}
