import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listMpInstallments } from "@/lib/commerce/mp";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const property = await prisma.stayProperty.findUnique({ where: { slug } });
  if (!property || !property.published) {
    return NextResponse.json({ error: "Imóvel indisponível" }, { status: 404 });
  }
  if (!(await isPublicModuleEnabled(property.clienteId, "hospedagem"))) {
    return NextResponse.json({ error: "Imóvel indisponível" }, { status: 404 });
  }
  const bin = (request.nextUrl.searchParams.get("bin") || "").replace(/\D/g, "").slice(0, 8);
  const amountCents = Number(request.nextUrl.searchParams.get("amount") || 0);
  if (bin.length < 6 || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "Informe o início do cartão." }, { status: 400 });
  }
  try {
    const installments = await listMpInstallments(property.clienteId, bin, amountCents / 100);
    if (!installments.options.length) {
      return NextResponse.json({ error: "Este cartão não tem parcelas disponíveis." }, { status: 422 });
    }
    return NextResponse.json(installments);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Não foi possível consultar as parcelas." },
      { status: 422 },
    );
  }
}
