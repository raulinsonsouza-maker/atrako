import { NextRequest, NextResponse } from "next/server";
import { gate, bad } from "@/lib/flows/api";
import { AD_AUDIENCES, audienceContacts, audienceCsv, type AdAudienceKey } from "@/lib/flows/ads-loop";

export const maxDuration = 60;

/** Públicos para Meta/Google: contagem e exportação CSV (hash SHA-256). */
export async function GET(request: NextRequest) {
  const exportKey = request.nextUrl.searchParams.get("export");
  // Exportação de dados pessoais: só Dono/Admin
  const g = await gate(request, exportKey ? "manage" : "operate");
  if (!g.ok) return g.response;
  const ws = g.workspaceId;

  if (exportKey) {
    const def = AD_AUDIENCES.find((a) => a.key === exportKey);
    if (!def) return bad("Público inválido");
    const rows = await audienceContacts(ws, def.key as AdAudienceKey);
    const csv = audienceCsv(rows, true);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="atrako-publico-${def.key}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const counts = await Promise.all(
    AD_AUDIENCES.map(async (a) => {
      const rows = await audienceContacts(ws, a.key as AdAudienceKey, 100_000);
      return {
        key: a.key,
        label: a.label,
        description: a.description,
        total: rows.length,
        withEmail: rows.filter((r) => r.email).length,
        withPhone: rows.filter((r) => r.phone).length,
      };
    }),
  );
  return NextResponse.json({ audiences: counts });
}
