import { prisma } from "@/lib/db";
import { defaultShippingRules } from "@/lib/commerce/shipping";

function storeSlug(clienteSlug: string) {
  const base = clienteSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60) || "loja";
  return base;
}

/** Cria a loja nativa se o workspace ainda não tem. Idempotente. */
export async function ensureCommerceStore(clienteId: string) {
  const existing = await prisma.commerceStore.findUnique({ where: { clienteId } });
  if (existing) return existing;

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { nome: true, slug: true },
  });
  if (!cliente) throw new Error("Cliente não encontrado");

  let slug = storeSlug(cliente.slug);
  const taken = await prisma.commerceStore.findUnique({ where: { slug }, select: { id: true } });
  if (taken) slug = `${slug}-${clienteId.slice(-4)}`.slice(0, 80);

  return prisma.commerceStore.create({
    data: {
      clienteId,
      slug,
      name: cliente.nome,
      shippingRules: defaultShippingRules(),
      pickupName: cliente.nome,
      categories: {
        create: [
          { name: "Geral", slug: "geral", sortOrder: 0 },
        ],
      },
    },
  });
}

export async function getCommerceStoreBySlug(slug: string) {
  return prisma.commerceStore.findUnique({
    where: { slug },
    include: {
      categories: { where: { active: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}
