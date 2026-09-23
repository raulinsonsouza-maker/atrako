import { NextRequest, NextResponse } from "next/server";
import { resolveMetaCredentials } from "@/lib/config/resolveIntegracao";

const GRAPH = "https://graph.facebook.com/v19.0";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; adsetId: string }> },
) {
  const { id: clienteId, adsetId } = await params;

  const creds = await resolveMetaCredentials(clienteId);
  if (!creds?.token) {
    return NextResponse.json({ error: "Sem credenciais Meta configuradas" }, { status: 401 });
  }

  const fields = [
    "name",
    "status",
    "effective_status",
    "optimization_goal",
    "billing_event",
    "bid_strategy",
    "bid_amount",
    "daily_budget",
    "lifetime_budget",
    "start_time",
    "end_time",
    "targeting",
    "promoted_object",
    "campaign{name,objective,status}",
  ].join(",");

  try {
    const url = `${GRAPH}/${adsetId}?fields=${encodeURIComponent(fields)}&access_token=${creds.token}`;
    const r = await fetch(url);
    const data = await r.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Erro ao consultar Meta API" }, { status: 500 });
  }
}
