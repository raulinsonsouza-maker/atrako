import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";
import { upsertAdSpend } from "@/lib/symbius/attribution/reporting";

const schema = z.object({
  date: z.string().min(1),
  platform: z.string().min(1),
  campaignId: z.string().optional(),
  campaignName: z.string().optional(),
  adsetId: z.string().optional(),
  adsetName: z.string().optional(),
  adId: z.string().optional(),
  adName: z.string().optional(),
  spend: z.number(),
  currency: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const row = await upsertAdSpend({
    organizationId: session.organizationId,
    ...parsed.data,
  });

  return NextResponse.json({ ok: true, id: row.id });
}
