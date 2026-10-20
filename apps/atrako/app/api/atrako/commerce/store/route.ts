import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { ensureCommerceStore } from "@/lib/commerce/store";
import { asStoreBanners } from "@/lib/commerce/banners";
import { asStoreTheme } from "@/lib/commerce/theme";
import { asShippingRules, defaultShippingRules } from "@/lib/commerce/shipping";
import { resolveMercadoPago } from "@/lib/config/resolveConnection";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "commerce");
  if (moduleOff) return moduleOff;

  const store = await ensureCommerceStore(workspaceId);
  const full = await prisma.commerceStore.findUnique({
    where: { id: store.id },
    include: {
      categories: { orderBy: { sortOrder: "asc" } },
      _count: { select: { products: true, orders: true } },
    },
  });
  const mp = await resolveMercadoPago(workspaceId);
  return NextResponse.json({
    store: full
      ? {
          ...full,
          shippingRules: asShippingRules(full.shippingRules),
          banners: asStoreBanners(full.banners),
          theme: asStoreTheme(full.theme),
          publicUrl: `/loja/${full.slug}`,
        }
      : null,
    mpConnected: Boolean(mp),
  });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "commerce");
  if (moduleOff) return moduleOff;

  const store = await ensureCommerceStore(workspaceId);
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 160);
  if (typeof body.published === "boolean") data.published = body.published;
  if (typeof body.acceptingOrders === "boolean") data.acceptingOrders = body.acceptingOrders;
  if (typeof body.shipEnabled === "boolean") data.shipEnabled = body.shipEnabled;
  if (typeof body.pickupEnabled === "boolean") data.pickupEnabled = body.pickupEnabled;
  if (Number.isInteger(body.minOrderCents) && Number(body.minOrderCents) >= 0) {
    data.minOrderCents = Number(body.minOrderCents);
  }
  if (typeof body.pickupName === "string") data.pickupName = body.pickupName.trim().slice(0, 160) || null;
  if (typeof body.pickupAddress === "string") {
    data.pickupAddress = body.pickupAddress.trim().slice(0, 255) || null;
  }
  if (typeof body.pickupInstructions === "string") {
    data.pickupInstructions = body.pickupInstructions.trim().slice(0, 255) || null;
  }
  if (body.shippingRules !== undefined) {
    data.shippingRules = asShippingRules(body.shippingRules ?? defaultShippingRules());
  }
  if (body.banners !== undefined) {
    data.banners = asStoreBanners(body.banners);
  }
  if (body.theme !== undefined) {
    data.theme = asStoreTheme(body.theme);
  }

  const updated = await prisma.commerceStore.update({
    where: { id: store.id },
    data,
    include: { categories: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({
    store: {
      ...updated,
      shippingRules: asShippingRules(updated.shippingRules),
      banners: asStoreBanners(updated.banners),
    },
  });
}
