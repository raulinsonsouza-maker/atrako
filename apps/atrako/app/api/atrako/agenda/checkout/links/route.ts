import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWorkspace, jsonError } from "@/lib/agenda/api";
import { slugify } from "@/lib/criar/slug";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const ws = await requireWorkspace(workspaceId);
  if ("error" in ws) return ws.error;

  const links = await prisma.agendaCheckoutLink.findMany({
    where: { product: { clienteId: ws.workspaceId } },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, title: true, priceCents: true, productKind: true } },
    },
  });
  return NextResponse.json({ links });
}

const createSchema = z.object({
  workspaceId: z.string().min(1),
  productId: z.string().min(1),
  title: z.string().optional(),
  slug: z.string().optional(),
});

async function uniqueLinkSlug(base: string) {
  let slug = base.slice(0, 100) || `link-${randomBytes(4).toString("hex")}`;
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.agendaCheckoutLink.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${randomBytes(3).toString("hex")}`.slice(0, 120);
  }
  return `${base}-${Date.now()}`.slice(0, 120);
}

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

    const product = await prisma.agendaProduct.findFirst({
      where: { id: body.productId, clienteId: ws.workspaceId },
    });
    if (!product) return jsonError("Produto não encontrado", 404);

    const base = slugify(body.slug || body.title || product.title) || "checkout";
    const slug = await uniqueLinkSlug(base);

    const link = await prisma.agendaCheckoutLink.create({
      data: {
        productId: product.id,
        slug,
        title: body.title?.trim() || product.title,
        isActive: true,
      },
    });
    return NextResponse.json({ link }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Dados inválidos");
    console.error(e);
    return jsonError("Erro ao criar link", 500);
  }
}
