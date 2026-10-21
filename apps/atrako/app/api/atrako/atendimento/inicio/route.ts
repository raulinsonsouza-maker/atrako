import { NextRequest, NextResponse } from "next/server";
import { gate } from "@/lib/flows/api";
import { parsePeriod } from "@/lib/atendimento/period";
import { getInicio } from "@/lib/atendimento/inicio";

export async function GET(request: NextRequest) {
  const g = await gate(request, "operate");
  if (!g.ok) return g.response;
  return NextResponse.json(await getInicio(g.workspaceId, parsePeriod(request.nextUrl.searchParams)));
}
