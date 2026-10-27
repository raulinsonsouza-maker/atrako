import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";

/** Checkouts e vitrine já criados no workspace, para o botão da automação. */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;

  const [store, checkouts] = await Promise.all([
    prisma.commerceStore.findUnique({
      where: { clienteId: workspaceId },
      select: { slug: true, name: true, published: true },
    }),
    prisma.agendaCheckoutLink.findMany({
      where: { isActive: true, product: { clienteId: workspaceId, isActive: true } },
      select: { slug: true, title: true, product: { select: { title: true } } },
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const links: Array<{ label: string; path: string }> = [];
  if (store?.published) {
    links.push({ label: `Loja · ${store.name}`, path: `/loja/${store.slug}` });
  }
  for (const checkout of checkouts) {
    links.push({
      label: `Checkout · ${checkout.title || checkout.product.title}`,
      path: `/c/${checkout.slug}`,
    });
  }

  return NextResponse.json({ links });
}
