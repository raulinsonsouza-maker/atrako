import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function inferStatusFromStored(
  etapa: string | null,
  dadosCv: Record<string, unknown> | null,
): string {
  const motivo = dadosCv?.motivoCancelamento as string | null;
  const descricao = dadosCv?.descricaoCancelamento as string | null;
  const reserva = dadosCv?.reserva;
  const dataCanc = dadosCv?.dataFechamento as string | null;

  if (motivo || descricao) return "lost";
  if (dataCanc) return "lost";
  if (reserva) return "won";

  const s = (etapa ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    s.includes("venda realizada") ||
    s.includes("contrato") ||
    s.includes("assinado") ||
    s.includes("com reserva") ||
    s.includes("reservado")
  ) return "won";

  if (
    s.includes("perdido") ||
    s.includes("cancelado") ||
    s.includes("descartado") ||
    s.includes("desistiu") ||
    s.includes("sem interesse") ||
    s.includes("nao tem interesse")
  ) return "lost";

  return "ongoing";
}

export async function POST(request: NextRequest) {
  const adminToken = request.headers.get("x-admin-token");
  if (!adminToken || adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leads = await prisma.leadCrm.findMany({
    where: {
      OR: [{ status: null }, { status: "" }],
    },
    select: { id: true, etapa: true, dadosCv: true },
  });

  let updated = 0;
  const batch = 100;

  for (let i = 0; i < leads.length; i += batch) {
    const chunk = leads.slice(i, i + batch);
    await Promise.all(
      chunk.map(async (lead) => {
        const cv =
          lead.dadosCv && typeof lead.dadosCv === "object" && !Array.isArray(lead.dadosCv)
            ? (lead.dadosCv as Record<string, unknown>)
            : null;
        const newStatus = inferStatusFromStored(lead.etapa, cv);
        await prisma.leadCrm.update({
          where: { id: lead.id },
          data: { status: newStatus },
        });
        updated++;
      }),
    );
  }

  return NextResponse.json({ ok: true, total: leads.length, updated });
}
