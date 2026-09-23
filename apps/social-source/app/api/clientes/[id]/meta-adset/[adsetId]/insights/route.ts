import { NextRequest, NextResponse } from "next/server";
import { resolveMetaCredentials } from "@/lib/config/resolveIntegracao";

const GRAPH = "https://graph.facebook.com/v19.0";

type MetaAction = { action_type: string; value: string };
type MetaRow = {
  date_start?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  actions?: MetaAction[];
  age?: string;
  gender?: string;
  region?: string;
  device_platform?: string;
  publisher_platform?: string;
};

function extractLeads(actions?: MetaAction[]): number {
  if (!actions) return 0;
  for (const t of ["lead", "onsite_conversion.lead_grouped", "leadgen_grouped"]) {
    const found = actions.find((a) => a.action_type === t);
    if (found) return Number(found.value);
  }
  return 0;
}

async function fetchBreakdown(
  adsetId: string,
  token: string,
  base: Record<string, string>,
  extra: Record<string, string>,
): Promise<MetaRow[]> {
  const params = new URLSearchParams({ ...base, ...extra, access_token: token });
  const r = await fetch(`${GRAPH}/${adsetId}/insights?${params}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return (d.data ?? []) as MetaRow[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; adsetId: string }> },
) {
  const { id: clienteId, adsetId } = await params;
  const sp = new URL(req.url).searchParams;
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");

  const creds = await resolveMetaCredentials(clienteId);
  if (!creds?.token) {
    return NextResponse.json({ error: "Sem credenciais Meta configuradas" }, { status: 401 });
  }

  const base: Record<string, string> = {};
  if (dateFrom && dateTo) {
    base.time_range = JSON.stringify({ since: dateFrom, until: dateTo });
  } else {
    base.date_preset = "last_30_days";
  }

  try {
    const [daily, demo, regionRaw, deviceRaw, platformRaw] = await Promise.all([
      fetchBreakdown(adsetId, creds.token, base, {
        fields: "date_start,impressions,clicks,spend,actions",
        time_increment: "1",
      }),
      fetchBreakdown(adsetId, creds.token, base, {
        fields: "impressions,spend,actions",
        breakdowns: "age,gender",
      }),
      fetchBreakdown(adsetId, creds.token, base, {
        fields: "impressions,spend,actions",
        breakdowns: "region",
      }),
      fetchBreakdown(adsetId, creds.token, base, {
        fields: "impressions,spend,actions",
        breakdowns: "device_platform",
      }),
      fetchBreakdown(adsetId, creds.token, base, {
        fields: "impressions,spend,actions",
        breakdowns: "publisher_platform",
      }),
    ]);

    const region = regionRaw
      .map((d) => ({
        region: d.region ?? "Desconhecido",
        leads: extractLeads(d.actions),
        spend: Number(d.spend ?? 0),
        impressions: Number(d.impressions ?? 0),
      }))
      .sort((a, b) => b.leads - a.leads || b.spend - a.spend)
      .slice(0, 12);

    return NextResponse.json({
      daily: daily.map((d) => ({
        date: d.date_start ?? "",
        leads: extractLeads(d.actions),
        spend: Number(d.spend ?? 0),
        impressions: Number(d.impressions ?? 0),
        clicks: Number(d.clicks ?? 0),
      })),
      demo: demo.map((d) => ({
        age: d.age ?? "",
        gender: d.gender ?? "",
        leads: extractLeads(d.actions),
        spend: Number(d.spend ?? 0),
        impressions: Number(d.impressions ?? 0),
      })),
      region,
      device: deviceRaw.map((d) => ({
        device: d.device_platform ?? "Desconhecido",
        leads: extractLeads(d.actions),
        spend: Number(d.spend ?? 0),
        impressions: Number(d.impressions ?? 0),
      })),
      platform: platformRaw
        .map((d) => ({
          platform: d.publisher_platform ?? "Desconhecido",
          leads: extractLeads(d.actions),
          spend: Number(d.spend ?? 0),
          impressions: Number(d.impressions ?? 0),
        }))
        .sort((a, b) => b.spend - a.spend),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao consultar Meta API";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
