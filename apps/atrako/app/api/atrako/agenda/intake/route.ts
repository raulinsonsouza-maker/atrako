import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspace, jsonError } from "@/lib/agenda/api";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const ws = await requireWorkspace(workspaceId);
  if ("error" in ws) return ws.error;

  const submissions = await prisma.agendaIntakeSubmission.findMany({
    where: { clienteId: ws.workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      checkoutOrder: {
        select: {
          id: true,
          customerName: true,
          customerEmail: true,
          status: true,
          product: { select: { title: true } },
        },
      },
    },
    take: 200,
  });

  const byReview: Record<string, typeof submissions> = {};
  for (const s of submissions) {
    const key = s.reviewStatus || "NEW";
    if (!byReview[key]) byReview[key] = [];
    byReview[key].push(s);
  }

  return NextResponse.json({ submissions, byReview });
}

export async function PATCH(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("JSON inválido");
  }

  const body = raw as { workspaceId?: string; id?: string; reviewStatus?: string };
  const ws = await requireWorkspace(body.workspaceId);
  if ("error" in ws) return ws.error;
  if (!body.id || !body.reviewStatus) return jsonError("id e reviewStatus obrigatórios");

  const updated = await prisma.agendaIntakeSubmission.updateMany({
    where: { id: body.id, clienteId: ws.workspaceId },
    data: { reviewStatus: body.reviewStatus },
  });
  if (updated.count === 0) return jsonError("Não encontrado", 404);
  return NextResponse.json({ ok: true });
}
