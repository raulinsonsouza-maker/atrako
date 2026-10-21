import { NextRequest, NextResponse } from "next/server";
import { gate } from "@/lib/flows/api";
import { parsePeriod } from "@/lib/atendimento/period";
import { getAtendimentoFinance } from "@/lib/atendimento/finance";

export async function GET(request: NextRequest) {
  const g = await gate(request, "operate");
  if (!g.ok) return g.response;
  const period = parsePeriod(request.nextUrl.searchParams);
  return NextResponse.json(await getAtendimentoFinance(g.workspaceId, period));
}
