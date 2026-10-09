import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { asItemSchedule, asWeekHours, type WeekHours } from "@/lib/food/availability";

function itemKey(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28) || "item";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

function categorySlug(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "categoria";
  return `${base}-${Math.random().toString(36).slice(2, 5)}`;
}

export async function storeForWorkspace(workspaceId: string) {
  return prisma.foodStore.findUnique({
    where: { clienteId: workspaceId },
    include: {
      categories: { orderBy: { sortOrder: "asc" } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: { groups: { orderBy: { sortOrder: "asc" }, include: { options: { orderBy: { sortOrder: "asc" } } } } },
      },
    },
  });
}

type GroupInput = {
  name: string;
  minSelect: number;
  maxSelect: number;
  options: Array<{ name: string; priceCents: number }>;
};

export async function saveFoodItem(input: {
  workspaceId: string;
  itemId?: string | null;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  ingredients: string[];
  available: boolean;
  schedule: unknown;
  groups: GroupInput[];
}) {
  const store = await prisma.foodStore.findUnique({ where: { clienteId: input.workspaceId } });
  if (!store) return { ok: false as const, error: "Loja não encontrada" };
  const category = await prisma.foodCategory.findFirst({ where: { id: input.categoryId, storeId: store.id } });
  if (!category) return { ok: false as const, error: "Categoria não encontrada" };
  const schedule = asItemSchedule(input.schedule);
  const data = {
    categoryId: category.id,
    name: input.name.trim().slice(0, 160),
    description: input.description?.trim() || null,
    priceCents: input.priceCents,
    imageUrl: input.imageUrl?.trim() || null,
    ingredients: input.ingredients,
    available: input.available,
    schedule: schedule ?? Prisma.JsonNull,
  };
  if (!data.name || data.priceCents < 0) return { ok: false as const, error: "Nome e preço são obrigatórios" };

  const existing = input.itemId
    ? await prisma.foodItem.findFirst({ where: { id: input.itemId, storeId: store.id } })
    : null;
  if (input.itemId && !existing) return { ok: false as const, error: "Item não encontrado" };
  const item = existing
    ? await prisma.foodItem.update({ where: { id: existing.id }, data })
    : await prisma.foodItem.create({ data: { ...data, storeId: store.id, key: itemKey(data.name) } });

  await prisma.foodModifierGroup.deleteMany({ where: { itemId: item.id } });
  for (const [index, group] of input.groups.entries()) {
    const name = group.name.trim().slice(0, 80);
    if (!name) continue;
    const maxSelect = Math.max(1, Math.min(20, group.maxSelect || 1));
    const minSelect = Math.max(0, Math.min(maxSelect, group.minSelect || 0));
    await prisma.foodModifierGroup.create({
      data: {
        itemId: item.id,
        name,
        minSelect,
        maxSelect,
        sortOrder: index,
        options: {
          create: group.options
            .map((option, optionIndex) => ({
              name: option.name.trim().slice(0, 80),
              priceCents: Math.max(0, option.priceCents || 0),
              sortOrder: optionIndex,
            }))
            .filter((option) => option.name),
        },
      },
    });
  }
  return { ok: true as const };
}

export async function saveFoodCategory(input: { workspaceId: string; categoryId?: string | null; name: string; active?: boolean }) {
  const store = await prisma.foodStore.findUnique({ where: { clienteId: input.workspaceId } });
  if (!store) return { ok: false as const, error: "Loja não encontrada" };
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false as const, error: "Informe o nome da categoria" };
  if (input.categoryId) {
    await prisma.foodCategory.updateMany({
      where: { id: input.categoryId, storeId: store.id },
      data: { name, ...(typeof input.active === "boolean" ? { active: input.active } : {}) },
    });
  } else {
    const count = await prisma.foodCategory.count({ where: { storeId: store.id } });
    await prisma.foodCategory.create({
      data: { storeId: store.id, name, slug: categorySlug(name), sortOrder: count, active: true },
    });
  }
  return { ok: true as const };
}

export async function reorderFood(input: {
  workspaceId: string;
  categories?: Array<{ id: string; sortOrder: number }>;
  items?: Array<{ id: string; sortOrder: number }>;
}) {
  const store = await prisma.foodStore.findUnique({ where: { clienteId: input.workspaceId } });
  if (!store) return { ok: false as const, error: "Loja não encontrada" };
  for (const row of input.categories ?? []) {
    await prisma.foodCategory.updateMany({ where: { id: row.id, storeId: store.id }, data: { sortOrder: row.sortOrder } });
  }
  for (const row of input.items ?? []) {
    await prisma.foodItem.updateMany({ where: { id: row.id, storeId: store.id }, data: { sortOrder: row.sortOrder } });
  }
  return { ok: true as const };
}

export async function saveStoreHours(workspaceId: string, hours: WeekHours | null) {
  const store = await prisma.foodStore.findUnique({ where: { clienteId: workspaceId } });
  if (!store) return { ok: false as const, error: "Loja não encontrada" };
  await prisma.foodStore.update({ where: { id: store.id }, data: { hours: hours ?? {} } });
  return { ok: true as const };
}

export { asWeekHours };
