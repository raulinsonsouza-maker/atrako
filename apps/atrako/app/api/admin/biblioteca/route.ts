import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { sectionScore } from "@/lib/criar/lp-library/score";

export async function GET(req: Request) {
  const authz = await requireInternalAdmin();
  if (authz.response) return authz.response;
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "";
  const kind = url.searchParams.get("kind") || "";
  const rows = await prisma.lpLibrarySection.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(kind ? { kind } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
    include: { sourceCliente: { select: { nome: true } } },
  });
  return NextResponse.json({
    rows: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      goal: row.goal,
      html: row.html,
      css: row.css,
      fx: row.fx,
      tags: row.tags,
      status: row.status,
      score: row.score,
      uses: row.uses,
      origem: row.sourceCliente.nome,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: Request) {
  const authz = await requireInternalAdmin();
  if (authz.response) return authz.response;
  const body = (await req.json().catch(() => null)) as { id?: string; status?: string; tags?: string[] } | null;
  const id = body?.id?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Informe a seção." }, { status: 400 });
  const current = await prisma.lpLibrarySection.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Seção não encontrada." }, { status: 404 });
  const status = body?.status;
  if (status && status !== "candidate" && status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean).slice(0, 12)
    : undefined;
  const nextStatus = status ?? current.status;
  const updated = await prisma.lpLibrarySection.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(tags ? { tags } : {}),
      score: sectionScore({
        published: true,
        issueCount: 0,
        edits: 0,
        conversionRate: null,
        uses: current.uses,
        approved: nextStatus === "approved",
      }),
    },
  });
  return NextResponse.json({ id: updated.id, status: updated.status, tags: updated.tags, score: updated.score });
}
