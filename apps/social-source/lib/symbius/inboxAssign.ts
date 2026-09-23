import { prisma } from "@/lib/db";

export async function assignConversaRoundRobin(
  organizationId: string,
  conversaId: string,
): Promise<string | null> {
  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId,
      role: { in: ["AGENT", "ADMIN", "OWNER"] },
    },
    orderBy: { createdAt: "asc" },
  });
  if (members.length === 0) return null;

  const lastAssigned = await prisma.igConversa.findFirst({
    where: {
      organizationId,
      assignedUserId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: { assignedUserId: true },
  });

  const ids = members.map((m) => m.userId);
  let nextIdx = 0;
  if (lastAssigned?.assignedUserId) {
    const currentIdx = ids.indexOf(lastAssigned.assignedUserId);
    nextIdx = currentIdx >= 0 ? (currentIdx + 1) % ids.length : 0;
  }

  const assignedUserId = ids[nextIdx] ?? null;
  if (!assignedUserId) return null;

  await prisma.igConversa.update({
    where: { id: conversaId },
    data: { assignedUserId },
  });

  return assignedUserId;
}
