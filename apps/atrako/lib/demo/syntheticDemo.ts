import { prisma } from "@/lib/db";

export const SYNTHETIC_DEMO_SLUG = "incorporadora-de-sao-paulo";
export const SYNTHETIC_DEMO_MARKER = "demo_sintetico";

export async function isSyntheticDemoCliente(clienteId: string): Promise<boolean> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { slug: true, perfilPanel: true },
  });
  return (
    cliente?.slug === SYNTHETIC_DEMO_SLUG &&
    cliente.perfilPanel === SYNTHETIC_DEMO_MARKER
  );
}