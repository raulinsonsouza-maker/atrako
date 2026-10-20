import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { listMpInstallments } from "@/lib/commerce/mp";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const store = await prisma.commerceStore.findUnique({ where: { slug } });
  if (!store || !store.published) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!(await isPublicModuleEnabled(store.clienteId, "commerce"))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const bin = request.nextUrl.searchParams.get("bin")?.trim() ?? "";
  const amount = Number(request.nextUrl.searchParams.get("amount") ?? "0");
  if (bin.length < 6 || !(amount > 0)) {
    return NextResponse.json({ error: "bin e amount obrigatórios" }, { status: 400 });
  }
  try {
    const data = await listMpInstallments(store.clienteId, bin.slice(0, 8), amount);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha" },
      { status: 400 },
    );
  }
}
