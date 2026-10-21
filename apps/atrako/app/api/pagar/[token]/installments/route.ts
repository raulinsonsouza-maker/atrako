import { NextRequest, NextResponse } from "next/server";
import { publicPaymentLinkInstallments } from "@/lib/crm/payment-links";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const bin = (request.nextUrl.searchParams.get("bin") ?? "").replace(/\D/g, "").slice(0, 8);
  try {
    return NextResponse.json(await publicPaymentLinkInstallments(token, bin));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sem parcelas para este cartão." },
      { status: 400 },
    );
  }
}
