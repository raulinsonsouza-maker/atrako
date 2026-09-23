import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWorkspace, jsonError } from "@/lib/agenda/api";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const ws = await requireWorkspace(workspaceId);
  if ("error" in ws) return ws.error;

  const products = await prisma.agendaProduct.findMany({
    where: { clienteId: ws.workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      checkoutLinks: { where: { isActive: true }, select: { id: true, slug: true, title: true } },
    },
  });
  return NextResponse.json({ products });
}

const createSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(2),
  description: z.string().optional(),
  priceCents: z.number().int().min(0).optional(),
  productKind: z.enum(["SIMPLE", "INTAKE"]).optional(),
});

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("JSON inválido");
  }

  try {
    const body = createSchema.parse(raw);
    const ws = await requireWorkspace(body.workspaceId);
    if ("error" in ws) return ws.error;

    const product = await prisma.agendaProduct.create({
      data: {
        clienteId: ws.workspaceId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        priceCents: body.priceCents ?? 0,
        productKind: body.productKind ?? "SIMPLE",
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Dados inválidos");
    console.error(e);
    return jsonError("Erro ao criar produto", 500);
  }
}
