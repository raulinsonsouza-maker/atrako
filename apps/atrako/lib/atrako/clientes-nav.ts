import { prisma } from "@/lib/db";

/** Primeiro workspace ativo — Insights vai direto ao dashboard. */
export async function getFirstActiveClienteId(): Promise<string | null> {
  const cliente = await prisma.cliente.findFirst({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true },
  });
  return cliente?.id ?? null;
}

export async function listActiveClientesForNav(): Promise<Array<{ id: string; nome: string; slug: string }>> {
  return prisma.cliente.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, slug: true },
  });
}
