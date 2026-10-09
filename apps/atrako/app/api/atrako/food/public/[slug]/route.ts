import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { asItemSchedule, asWeekHours, isItemOrderable } from "@/lib/food/availability";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const store = await prisma.foodStore.findUnique({
    where: { slug },
    include: {
      categories: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: { groups: { orderBy: { sortOrder: "asc" }, include: { options: { orderBy: { sortOrder: "asc" } } } } },
      },
    },
  });
  if (!store || store.status === "DISABLED") {
    return NextResponse.json({ error: "Loja indisponível" }, { status: 404 });
  }
  if (!(await isPublicModuleEnabled(store.clienteId, "food"))) {
    return NextResponse.json({ error: "Loja indisponível" }, { status: 404 });
  }
  const categoryById = new Map(store.categories.map((c) => [c.id, c.slug]));
  const hours = asWeekHours(store.hours);
  const open = store.acceptingOrders && store.status === "PUBLISHED";
  return NextResponse.json({
    slug: store.slug,
    name: store.name,
    acceptingOrders: store.acceptingOrders && store.status === "PUBLISHED",
    deliveryEnabled: store.deliveryEnabled,
    pickupEnabled: store.pickupEnabled,
    deliveryFeeCents: store.deliveryFeeCents,
    minOrderCents: store.minOrderCents,
    pickupName: store.pickupName,
    pickupAddress: store.pickupAddress,
    pickupInstructions: store.pickupInstructions,
    categories: store.categories.map((c) => ({ slug: c.slug, name: c.name })),
    items: store.items
      .filter((item) => categoryById.has(item.categoryId))
      .map((item) => ({
      id: item.id,
      key: item.key,
      category: categoryById.get(item.categoryId) ?? "burgers",
      name: item.name,
      description: item.description,
      priceCents: item.priceCents,
      imageUrl: item.imageUrl,
      emoji: item.emoji,
      badge: item.badge,
      calories: item.calories,
      allergens: item.allergens,
      ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
      groups: item.groups.map((group) => ({
        id: group.id,
        name: group.name,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        options: group.options.filter((option) => option.available).map((option) => ({
          id: option.id,
          name: option.name,
          priceCents: option.priceCents,
        })),
      })),
      available: open && isItemOrderable({
        available: item.available,
        categoryActive: true,
        storeHours: hours,
        schedule: asItemSchedule(item.schedule),
      }),
    })),
  });
}
