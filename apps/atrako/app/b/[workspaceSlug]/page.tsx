import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ensureDefaultBookingPage } from "@/lib/agenda/pages";

export default async function PublicBookingWorkspaceIndex({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { slug: workspaceSlug } });
  if (!cliente || !cliente.ativo) notFound();

  const defaultPage =
    (await prisma.agendaBookingPage.findFirst({
      where: { clienteId: cliente.id, isDefault: true, active: true },
      select: { slug: true },
    })) ??
    (await ensureDefaultBookingPage(cliente.id));

  redirect(`/b/${workspaceSlug}/${defaultPage.slug}`);
}
