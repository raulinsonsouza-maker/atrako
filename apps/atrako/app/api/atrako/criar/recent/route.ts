import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { listCaptureForms } from "@/lib/modules/capture-form";
import { prisma } from "@/lib/db";
import { publicPath } from "@/lib/criar/slug";

async function safeList<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const workspace = await prisma.cliente.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  });

  const [forms, products, services, coupons, metaDrafts] = await Promise.all([
    listCaptureForms(workspaceId).catch(() => []),
    safeList(() =>
      prisma.commerceProduct.findMany({
        where: { clienteId: workspaceId, active: true },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { _count: { select: { orders: true } } },
      }),
    ),
    safeList(async () => {
      if (!("agendaService" in prisma) || !prisma.agendaService) return [];
      return prisma.agendaService.findMany({
        where: { clienteId: workspaceId, active: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    }),
    safeList(async () => {
      if (!("commerceCoupon" in prisma) || !prisma.commerceCoupon) return [];
      return prisma.commerceCoupon.findMany({
        where: { clienteId: workspaceId, active: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    }),
    safeList(async () => {
      if (!("metaCampaignDraft" in prisma) || !prisma.metaCampaignDraft) return [];
      return prisma.metaCampaignDraft.findMany({
        where: { clienteId: workspaceId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, name: true, status: true, createdAt: true },
      });
    }),
  ]);

  const bookingPath = workspace?.slug ? `/b/${workspace.slug}` : "/agenda";

  const items = [
    ...products.map((p) => ({
      id: p.id,
      kind: "oferta" as const,
      name: p.name,
      slug: p.slug,
      status: p.status,
      path: publicPath("oferta", p.slug),
      metricLabel: "pedidos",
      metricValue: p._count.orders,
      createdAt: p.createdAt.toISOString(),
    })),
    ...forms.map((f) => ({
      id: f.id,
      kind: "formulario" as const,
      name: f.name,
      slug: f.slug,
      status: f.status,
      path: publicPath("formulario", f.slug),
      metricLabel: "leads",
      metricValue: null as number | null,
      createdAt: f.createdAt.toISOString(),
    })),
    ...services.map((s) => ({
      id: s.id,
      kind: "servico" as const,
      name: s.title,
      slug: workspace?.slug || "",
      status: "PUBLISHED",
      path: bookingPath,
      metricLabel: "min",
      metricValue: s.durationMinutes,
      createdAt: s.createdAt.toISOString(),
    })),
    ...coupons.map((c) => ({
      id: c.id,
      kind: "cupom" as const,
      name: c.code,
      slug: c.code,
      status: "ACTIVE",
      path: "/commerce",
      metricLabel: "% off",
      metricValue: c.type === "PERCENT" ? c.value : null,
      createdAt: c.createdAt.toISOString(),
    })),
    ...metaDrafts.map((d) => ({
      id: d.id,
      kind: "campanha_meta" as const,
      name: d.name,
      slug: d.id,
      status: d.status,
      path: `/criar/campanha-meta/${d.id}?workspaceId=${workspaceId}`,
      metricLabel: "status",
      metricValue: null as number | null,
      createdAt: d.createdAt.toISOString(),
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({ items });
}
