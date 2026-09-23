import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-api";

export async function POST(request: Request) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const body = await request.json();
  const cardEnabled = Boolean(body.cardEnabled);
  const pixEnabled = Boolean(body.pixEnabled);
  const minInstallments = Number(body.minInstallments ?? 1);
  const maxInstallments = Number(body.maxInstallments ?? 12);
  const statementDescriptor = String(body.statementDescriptor ?? "LOJA")
    .slice(0, 13)
    .trim();

  if (!Number.isFinite(minInstallments) || !Number.isFinite(maxInstallments)) {
    return NextResponse.json({ error: "Parcelas inválidas." }, { status: 400 });
  }
  if (minInstallments < 1 || maxInstallments < minInstallments) {
    return NextResponse.json({ error: "Intervalo de parcelas inválido." }, { status: 400 });
  }

  const settings = await prisma.paymentSettings.upsert({
    where: { id: "default" },
    update: {
      cardEnabled,
      pixEnabled,
      minInstallments,
      maxInstallments,
      statementDescriptor: statementDescriptor || "LOJA",
    },
    create: {
      id: "default",
      cardEnabled,
      pixEnabled,
      minInstallments,
      maxInstallments,
      statementDescriptor: statementDescriptor || "LOJA",
    },
  });

  return NextResponse.json(settings);
}
