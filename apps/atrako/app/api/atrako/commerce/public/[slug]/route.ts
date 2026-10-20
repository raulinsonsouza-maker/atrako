import { NextRequest, NextResponse } from "next/server";
import { loadPublicStoreCatalog } from "@/lib/commerce/public-catalog";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const catalog = await loadPublicStoreCatalog(slug);
    if (!catalog) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(catalog);
  } catch (err) {
    console.error("[commerce/public]", err);
    return NextResponse.json(
      {
        error: "internal",
        message: err instanceof Error ? err.message : "Falha ao carregar a loja",
      },
      { status: 500 },
    );
  }
}
