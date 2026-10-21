import { NextRequest, NextResponse } from "next/server";
import { citiesOfState } from "@/lib/geo/place";

/** Público: municípios de uma UF para formulários (LPs, /f). */
export async function GET(request: NextRequest) {
  const uf = (request.nextUrl.searchParams.get("uf") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) return NextResponse.json({ error: "uf inválida" }, { status: 400 });
  const cidades = citiesOfState(uf);
  if (!cidades.length) return NextResponse.json({ error: "uf não encontrada" }, { status: 404 });
  return NextResponse.json(
    { uf, cidades },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } },
  );
}
