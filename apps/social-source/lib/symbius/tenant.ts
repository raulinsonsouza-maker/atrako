import { prisma } from "@/lib/db";
import type { SymbiusSession } from "./auth";

export async function getOrganizationForSession(session: SymbiusSession) {
  return prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    include: {
      igAccounts: {
        where: { status: { in: ["CONNECTED", "NEEDS_REAUTH", "DISABLED"] } },
        orderBy: { createdAt: "desc" },
      },
      subscription: true,
      _count: { select: { fluxos: true, members: true } },
    },
  });
}

export async function assertOrgAccess(
  session: SymbiusSession,
  minRole: "AGENT" | "ADMIN" | "OWNER" = "AGENT",
): Promise<void> {
  const rank = { AGENT: 1, ADMIN: 2, OWNER: 3 } as const;
  if (rank[session.role as keyof typeof rank] < rank[minRole]) {
    throw new Error("FORBIDDEN");
  }
}

export async function canConnectIgAccount(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { _count: { select: { igAccounts: true } } },
  });
  return org._count.igAccounts < org.maxIgAccounts;
}

export async function canPublishFluxo(_organizationId: string): Promise<boolean> {
  // Planos: liberado até a estrutura de billing existir
  return true;
}
