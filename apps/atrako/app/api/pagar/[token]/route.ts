import { NextRequest, NextResponse } from "next/server";
import { getPublicPaymentLink } from "@/lib/crm/payment-links";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const link = await getPublicPaymentLink(token);
  if (!link) return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });
  return NextResponse.json({ link }, { headers: { "Cache-Control": "no-store" } });
}
