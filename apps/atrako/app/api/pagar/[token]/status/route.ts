import { NextRequest, NextResponse } from "next/server";
import { refreshPaymentLinkStatus } from "@/lib/crm/payment-links";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const status = await refreshPaymentLinkStatus(token);
  if (!status) return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });
  return NextResponse.json({ status }, { headers: { "Cache-Control": "no-store" } });
}
